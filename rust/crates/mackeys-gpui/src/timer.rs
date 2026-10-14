//! Drives the controllers' deadlines with GPUI timers (no threads of our own).
use gpui::Context;
use std::time::Instant;

/// The deadline a view has a timer for, and a generation that cancels older timers.
#[derive(Default)]
pub struct TimerState {
    scheduled: Option<Instant>,
    generation: u64,
}

/// A view with controller deadlines.
pub trait Timed: 'static + Sized {
    fn timer_state(&mut self) -> &mut TimerState;
    /// The earliest controller deadline.
    fn deadline(&self) -> Option<Instant>;
    /// Runs the due controller timers, emits events and redraws.
    fn on_tick(&mut self, now: Instant, cx: &mut Context<Self>);
}

/// Makes sure one GPUI timer fires at the view's next deadline. Call it from `render`.
pub fn ensure_timer<V: Timed>(view: &mut V, cx: &mut Context<V>) {
    let next = view.deadline();
    let st = view.timer_state();
    if next == st.scheduled {
        return;
    }
    st.scheduled = next;
    st.generation += 1;
    let generation = st.generation;
    let Some(at) = next else { return };
    let wait = at.saturating_duration_since(Instant::now());
    cx.spawn(async move |this, cx| {
        cx.background_executor().timer(wait).await;
        let _ = this.update(cx, |v, cx| {
            let st = v.timer_state();
            if st.generation != generation {
                return;
            }
            st.scheduled = None;
            v.on_tick(Instant::now(), cx);
            cx.notify();
        });
    })
    .detach();
}
