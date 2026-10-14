//! `MacTrackpad`: a standalone Force Touch trackpad.
use crate::native::{self, NativeEvent};
use crate::paint::spx;
use crate::painter::{art_key, drop_unused, layer_element, prepare, ArtState, HasArt};
use crate::scene::{phase_depth, trackpad_layers, Tween, PAD_PRESS, PAD_RELEASE};
use crate::sound::{ClickSound, GatedSink};
use crate::timer::{ensure_timer, Timed, TimerState};
use futures::StreamExt;
use gpui::{div, prelude::*, Context, EventEmitter, MouseButton, MouseDownEvent, MouseUpEvent, Task, Window};
use mackeys_core::{trackpad, InputSource, TrackpadController, TrackpadEvent, TrackpadGeometry, TrackpadPhase};
use std::cell::RefCell;
use std::rc::Rc;
use std::time::{Duration, Instant};

/// A standalone Force Touch trackpad of a MacBook finish. Click it, or press and hold for 500 ms for a
/// force click. It emits [`TrackpadEvent`].
///
/// On macOS, a native event monitor reads the Force Touch pressure stage: stage 2 makes a force
/// click at once (with haptic feedback). The 500 ms timer stays as the fallback for mice and other
/// platforms. A host with its own pressure input can call [`MacTrackpad::press_with_pressure`] and
/// [`MacTrackpad::force`].
pub struct MacTrackpad {
    geometry: TrackpadGeometry,
    pad: TrackpadController,
    sound_on: Rc<RefCell<bool>>,
    scale: f32,
    timer: TimerState,
    tween: Tween,
    pointer: bool,
    art: ArtState,
    _native: Option<native::Monitor>,
    _native_task: Option<Task<()>>,
}

impl EventEmitter<TrackpadEvent> for MacTrackpad {}

impl HasArt for MacTrackpad {
    fn art_state(&mut self) -> &mut ArtState {
        &mut self.art
    }
}

impl MacTrackpad {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let sound_on = Rc::new(RefCell::new(true));
        let sink = GatedSink { sound: ClickSound::shared(), enabled: sound_on.clone() };
        let mut v = MacTrackpad {
            geometry: trackpad("pro-space-black"),
            pad: TrackpadController::new(Some(Box::new(sink)), Duration::from_millis(500)),
            sound_on,
            scale: 1.0,
            timer: TimerState::default(),
            tween: Tween::still(0.0),
            pointer: false,
            art: ArtState::default(),
            _native: None,
            _native_task: None,
        };
        if let Some((monitor, mut rx)) = native::Monitor::install(window) {
            v._native_task = Some(cx.spawn_in(window, async move |this, cx| {
                while let Some(e) = rx.next().await {
                    let alive = this.update(cx, |v: &mut MacTrackpad, cx| {
                        if let NativeEvent::Pressure { stage } = e {
                            if v.pointer && stage >= 2 && v.pad.phase() == TrackpadPhase::Down {
                                v.pad.force(InputSource::Pointer);
                                native::haptic();
                                v.flush(cx);
                            }
                        }
                    });
                    if alive.is_err() {
                        break;
                    }
                }
            }));
            v._native = Some(monitor);
        }
        v
    }

    /// Finish id or name. Magic Keyboard finishes fall back to Space Black.
    pub fn finish(mut self, finish: &str) -> Self {
        self.geometry = trackpad(finish);
        self
    }

    pub fn sound(self, on: bool) -> Self {
        *self.sound_on.borrow_mut() = on;
        self
    }

    pub fn scale(mut self, scale: f32) -> Self {
        self.scale = scale.max(0.05);
        self
    }

    /// Hold time before a press becomes a force click. Default 500 ms.
    pub fn force_delay(mut self, d: Duration) -> Self {
        self.pad.force_delay = d;
        self
    }

    pub fn set_finish(&mut self, finish: &str, cx: &mut Context<Self>) {
        self.geometry = trackpad(finish);
        cx.notify();
    }

    pub fn set_sound(&mut self, on: bool, cx: &mut Context<Self>) {
        *self.sound_on.borrow_mut() = on;
        cx.notify();
    }

    pub fn set_scale(&mut self, scale: f32, cx: &mut Context<Self>) {
        self.scale = scale.max(0.05);
        cx.notify();
    }

    pub fn phase(&self) -> TrackpadPhase {
        self.pad.phase()
    }

    pub fn geometry(&self) -> &TrackpadGeometry {
        &self.geometry
    }

    /// Drawn size at the current scale, including the side under the glass.
    pub fn size(&self) -> gpui::Size<gpui::Pixels> {
        let g = &self.geometry;
        gpui::size(spx(g.width, self.scale), spx(g.height + g.side_depth, self.scale))
    }

    /// Starts a click without the force timer, for hosts with real pressure input.
    pub fn press_with_pressure(&mut self, cx: &mut Context<Self>) {
        self.pad.press(InputSource::Api, false);
        self.flush(cx);
    }

    /// Deepens a held click into a force click (pressure stage 2).
    pub fn force(&mut self, cx: &mut Context<Self>) {
        self.pad.force(InputSource::Api);
        self.flush(cx);
    }

    pub fn release(&mut self, cx: &mut Context<Self>) {
        self.pad.release(InputSource::Api);
        self.flush(cx);
    }

    fn flush(&mut self, cx: &mut Context<Self>) {
        for e in self.pad.take_events() {
            cx.emit(e);
        }
        let target = phase_depth(self.pad.phase());
        let dur = if target > self.tween.target() { PAD_PRESS } else { PAD_RELEASE };
        self.tween.go(target, dur, Instant::now());
        cx.notify();
    }
}

impl Timed for MacTrackpad {
    fn timer_state(&mut self) -> &mut TimerState {
        &mut self.timer
    }
    fn deadline(&self) -> Option<Instant> {
        self.pad.next_deadline()
    }
    fn on_tick(&mut self, now: Instant, cx: &mut Context<Self>) {
        self.pad.tick(now);
        self.flush(cx);
    }
}

impl Render for MacTrackpad {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        ensure_timer(self, cx);
        drop_unused(window, cx);
        let now = Instant::now();
        let s = self.scale;
        let raster = (s * window.scale_factor()) as f64;
        let key = art_key(&format!("{:?}|{}", self.geometry, raster));
        let layers = if self.art.is_ready(key) {
            let l = trackpad_layers(&self.geometry, self.tween.value(now), raster);
            self.art.store(l)
        } else {
            let g = self.geometry.clone();
            let job = move || {
                prepare(&trackpad_layers(&g, 0.0, raster));
                prepare(&trackpad_layers(&g, 2.0, raster));
            };
            self.art.request(key, job, cx);
            self.art.last()
        };
        if self.tween.running(now) {
            window.request_animation_frame();
        }
        let g = &self.geometry;
        div()
            .id("mackeys-standalone-trackpad")
            .relative()
            .w(spx(g.width, s))
            .h(spx(g.height + g.side_depth, s))
            .children(layers.iter().map(|l| layer_element(l, s)))
            .child(
                div()
                    .id("mackeys-standalone-trackpad-glass")
                    .absolute()
                    .left(spx(0.0, s))
                    .top(spx(0.0, s))
                    .w(spx(g.width, s))
                    .h(spx(g.height, s))
                    .on_mouse_down(
                        MouseButton::Left,
                        cx.listener(|v, _: &MouseDownEvent, _, cx| {
                            v.pointer = true;
                            v.pad.press(InputSource::Pointer, true);
                            v.flush(cx);
                        }),
                    )
                    .on_mouse_up(
                        MouseButton::Left,
                        cx.listener(|v, _: &MouseUpEvent, _, cx| {
                            v.pointer = false;
                            v.pad.release(InputSource::Pointer);
                            v.flush(cx);
                        }),
                    )
                    .on_mouse_up_out(
                        MouseButton::Left,
                        cx.listener(|v, _: &MouseUpEvent, _, cx| {
                            if v.pad.phase() != TrackpadPhase::Up {
                                v.pointer = false;
                                v.pad.release(InputSource::Pointer);
                                v.flush(cx);
                            }
                        }),
                    ),
            )
    }
}
