//! `MacKeyboard` (keyboard deck) and `MacBook` (full top case with the built-in trackpad and the
//! open lid).
use crate::keymap::code_for_key;
use crate::native::{self, NativeEvent};
use crate::painter::{art_key, drop_unused, layer_element, prepare, ArtState, HasArt};
use crate::paint::spx;
use crate::scene::{phase_depth, DeviceScene, Tween, KEY_PRESS, KEY_RELEASE, LID_SIDE, LID_SPACE, PAD_PRESS, PAD_RELEASE};
use crate::sound::{ClickSound, GatedSink};
use crate::timer::{ensure_timer, Timed, TimerState};
use futures::StreamExt;
use gpui::{
    div, prelude::*, App, Context, EventEmitter, FocusHandle, KeyDownEvent, KeyUpEvent, Modifiers, ModifiersChangedEvent,
    MouseButton, MouseDownEvent, MouseUpEvent, SharedString, Subscription, Task, Window,
};
use mackeys_core::{
    build_keyboard, keyboard_theme, top_case, trackpad_shadows, BacklightOptions, CustomLayoutPatch, Gradient, InputSource,
    KeyDownInput, KeyEvent, KeyboardController, KeyboardControllerOptions, KeyboardGeometry, KeyboardOptions, KeyboardState,
    KeyboardTheme, Parts, Room, TopCaseGeometry, TopCaseOptions, TrackpadController, TrackpadEvent, TrackpadPhase,
};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use std::time::{Duration, Instant};

/// Backlight settings. Only MacBook Pro and Air finishes have a backlight.
#[derive(Clone, Debug, PartialEq)]
pub struct Backlight {
    /// The backlight switch. Default false.
    pub on: bool,
    /// Brightness in sixteenths, 0 to 16. Default 12.
    pub level: f64,
    /// Daylight or a dark room. Default daylight.
    pub room: Room,
    /// How much light spills out around each cap, 0 to 1. Default 0.5.
    pub bleed: f64,
    /// Light color, `#rrggbb`. Default `#f2f5ff`.
    pub color: String,
    /// Switch the light off after this long without a key press. Default never.
    pub idle_off: Option<Duration>,
}

impl Default for Backlight {
    fn default() -> Self {
        Backlight { on: false, level: 12.0, room: Room::Daylight, bleed: 0.5, color: "#f2f5ff".into(), idle_off: None }
    }
}

impl Backlight {
    /// A lit backlight at `level` in `room`.
    pub fn lit(level: f64, room: Room) -> Self {
        Backlight { on: true, level, room, ..Default::default() }
    }

    pub fn options(&self, idle: bool) -> BacklightOptions {
        BacklightOptions {
            on: Some(self.on),
            level: Some(self.level),
            room: Some(self.room),
            bleed: Some(self.bleed),
            color: Some(self.color.clone()),
            idle: Some(idle),
        }
    }
}

/// The shared state of `MacKeyboard` and `MacBook`.
pub struct DeviceCore {
    finish: String,
    layout: String,
    custom: Option<CustomLayoutPatch>,
    parts: Parts,
    backlight: Backlight,
    sound_on: Rc<RefCell<bool>>,
    scale: f32,
    show_lid: bool,
    kb: KeyboardGeometry,
    tc: TopCaseGeometry,
    pad_surface: Gradient,
    keys: KeyboardController,
    pad: TrackpadController,
    focus: FocusHandle,
    pointer_key: Option<String>,
    pad_pointer: bool,
    mods: Modifiers,
    capslock: bool,
    timer: TimerState,
    key_tweens: HashMap<String, Tween>,
    pad_tween: Tween,
    down: HashSet<String>,
    art: ArtState,
    native: Option<native::Monitor>,
    _native_task: Option<Task<()>>,
    _subs: Vec<Subscription>,
}

impl DeviceCore {
    fn new(parts: Parts, cx: &mut App) -> Self {
        let sound = ClickSound::shared();
        let sound_on = Rc::new(RefCell::new(true));
        let sink = || Box::new(GatedSink { sound: sound.clone(), enabled: sound_on.clone() });
        let keys = KeyboardController::new(KeyboardControllerOptions { sound: Some(sink()), ..Default::default() });
        let pad = TrackpadController::new(Some(sink()), Duration::from_millis(500));
        let mut c = DeviceCore {
            finish: "pro-space-black".into(),
            layout: "en-us".into(),
            custom: None,
            parts,
            backlight: Backlight::default(),
            sound_on,
            scale: 1.0,
            show_lid: true,
            kb: build_keyboard(&KeyboardOptions::default()),
            tc: top_case("pro-space-black", &build_keyboard(&KeyboardOptions::default()), &TopCaseOptions::default()),
            pad_surface: Gradient { stops: vec![] },
            keys,
            pad,
            focus: cx.focus_handle(),
            pointer_key: None,
            pad_pointer: false,
            mods: Modifiers::default(),
            capslock: false,
            timer: TimerState::default(),
            key_tweens: HashMap::new(),
            pad_tween: Tween::still(0.0),
            down: HashSet::new(),
            art: ArtState::default(),
            native: None,
            _native_task: None,
            _subs: vec![],
        };
        c.rebuild();
        c
    }

    fn rebuild(&mut self) {
        self.kb = build_keyboard(&KeyboardOptions {
            finish: Some(self.finish.clone()),
            layout: Some(self.layout.clone()),
            custom: self.custom.clone(),
        });
        self.keys.set_keys(&self.kb.keys);
        self.retheme();
    }

    fn retheme(&mut self) {
        let bl = self.backlight.options(self.keys.idle());
        self.tc = top_case(&self.kb.finish, &self.kb, &TopCaseOptions { parts: Some(self.parts), backlight: Some(bl) });
        self.pad_surface = mackeys_core::grad2(&mackeys_core::get_finish(&self.kb.finish).pad);
    }

    fn theme(&self) -> KeyboardTheme {
        keyboard_theme(&self.kb.finish, &self.backlight.options(self.keys.idle()))
    }

    fn lid(&self) -> bool {
        self.show_lid && self.tc.full
    }

    /// The deck's top-left corner in the view (CSS px).
    fn origin(&self) -> (f64, f64) {
        if self.lid() {
            (LID_SIDE, LID_SPACE)
        } else {
            (0.0, 0.0)
        }
    }

    fn view_size(&self) -> (f64, f64) {
        let (ox, oy) = self.origin();
        (self.tc.width + 2.0 * ox, self.tc.height + 10.0 + oy)
    }

    fn release_pointer(&mut self) {
        if let Some(id) = self.pointer_key.take() {
            self.keys.release(&id, InputSource::Pointer);
        }
    }

    /// Starts the press and release transitions for changed keys and the trackpad.
    fn animate(&mut self) {
        let now = Instant::now();
        let state = self.keys.state();
        let down: HashSet<String> = state.down.iter().cloned().collect();
        for id in down.difference(&self.down) {
            self.key_tweens.entry(id.clone()).or_insert_with(|| Tween::still(0.0)).go(1.0, KEY_PRESS, now);
        }
        for id in self.down.difference(&down) {
            self.key_tweens.entry(id.clone()).or_insert_with(|| Tween::still(1.0)).go(0.0, KEY_RELEASE, now);
        }
        self.down = down;
        self.key_tweens.retain(|_, t| t.running(now) || t.target() > 0.0);
        let target = phase_depth(self.pad.phase());
        let dur = if target > self.pad_tween.target() { PAD_PRESS } else { PAD_RELEASE };
        self.pad_tween.go(target, dur, now);
    }

    fn animating(&self, now: Instant) -> bool {
        self.pad_tween.running(now) || self.key_tweens.values().any(|t| t.running(now))
    }

    fn modifiers_changed(&mut self, e: &ModifiersChangedEvent) {
        let now = Instant::now();
        let m = e.modifiers;
        let pairs = [
            (self.mods.shift, m.shift, "ShiftLeft"),
            (self.mods.control, m.control, "ControlLeft"),
            (self.mods.alt, m.alt, "AltLeft"),
            (self.mods.platform, m.platform, "MetaLeft"),
            (self.mods.function, m.function, "Fn"),
        ];
        for (was, is, code) in pairs {
            if is && !was {
                self.keys.handle_key_down_at(&KeyDownInput { code: code.into(), meta_key: m.platform, ctrl_key: m.control, repeat: false }, now);
            } else if was && !is {
                self.keys.handle_key_up_at(code, now);
            }
        }
        self.mods = m;
        let on = e.capslock.on;
        if on != self.capslock {
            if on {
                self.keys.handle_key_down_at(&KeyDownInput { code: "CapsLock".into(), ..Default::default() }, now);
            } else {
                self.keys.handle_key_up_at("CapsLock", now);
            }
            self.capslock = on;
        }
        self.keys.set_caps(on);
    }

    /// Applies a native macOS event: keys while focused, pressure while the trackpad is pressed.
    fn native_event(&mut self, e: NativeEvent, focused: bool) {
        match e {
            NativeEvent::Pressure { stage } => {
                if self.pad_pointer && stage >= 2 && self.pad.phase() == TrackpadPhase::Down {
                    self.pad.force(InputSource::Pointer);
                    native::haptic();
                }
            }
            _ if !focused => {}
            NativeEvent::KeyDown { code, repeat, meta, ctrl } => {
                self.keys.handle_key_down(&KeyDownInput { code: code.into(), repeat, meta_key: meta, ctrl_key: ctrl });
            }
            NativeEvent::KeyUp { code } => self.keys.handle_key_up(code),
            NativeEvent::Modifier { code, down, meta, ctrl, caps } => {
                if code == "CapsLock" {
                    self.keys.handle_key_down(&KeyDownInput { code: code.into(), ..Default::default() });
                    self.keys.set_caps(caps);
                    self.capslock = caps;
                } else if down {
                    self.keys.handle_key_down(&KeyDownInput { code: code.into(), repeat: false, meta_key: meta, ctrl_key: ctrl });
                } else {
                    self.keys.handle_key_up(code);
                }
            }
        }
    }
}

/// The parts of a view that hold a [`DeviceCore`].
pub(crate) trait HasCore: 'static + Sized + EventEmitter<KeyEvent> + EventEmitter<TrackpadEvent> {
    fn core(&mut self) -> &mut DeviceCore;
    fn core_ref(&self) -> &DeviceCore;
}

fn flush<V: HasCore>(v: &mut V, cx: &mut Context<V>) {
    let c = v.core();
    let kev = c.keys.take_events();
    let tev = c.pad.take_events();
    // The idle switch changes the top case light too.
    c.retheme();
    c.animate();
    for e in kev {
        cx.emit(e);
    }
    for e in tev {
        cx.emit(e);
    }
    cx.notify();
}

fn tick_core<V: HasCore>(v: &mut V, now: Instant, cx: &mut Context<V>) {
    let c = v.core();
    c.keys.tick(now);
    c.pad.tick(now);
    flush(v, cx);
}

fn deadline_core(c: &DeviceCore) -> Option<Instant> {
    match (c.keys.next_deadline(), c.pad.next_deadline()) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (a, b) => a.or(b),
    }
}

fn subscribe<V: HasCore>(v: &mut V, window: &mut Window, cx: &mut Context<V>) {
    let focus = v.core_ref().focus.clone();
    let blur = cx.on_blur(&focus, window, |v: &mut V, _, cx| {
        let c = v.core();
        c.pointer_key = None;
        c.keys.release_all(InputSource::Keyboard);
        flush(v, cx);
    });
    let active = cx.observe_window_activation(window, |v: &mut V, window, cx| {
        if !window.is_window_active() {
            let c = v.core();
            c.keys.release_all(InputSource::Keyboard);
            c.pad.release(InputSource::Keyboard);
            flush(v, cx);
        }
    });
    v.core()._subs.extend([blur, active]);
    // Native macOS keys (left and right modifiers, physical codes) and Force Touch pressure.
    if let Some((monitor, mut rx)) = native::Monitor::install(window) {
        let task = cx.spawn_in(window, async move |this, cx| {
            while let Some(e) = rx.next().await {
                let alive = this.update_in(cx, |v: &mut V, window, cx| {
                    let focused = v.core_ref().focus.is_focused(window);
                    v.core().native_event(e, focused);
                    flush(v, cx);
                });
                if alive.is_err() {
                    break;
                }
            }
        });
        let c = v.core();
        c.native = Some(monitor);
        c._native_task = Some(task);
    }
}

fn render_device<V: HasCore + Timed + HasArt>(v: &mut V, window: &mut Window, cx: &mut Context<V>) -> gpui::Stateful<gpui::Div> {
    ensure_timer(v, cx);
    drop_unused(window, cx);
    let now = Instant::now();
    let dpr = window.scale_factor();
    let c = v.core_ref();
    let s = c.scale;
    let raster = (s * dpr) as f64;
    let theme = c.theme();
    let caps = c.keys.state().caps;
    let lid = c.lid();
    // Everything the images depend on.
    let key = art_key(&format!("{:?}|{:?}|{:?}|{:?}|{}|{}", c.kb.keys, theme, c.tc, c.pad_surface, lid, raster));
    let layers = if c.art.is_ready(key) {
        let pad_shadows = trackpad_shadows(&c.kb.finish);
        let scene = DeviceScene {
            kb: &c.kb,
            tc: &c.tc,
            theme: &theme,
            caps,
            pad_surface: &c.pad_surface,
            pad_shadows: &pad_shadows,
            pad_depth: c.pad_tween.value(now),
            lid,
            scale: raster,
        };
        let layers = scene.layers(|k| c.key_tweens.get(&k.id).map(|t| t.value(now)).unwrap_or(0.0));
        v.art_state().store(layers)
    } else {
        // Rasterize released and pressed images of every key in the background.
        let (kb, tc, pad_surface) = (c.kb.clone(), c.tc.clone(), c.pad_surface.clone());
        let theme = theme.clone();
        let job = move || {
            let pad_shadows = trackpad_shadows(&kb.finish);
            for (depth, p) in [(0.0, 0.0), (2.0, 1.0)] {
                let scene = DeviceScene { kb: &kb, tc: &tc, theme: &theme, caps, pad_surface: &pad_surface, pad_shadows: &pad_shadows, pad_depth: depth, lid, scale: raster };
                prepare(&scene.layers(|_| p));
            }
        };
        let st = v.art_state();
        st.request(key, job, cx);
        st.last()
    };
    let c = v.core_ref();
    if c.animating(now) {
        window.request_animation_frame();
    }
    let (vw, vh) = c.view_size();
    let (ox, oy) = c.origin();
    let tc = &c.tc;

    let mut root = div()
        .id("mackeys-device")
        .track_focus(&c.focus)
        .key_context("MacKeys")
        .relative()
        .w(spx(vw, s))
        .h(spx(vh, s))
        .on_mouse_down(
            MouseButton::Left,
            cx.listener(|v: &mut V, _: &MouseDownEvent, window, _| {
                window.focus(&v.core_ref().focus);
            }),
        )
        .on_key_down(cx.listener(|v: &mut V, e: &KeyDownEvent, _, cx| {
            let c = v.core();
            let Some(code) = code_for_key(&e.keystroke.key, &c.kb) else { return };
            let m = &e.keystroke.modifiers;
            if c.native.is_some() {
                // The native monitor presses the key; only stop GPUI's default handling here.
                if c.kb.key(&code).is_some() && code != "Tab" && !m.platform && !m.control {
                    cx.stop_propagation();
                }
                return;
            }
            let prevent = c.keys.handle_key_down(&KeyDownInput { code, repeat: e.is_held, meta_key: m.platform, ctrl_key: m.control });
            if prevent {
                cx.stop_propagation();
            }
            flush(v, cx);
        }))
        .on_key_up(cx.listener(|v: &mut V, e: &KeyUpEvent, _, cx| {
            let c = v.core();
            if c.native.is_some() {
                return;
            }
            if let Some(code) = code_for_key(&e.keystroke.key, &c.kb) {
                c.keys.handle_key_up(&code);
                flush(v, cx);
            }
        }))
        .on_modifiers_changed(cx.listener(|v: &mut V, e: &ModifiersChangedEvent, _, cx| {
            if v.core_ref().native.is_some() {
                return;
            }
            v.core().modifiers_changed(e);
            flush(v, cx);
        }))
        .children(layers.iter().map(|l| layer_element(l, s)));

    if let Some(tp) = &tc.trackpad {
        root = root.child(
            div()
                .id("mackeys-trackpad")
                .absolute()
                .left(spx(ox + tp.x, s))
                .top(spx(oy + tp.y, s))
                .w(spx(tp.w, s))
                .h(spx(tp.h, s))
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|v: &mut V, _: &MouseDownEvent, window, cx| {
                        window.focus(&v.core_ref().focus);
                        let c = v.core();
                        c.pad_pointer = true;
                        c.pad.press(InputSource::Pointer, true);
                        cx.stop_propagation();
                        flush(v, cx);
                    }),
                )
                .on_mouse_up(
                    MouseButton::Left,
                    cx.listener(|v: &mut V, _: &MouseUpEvent, _, cx| {
                        let c = v.core();
                        c.pad_pointer = false;
                        c.pad.release(InputSource::Pointer);
                        flush(v, cx);
                    }),
                )
                .on_mouse_up_out(
                    MouseButton::Left,
                    cx.listener(|v: &mut V, _: &MouseUpEvent, _, cx| {
                        if v.core_ref().pad.phase() != TrackpadPhase::Up {
                            let c = v.core();
                            c.pad_pointer = false;
                            c.pad.release(InputSource::Pointer);
                            flush(v, cx);
                        }
                    }),
                ),
        );
    }

    let (kx, ky) = (ox + tc.keyboard.x, oy + tc.keyboard.y);
    for k in &c.kb.keys {
        let id = k.id.clone();
        let el = div()
            .id(SharedString::from(format!("mk-{}", k.id)))
            .absolute()
            .left(spx(kx + k.x, s))
            .top(spx(ky + k.y, s))
            .w(spx(k.w, s))
            .h(spx(k.h, s))
            .cursor_pointer()
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(move |v: &mut V, _: &MouseDownEvent, window, cx| {
                    window.focus(&v.core_ref().focus);
                    let c = v.core();
                    c.release_pointer();
                    c.pointer_key = Some(id.clone());
                    c.keys.press(&id, InputSource::Pointer);
                    cx.stop_propagation();
                    flush(v, cx);
                }),
            )
            .on_mouse_up(
                MouseButton::Left,
                cx.listener(|v: &mut V, _: &MouseUpEvent, _, cx| {
                    v.core().release_pointer();
                    flush(v, cx);
                }),
            )
            .on_mouse_up_out(
                MouseButton::Left,
                cx.listener(|v: &mut V, _: &MouseUpEvent, _, cx| {
                    if v.core_ref().pointer_key.is_some() {
                        v.core().release_pointer();
                        flush(v, cx);
                    }
                }),
            );
        root = root.child(el);
    }
    root
}

macro_rules! device_view {
    ($name:ident, $parts:expr, $doc:literal) => {
        #[doc = $doc]
        ///
        /// Create it with `cx.new(|cx| ...::new(window, cx).finish("air-midnight"))`. It emits
        /// [`KeyEvent`] and [`TrackpadEvent`]; subscribe with `cx.subscribe`.
        pub struct $name {
            core: DeviceCore,
        }

        impl EventEmitter<KeyEvent> for $name {}
        impl EventEmitter<TrackpadEvent> for $name {}

        impl HasCore for $name {
            fn core(&mut self) -> &mut DeviceCore {
                &mut self.core
            }
            fn core_ref(&self) -> &DeviceCore {
                &self.core
            }
        }

        impl HasArt for $name {
            fn art_state(&mut self) -> &mut ArtState {
                &mut self.core.art
            }
        }

        impl Timed for $name {
            fn timer_state(&mut self) -> &mut TimerState {
                &mut self.core.timer
            }
            fn deadline(&self) -> Option<Instant> {
                deadline_core(&self.core)
            }
            fn on_tick(&mut self, now: Instant, cx: &mut Context<Self>) {
                tick_core(self, now, cx)
            }
        }

        impl Render for $name {
            fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
                render_device(self, window, cx)
            }
        }

        impl $name {
            pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
                let mut v = $name { core: DeviceCore::new($parts, cx) };
                subscribe(&mut v, window, cx);
                v
            }

            /// Finish id (`pro-space-black` ...) or name. Unknown ids fall back to `pro-space-black`.
            pub fn finish(mut self, finish: impl Into<String>) -> Self {
                self.core.finish = finish.into();
                self.core.rebuild();
                self
            }

            /// Layout id (`en-us`, `de`, `ja` ..., or `custom`).
            pub fn layout(mut self, layout: impl Into<String>) -> Self {
                self.core.layout = layout.into();
                self.core.rebuild();
                self
            }

            /// A custom layout. It also selects the `custom` layout.
            pub fn custom_layout(mut self, custom: CustomLayoutPatch) -> Self {
                self.core.custom = Some(custom);
                self.core.layout = "custom".into();
                self.core.rebuild();
                self
            }

            pub fn backlight(mut self, backlight: Backlight) -> Self {
                self.core.keys.set_idle_off(backlight.idle_off);
                self.core.backlight = backlight;
                self.core.retheme();
                self
            }

            /// Click sounds on or off. Default on.
            pub fn sound(self, on: bool) -> Self {
                *self.core.sound_on.borrow_mut() = on;
                self
            }

            /// Uniform drawing scale. 1 = 64 px per key.
            pub fn scale(mut self, scale: f32) -> Self {
                self.core.scale = scale.max(0.05);
                self
            }

            /// Draw the open lid with its screen behind the keyboard (MacBook finishes with a full
            /// top case only). Default true. The lid needs 200 px above and 120 px left and right of
            /// the deck (at scale 1).
            pub fn show_lid(mut self, on: bool) -> Self {
                self.core.show_lid = on;
                self
            }

            pub fn set_finish(&mut self, finish: impl Into<String>, cx: &mut Context<Self>) {
                self.core.finish = finish.into();
                self.core.rebuild();
                cx.notify();
            }

            pub fn set_layout(&mut self, layout: impl Into<String>, cx: &mut Context<Self>) {
                self.core.layout = layout.into();
                self.core.rebuild();
                cx.notify();
            }

            pub fn set_custom_layout(&mut self, custom: CustomLayoutPatch, cx: &mut Context<Self>) {
                self.core.custom = Some(custom);
                self.core.layout = "custom".into();
                self.core.rebuild();
                cx.notify();
            }

            pub fn set_backlight(&mut self, backlight: Backlight, cx: &mut Context<Self>) {
                if backlight.idle_off != self.core.backlight.idle_off {
                    self.core.keys.set_idle_off(backlight.idle_off);
                }
                self.core.backlight = backlight;
                self.core.retheme();
                cx.notify();
            }

            pub fn set_sound(&mut self, on: bool, cx: &mut Context<Self>) {
                *self.core.sound_on.borrow_mut() = on;
                cx.notify();
            }

            pub fn set_scale(&mut self, scale: f32, cx: &mut Context<Self>) {
                self.core.scale = scale.max(0.05);
                cx.notify();
            }

            pub fn set_show_lid(&mut self, on: bool, cx: &mut Context<Self>) {
                self.core.show_lid = on;
                cx.notify();
            }

            /// Presses a key by `KeyboardEvent.code` id, as an API call.
            pub fn press(&mut self, id: &str, cx: &mut Context<Self>) {
                self.core.keys.press(id, InputSource::Api);
                flush(self, cx);
            }

            /// Releases a key by id, as an API call.
            pub fn release(&mut self, id: &str, cx: &mut Context<Self>) {
                self.core.keys.release(id, InputSource::Api);
                flush(self, cx);
            }

            /// Presses a key and releases it after 110 ms.
            pub fn tap(&mut self, id: &str, cx: &mut Context<Self>) {
                self.core.keys.tap(id, InputSource::Api);
                flush(self, cx);
            }

            pub fn backlight_settings(&self) -> &Backlight {
                &self.core.backlight
            }

            pub fn sound_enabled(&self) -> bool {
                *self.core.sound_on.borrow()
            }

            pub fn lid_shown(&self) -> bool {
                self.core.lid()
            }

            pub fn geometry(&self) -> &KeyboardGeometry {
                &self.core.kb
            }

            pub fn top_case(&self) -> &TopCaseGeometry {
                &self.core.tc
            }

            pub fn state(&self) -> KeyboardState {
                self.core.keys.state()
            }

            pub fn trackpad_phase(&self) -> TrackpadPhase {
                self.core.pad.phase()
            }

            /// The press amount of a key now, 0 (up) to 1 (down), along the press and release
            /// transitions.
            pub fn key_press_amount(&self, id: &str) -> f64 {
                self.core.key_tweens.get(id).map(|t| t.value(Instant::now())).unwrap_or(0.0)
            }

            /// The page background the canvas uses behind this device (dark in a dark room).
            pub fn page_background(&self) -> gpui::Hsla {
                crate::paint::hsla(&self.core.tc.page_background, 1.0)
            }

            /// Focus this handle to receive physical key input.
            pub fn focus_handle(&self) -> FocusHandle {
                self.core.focus.clone()
            }

            /// True when native macOS input (physical keys, Force Touch pressure) is active.
            pub fn native_input(&self) -> bool {
                self.core.native.is_some()
            }

            /// Drawn size at the current scale, including the room for the lid.
            pub fn size(&self) -> gpui::Size<gpui::Pixels> {
                let (w, h) = self.core.view_size();
                gpui::size(spx(w, self.core.scale), spx(h, self.core.scale))
            }

            /// Where the deck's top-left corner is in the view, at the current scale.
            pub fn deck_origin(&self) -> gpui::Point<gpui::Pixels> {
                let (x, y) = self.core.origin();
                gpui::point(spx(x, self.core.scale), spx(y, self.core.scale))
            }
        }
    };
}

device_view!(
    MacKeyboard,
    Parts::Keyboard,
    "An interactive Mac keyboard deck: the keys in their well, on the deck of the finish (a Magic Keyboard for iMac finishes)."
);
device_view!(
    MacBook,
    Parts::Full,
    "An interactive MacBook: the open lid with its screen, deck, keyboard well, speaker grilles, hinge, built-in Force Touch trackpad and front notch."
);
