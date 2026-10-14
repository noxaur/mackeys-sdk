//! GPUI view tests: pointer and keyboard input change the pressed state and emit events.
use gpui::{point, px, Modifiers, MouseButton, Point, Pixels, TestAppContext};
use mackeys_gpui::{KeyEvent, KeyEventType, MacKeyboard, MacTrackpad, TrackpadEvent, TrackpadEventType, TrackpadPhase};
use std::cell::RefCell;
use std::rc::Rc;

fn key_center(v: &MacKeyboard, id: &str) -> Point<Pixels> {
    let tc = v.top_case();
    let k = v.geometry().key(id).expect("key");
    point(px((tc.keyboard.x + k.x + k.w / 2.0) as f32), px((tc.keyboard.y + k.y + k.h / 2.0) as f32))
}

#[gpui::test]
fn pointer_presses_and_releases_a_key(cx: &mut TestAppContext) {
    let (view, cx) = cx.add_window_view(|window, cx| MacKeyboard::new(window, cx).sound(false));
    let events: Rc<RefCell<Vec<KeyEvent>>> = Rc::default();
    let sink = events.clone();
    cx.update(|_, cx| cx.subscribe(&view, move |_, e: &KeyEvent, _| sink.borrow_mut().push(e.clone())).detach());
    cx.run_until_parked();
    let at = view.read_with(cx, |v, _| key_center(v, "KeyA"));

    cx.simulate_mouse_down(at, MouseButton::Left, Modifiers::none());
    view.read_with(cx, |v, _| assert!(v.state().down.iter().any(|d| d == "KeyA"), "KeyA is down"));
    // The press transition takes 26 ms.
    std::thread::sleep(std::time::Duration::from_millis(40));
    view.read_with(cx, |v, _| assert_eq!(v.key_press_amount("KeyA"), 1.0));

    cx.simulate_mouse_up(at, MouseButton::Left, Modifiers::none());
    view.read_with(cx, |v, _| assert!(v.state().down.is_empty(), "every key is up"));

    let ev = events.borrow();
    assert_eq!(ev.len(), 2, "{ev:?}");
    assert_eq!((ev[0].kind, ev[0].id.as_str()), (KeyEventType::Press, "KeyA"));
    assert_eq!((ev[1].kind, ev[1].id.as_str()), (KeyEventType::Release, "KeyA"));
}

#[gpui::test]
fn keys_and_modifiers_press_keys_while_focused(cx: &mut TestAppContext) {
    let (view, cx) = cx.add_window_view(|window, cx| MacKeyboard::new(window, cx).sound(false));
    let events: Rc<RefCell<Vec<KeyEvent>>> = Rc::default();
    let sink = events.clone();
    cx.update(|window, cx| {
        cx.subscribe(&view, move |_, e: &KeyEvent, _| sink.borrow_mut().push(e.clone())).detach();
        window.focus(&view.read(cx).focus_handle());
    });
    cx.run_until_parked();

    cx.simulate_keystrokes("a");
    assert!(events.borrow().iter().any(|e| e.kind == KeyEventType::Press && e.id == "KeyA"), "{:?}", events.borrow());

    cx.simulate_modifiers_change(Modifiers { shift: true, ..Modifiers::none() });
    view.read_with(cx, |v, _| assert!(v.state().down.iter().any(|d| d == "ShiftLeft")));
    cx.simulate_modifiers_change(Modifiers::none());
    view.read_with(cx, |v, _| assert!(!v.state().down.iter().any(|d| d == "ShiftLeft")));

    cx.simulate_capslock_change(true);
    view.read_with(cx, |v, _| assert!(v.state().caps));
}

#[gpui::test]
fn trackpad_clicks(cx: &mut TestAppContext) {
    let (view, cx) = cx.add_window_view(|window, cx| MacTrackpad::new(window, cx).sound(false));
    let events: Rc<RefCell<Vec<TrackpadEvent>>> = Rc::default();
    let sink = events.clone();
    cx.update(|_, cx| cx.subscribe(&view, move |_, e: &TrackpadEvent, _| sink.borrow_mut().push(*e)).detach());
    cx.run_until_parked();
    let at = point(px(100.), px(100.));
    cx.simulate_mouse_down(at, MouseButton::Left, Modifiers::none());
    view.read_with(cx, |v, _| assert_eq!(v.phase(), TrackpadPhase::Down));
    view.update(cx, |v, cx| v.force(cx));
    view.read_with(cx, |v, _| assert_eq!(v.phase(), TrackpadPhase::Force));
    cx.simulate_mouse_up(at, MouseButton::Left, Modifiers::none());
    view.read_with(cx, |v, _| assert_eq!(v.phase(), TrackpadPhase::Up));
    let kinds: Vec<TrackpadEventType> = events.borrow().iter().map(|e| e.kind).collect();
    assert_eq!(kinds, vec![TrackpadEventType::Press, TrackpadEventType::Force, TrackpadEventType::Release]);
}
