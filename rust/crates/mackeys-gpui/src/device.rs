//! `MacKeyboard` (keyboard deck) and `MacBook` (full top case with the built-in trackpad).
use crate::keymap::code_for_key;
use crate::paint::spx;
use crate::render::{key_cap, pad_surface, top_case_layers};
use crate::sound::{ClickSound, GatedSink};
use crate::timer::{ensure_timer, Timed, TimerState};
use gpui::{
    div, prelude::*, App, Context, EventEmitter, FocusHandle, KeyDownEvent, KeyUpEvent, Modifiers, ModifiersChangedEvent,
    MouseButton, MouseDownEvent, MouseUpEvent, SharedString, Subscription, Window,
};
use mackeys_core::{
    build_keyboard, keyboard_theme, top_case, trackpad_shadows, BacklightOptions, CustomLayoutPatch, Gradient, InputSource,
    KeyDownInput, KeyEvent, KeyboardController, KeyboardControllerOptions, KeyboardGeometry, KeyboardOptions, KeyboardState,
    KeyboardTheme, Parts, Room, TopCaseGeometry, TopCaseOptions, TrackpadController, TrackpadEvent, TrackpadPhase,
};
use std::cell::RefCell;
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
    kb: KeyboardGeometry,
    tc: TopCaseGeometry,
    pad_surface: Gradient,
    keys: KeyboardController,
    pad: TrackpadController,
    focus: FocusHandle,
    pointer_key: Option<String>,
    mods: Modifiers,
    capslock: bool,
    timer: TimerState,
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
            kb: build_keyboard(&KeyboardOptions::default()),
            tc: top_case("pro-space-black", &build_keyboard(&KeyboardOptions::default()), &TopCaseOptions::default()),
            pad_surface: Gradient { stops: vec![] },
            keys,
            pad,
            focus: cx.focus_handle(),
            pointer_key: None,
            mods: Modifiers::default(),
            capslock: false,
            timer: TimerState::default(),
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

    fn release_pointer(&mut self) {
        if let Some(id) = self.pointer_key.take() {
            self.keys.release(&id, InputSource::Pointer);
        }
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
}

fn render_device<V: HasCore + Timed>(v: &mut V, _window: &mut Window, cx: &mut Context<V>) -> gpui::Stateful<gpui::Div> {
    ensure_timer(v, cx);
    let c = v.core_ref();
    let s = c.scale;
    let theme = c.theme();
    let state = c.keys.state();
    let light = c.kb.light_keys;
    let tc = &c.tc;
    let (base, over) = top_case_layers(tc, s);

    let mut root = div()
        .id("mackeys-device")
        .track_focus(&c.focus)
        .key_context("MacKeys")
        .relative()
        .w(spx(tc.width, s))
        .h(spx(tc.height + 10.0, s))
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
            let prevent = c.keys.handle_key_down(&KeyDownInput { code, repeat: e.is_held, meta_key: m.platform, ctrl_key: m.control });
            if prevent {
                cx.stop_propagation();
            }
            flush(v, cx);
        }))
        .on_key_up(cx.listener(|v: &mut V, e: &KeyUpEvent, _, cx| {
            let c = v.core();
            if let Some(code) = code_for_key(&e.keystroke.key, &c.kb) {
                c.keys.handle_key_up(&code);
                flush(v, cx);
            }
        }))
        .on_modifiers_changed(cx.listener(|v: &mut V, e: &ModifiersChangedEvent, _, cx| {
            v.core().modifiers_changed(e);
            flush(v, cx);
        }))
        .children(base);

    if let Some(tp) = &tc.trackpad {
        let shadows = trackpad_shadows(&c.kb.finish);
        let phase = c.pad.phase();
        root = root.child(
            div()
                .id("mackeys-trackpad")
                .absolute()
                .left(spx(tp.x, s))
                .top(spx(tp.y, s))
                .w(spx(tp.w, s))
                .h(spx(tp.h, s))
                .child(pad_surface(&c.pad_surface, &shadows, tp.radius, tp.w, tp.h, phase, s))
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|v: &mut V, _: &MouseDownEvent, window, cx| {
                        window.focus(&v.core_ref().focus);
                        v.core().pad.press(InputSource::Pointer, true);
                        cx.stop_propagation();
                        flush(v, cx);
                    }),
                )
                .on_mouse_up(
                    MouseButton::Left,
                    cx.listener(|v: &mut V, _: &MouseUpEvent, _, cx| {
                        v.core().pad.release(InputSource::Pointer);
                        flush(v, cx);
                    }),
                )
                .on_mouse_up_out(
                    MouseButton::Left,
                    cx.listener(|v: &mut V, _: &MouseUpEvent, _, cx| {
                        if v.core_ref().pad.phase() != TrackpadPhase::Up {
                            v.core().pad.release(InputSource::Pointer);
                            flush(v, cx);
                        }
                    }),
                ),
        );
    }
    root = root.children(over);

    let mut keys = div().absolute().left(spx(tc.keyboard.x, s)).top(spx(tc.keyboard.y, s)).w(spx(c.kb.width, s)).h(spx(c.kb.height, s));
    for k in &c.kb.keys {
        let pressed = state.down.iter().any(|d| d == &k.id);
        let id = k.id.clone();
        let el = key_cap(k, &theme, pressed, state.caps, light, s)
            .id(SharedString::from(format!("mk-{}", k.id)))
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
        keys = keys.child(el);
    }
    root.child(keys)
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

            /// The page background the canvas uses behind this device (dark in a dark room).
            pub fn page_background(&self) -> gpui::Hsla {
                crate::paint::hsla(&self.core.tc.page_background, 1.0)
            }

            /// Focus this handle to receive physical key input.
            pub fn focus_handle(&self) -> FocusHandle {
                self.core.focus.clone()
            }

            /// Drawn size at the current scale.
            pub fn size(&self) -> gpui::Size<gpui::Pixels> {
                gpui::size(spx(self.core.tc.width, self.core.scale), spx(self.core.tc.height + 10.0, self.core.scale))
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
    "An interactive MacBook top case: deck, keyboard well, speaker grilles, hinge, built-in Force Touch trackpad and front notch. The lid is not drawn."
);

