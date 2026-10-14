//! `MacTrackpad`: a standalone Force Touch trackpad.
use crate::paint::spx;
use crate::render::pad_surface;
use crate::sound::{ClickSound, GatedSink};
use crate::timer::{ensure_timer, Timed, TimerState};
use gpui::{div, prelude::*, Context, EventEmitter, MouseButton, MouseDownEvent, MouseUpEvent, Window};
use mackeys_core::{trackpad, InputSource, TrackpadController, TrackpadEvent, TrackpadGeometry, TrackpadPhase};
use std::cell::RefCell;
use std::rc::Rc;
use std::time::{Duration, Instant};

/// A standalone Force Touch trackpad of a MacBook finish. Click it, or press and hold for 500 ms for a
/// force click. It emits [`TrackpadEvent`].
///
/// GPUI 0.2.2 reports no pressure events, so the force click always comes from the timer. A host with
/// real pressure input can call [`MacTrackpad::press_with_pressure`] and [`MacTrackpad::force`].
pub struct MacTrackpad {
    geometry: TrackpadGeometry,
    pad: TrackpadController,
    sound_on: Rc<RefCell<bool>>,
    scale: f32,
    timer: TimerState,
}

impl EventEmitter<TrackpadEvent> for MacTrackpad {}

impl MacTrackpad {
    pub fn new(_window: &mut Window, _cx: &mut Context<Self>) -> Self {
        let sound_on = Rc::new(RefCell::new(true));
        let sink = GatedSink { sound: ClickSound::shared(), enabled: sound_on.clone() };
        MacTrackpad {
            geometry: trackpad("pro-space-black"),
            pad: TrackpadController::new(Some(Box::new(sink)), Duration::from_millis(500)),
            sound_on,
            scale: 1.0,
            timer: TimerState::default(),
        }
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
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        ensure_timer(self, cx);
        let g = &self.geometry;
        let s = self.scale;
        let r = [g.radius; 4];
        div()
            .id("mackeys-standalone-trackpad")
            .relative()
            .w(spx(g.width, s))
            .h(spx(g.height + g.side_depth, s))
            .child(
                crate::paint::corners(div().absolute().left(gpui::px(0.)).top(spx(g.side_depth, s)).w(spx(g.width, s)).h(spx(g.height, s)), r, s)
                    .bg(crate::paint::grad_bg(&g.side, 1.0))
                    .shadow(crate::paint::outer_shadows(&g.side_shadows, s)),
            )
            .child(pad_surface(&g.surface, &g.shadows, g.radius, g.width, g.height, self.pad.phase(), s))
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(|v, _: &MouseDownEvent, _, cx| {
                    v.pad.press(InputSource::Pointer, true);
                    v.flush(cx);
                }),
            )
            .on_mouse_up(
                MouseButton::Left,
                cx.listener(|v, _: &MouseUpEvent, _, cx| {
                    v.pad.release(InputSource::Pointer);
                    v.flush(cx);
                }),
            )
            .on_mouse_up_out(
                MouseButton::Left,
                cx.listener(|v, _: &MouseUpEvent, _, cx| {
                    if v.pad.phase() != TrackpadPhase::Up {
                        v.pad.release(InputSource::Pointer);
                        v.flush(cx);
                    }
                }),
            )
    }
}
