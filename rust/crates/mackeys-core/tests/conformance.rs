//! Checks every entry of `spec/fixtures/*.json` per SPEC "Conformance": numbers within 1e-6, strings
//! exact, colors within 1 unit per channel, same array lengths and order, `null` stays `null`.
use mackeys_core::*;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{Map, Value};
use std::path::PathBuf;
use std::time::{Duration, Instant};

fn fixture(name: &str) -> Map<String, Value> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../spec/fixtures").join(name);
    let s = std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("read {}: {e}", p.display()));
    match serde_json::from_str(&s).unwrap() {
        Value::Object(m) => m,
        _ => panic!("fixture {name} is not an object"),
    }
}

fn is_color(s: &str) -> bool {
    s.len() == 9 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn compare(path: &str, got: &Value, want: &Value, errs: &mut Vec<String>) {
    if errs.len() > 20 {
        return;
    }
    match (got, want) {
        (Value::Number(a), Value::Number(b)) => {
            let (a, b) = (a.as_f64().unwrap(), b.as_f64().unwrap());
            if (a - b).abs() > 1e-6 {
                errs.push(format!("{path}: number {a} != {b}"));
            }
        }
        (Value::String(a), Value::String(b)) => {
            if is_color(a) && is_color(b) {
                for i in 0..4 {
                    let ca = u8::from_str_radix(&a[1 + 2 * i..3 + 2 * i], 16).unwrap() as i32;
                    let cb = u8::from_str_radix(&b[1 + 2 * i..3 + 2 * i], 16).unwrap() as i32;
                    if (ca - cb).abs() > 1 {
                        errs.push(format!("{path}: color {a} != {b}"));
                        break;
                    }
                }
            } else if a != b {
                errs.push(format!("{path}: string {a:?} != {b:?}"));
            }
        }
        (Value::Bool(a), Value::Bool(b)) if a == b => {}
        (Value::Null, Value::Null) => {}
        (Value::Array(a), Value::Array(b)) => {
            if a.len() != b.len() {
                errs.push(format!("{path}: array length {} != {}", a.len(), b.len()));
                return;
            }
            for (i, (x, y)) in a.iter().zip(b).enumerate() {
                compare(&format!("{path}[{i}]"), x, y, errs);
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            for k in b.keys() {
                if !a.contains_key(k) {
                    errs.push(format!("{path}.{k}: missing"));
                }
            }
            for k in a.keys() {
                if !b.contains_key(k) {
                    errs.push(format!("{path}.{k}: unexpected field"));
                }
            }
            for (k, y) in b {
                if let Some(x) = a.get(k) {
                    compare(&format!("{path}.{k}"), x, y, errs);
                }
            }
        }
        _ => errs.push(format!("{path}: {got} != {want}")),
    }
}

fn check_all<I: DeserializeOwned, O: Serialize>(name: &str, run: impl Fn(&I) -> O) -> usize {
    let fx = fixture(name);
    let mut failed = Vec::new();
    for (key, entry) in &fx {
        let input: I = serde_json::from_value(entry["input"].clone()).unwrap_or_else(|e| panic!("{key}: input: {e}"));
        let got = serde_json::to_value(run(&input)).unwrap();
        let mut errs = Vec::new();
        compare(key, &got, &entry["output"], &mut errs);
        if !errs.is_empty() {
            failed.push(errs.join("\n"));
        }
    }
    assert!(failed.is_empty(), "{} of {} entries in {name} fail:\n{}", failed.len(), fx.len(), failed.join("\n---\n"));
    fx.len()
}

#[test]
fn keyboards_conform() {
    let n = check_all::<KeyboardOptions, _>("keyboards.json", build_keyboard);
    assert_eq!(n, 72);
}

#[derive(serde::Deserialize)]
struct ThemeInput {
    finish: String,
    backlight: BacklightOptions,
}

#[test]
fn themes_conform() {
    let n = check_all::<ThemeInput, _>("themes.json", |i| keyboard_theme(&i.finish, &i.backlight));
    assert_eq!(n, 17 * 6);
}

#[derive(serde::Deserialize)]
struct TopCaseInput {
    finish: String,
    parts: Parts,
    backlight: BacklightOptions,
}

#[test]
fn topcases_conform() {
    let n = check_all::<TopCaseInput, _>("topcases.json", |i| {
        let kb = build_keyboard(&KeyboardOptions { finish: Some(i.finish.clone()), ..Default::default() });
        top_case(&i.finish, &kb, &TopCaseOptions { parts: Some(i.parts), backlight: Some(i.backlight.clone()) })
    });
    assert_eq!(n, 17 * 4);
}

#[derive(serde::Deserialize)]
struct TrackpadInput {
    finish: String,
}

#[test]
fn trackpads_conform() {
    let n = check_all::<TrackpadInput, _>("trackpads.json", |i| trackpad(&i.finish));
    assert_eq!(n, 17);
}

#[test]
fn fallbacks() {
    assert_eq!(get_finish("nope").id, "pro-space-black");
    assert_eq!(get_finish("MacBook Air · Midnight").id, "air-midnight");
    assert_eq!(build_keyboard(&KeyboardOptions::new("x", "y")).layout, "en-us");
    assert_eq!(finish_ids().len(), 17);
    assert_eq!(layout_ids().len(), 16);
    let d = mac_device(&MacDeviceOptions { parts: Some(Parts::Full), ..Default::default() });
    assert!(d.top_case.trackpad.is_some());
}

// ---- Controllers -------------------------------------------------------------------------------

use std::cell::RefCell;
use std::rc::Rc;

#[derive(Clone, Default)]
struct Log(Rc<RefCell<Vec<String>>>);

impl SoundSink for Log {
    fn key(&mut self, kind: KeySound, up: bool) {
        self.0.borrow_mut().push(format!("{kind:?}{}", if up { "-up" } else { "" }));
    }
    fn trackpad(&mut self, kind: TrackpadSound) {
        self.0.borrow_mut().push(format!("tp-{kind:?}"));
    }
}

fn kb_controller(log: &Log, idle: Option<Duration>) -> KeyboardController {
    let kb = build_keyboard(&KeyboardOptions::default());
    KeyboardController::new(KeyboardControllerOptions { keys: kb.keys, sound: Some(Box::new(log.clone())), idle_off: idle, ..Default::default() })
}

#[test]
fn keyboard_press_release() {
    let log = Log::default();
    let mut c = kb_controller(&log, None);
    let t0 = Instant::now();
    c.press_at("KeyA", InputSource::Pointer, t0);
    c.press_at("KeyA", InputSource::Pointer, t0);
    assert!(c.is_down("KeyA"));
    c.press_at("Space", InputSource::Pointer, t0);
    c.release("KeyA", InputSource::Pointer);
    c.release("KeyA", InputSource::Pointer);
    let ev = c.take_events();
    assert_eq!(ev.len(), 3);
    assert_eq!(ev[0].kind, KeyEventType::Press);
    assert_eq!(ev[0].label, "A");
    assert_eq!(ev[1].sound, KeySound::Space);
    assert_eq!(ev[2].kind, KeyEventType::Release);
    assert_eq!(*log.0.borrow(), vec!["Key", "Space", "Key-up"]);
    assert_eq!(c.state().down, vec!["Space"]);
}

#[test]
fn keyboard_physical_keys() {
    let log = Log::default();
    let mut c = kb_controller(&log, None);
    let t0 = Instant::now();
    let down = |code: &str, meta: bool| KeyDownInput { code: code.into(), meta_key: meta, ..Default::default() };
    assert!(!c.handle_key_down_at(&down("Nope", false), t0));
    assert!(c.handle_key_down_at(&down("KeyQ", false), t0));
    assert!(!c.handle_key_down_at(&down("Tab", false), t0));
    assert!(!c.handle_key_down_at(&down("KeyC", true), t0));
    assert!(c.handle_key_down_at(&down("MetaLeft", true), t0));
    assert!(c.handle_key_down_at(&KeyDownInput { code: "KeyQ".into(), repeat: true, ..Default::default() }, t0));
    assert_eq!(c.state().down.len(), 4);
    c.handle_key_up_at("MetaLeft", t0);
    assert!(c.state().down.is_empty());
    // One release sound for release all.
    assert_eq!(log.0.borrow().iter().filter(|s| s.ends_with("-up")).count(), 1);

    // Caps lock taps on down and on up, released after 110 ms.
    c.handle_key_down_at(&down("CapsLock", false), t0);
    assert!(c.caps());
    assert!(c.is_down("CapsLock"));
    assert_eq!(c.next_deadline(), Some(t0 + Duration::from_millis(110)));
    c.tick(t0 + Duration::from_millis(50));
    assert!(c.is_down("CapsLock"));
    c.tick(t0 + Duration::from_millis(110));
    assert!(!c.is_down("CapsLock"));
    c.handle_key_up_at("CapsLock", t0 + Duration::from_millis(500));
    assert!(!c.caps());
}

#[test]
fn keyboard_idle() {
    let log = Log::default();
    let t0 = Instant::now();
    let mut c = kb_controller(&log, None);
    c.set_idle_off_at(idle_delay("5s"), t0);
    assert_eq!(c.next_deadline(), Some(t0 + Duration::from_secs(5)));
    c.press_at("KeyA", InputSource::Api, t0 + Duration::from_secs(3));
    c.tick(t0 + Duration::from_secs(6));
    assert!(!c.idle());
    c.tick(t0 + Duration::from_secs(8));
    assert!(c.idle());
    c.press_at("KeyB", InputSource::Api, t0 + Duration::from_secs(9));
    assert!(!c.idle());
    c.set_idle_off_at(idle_delay("never"), t0);
    assert_eq!(c.next_deadline(), None);
}

#[test]
fn command_up_plays_the_command_release_sound() {
    let log = Log::default();
    let mut c = kb_controller(&log, None);
    let t0 = Instant::now();
    c.handle_key_down_at(&KeyDownInput { code: "MetaLeft".into(), ..Default::default() }, t0);
    c.handle_key_up_at("MetaLeft", t0);
    assert_eq!(*log.0.borrow(), vec!["Mod", "Mod-up"]);
    // Focus loss has no lead key, so it keeps the plain key sound.
    c.press_at("MetaLeft", InputSource::Api, t0);
    c.release_all(InputSource::Keyboard);
    assert_eq!(log.0.borrow().last().unwrap(), "Key-up");
}

#[test]
fn caps_lock_ignores_auto_repeat() {
    let log = Log::default();
    let mut c = kb_controller(&log, None);
    let t0 = Instant::now();
    c.handle_key_down_at(&KeyDownInput { code: "CapsLock".into(), ..Default::default() }, t0);
    for i in 1..8 {
        let at = t0 + Duration::from_millis(35 * i);
        c.tick(at);
        let r = KeyDownInput { code: "CapsLock".into(), repeat: true, ..Default::default() };
        assert!(c.handle_key_down_at(&r, at));
    }
    let presses = c.take_events().iter().filter(|e| e.kind == KeyEventType::Press).count();
    assert_eq!(presses, 1);
    assert!(c.caps());
}

#[test]
fn idle_off_never_lights_the_backlight_again() {
    let log = Log::default();
    let t0 = Instant::now();
    let mut c = kb_controller(&log, None);
    c.set_idle_off_at(idle_delay("5s"), t0);
    c.tick(t0 + Duration::from_secs(6));
    assert!(c.idle());
    let rev = c.revision();
    c.set_idle_off_at(idle_delay("never"), t0 + Duration::from_secs(7));
    assert!(!c.idle());
    assert!(c.revision() > rev);
}

#[test]
fn trackpad_phases() {
    let log = Log::default();
    let t0 = Instant::now();
    let mut t = TrackpadController::new(Some(Box::new(log.clone())), Duration::from_millis(500));
    t.press_at(InputSource::Pointer, true, t0);
    assert_eq!(t.phase(), TrackpadPhase::Down);
    t.tick(t0 + Duration::from_millis(499));
    assert_eq!(t.phase(), TrackpadPhase::Down);
    t.tick(t0 + Duration::from_millis(500));
    assert_eq!(t.phase(), TrackpadPhase::Force);
    t.release(InputSource::Pointer);
    assert_eq!(t.phase(), TrackpadPhase::Up);
    t.release(InputSource::Pointer);
    assert_eq!(*log.0.borrow(), vec!["tp-Press", "tp-Force", "tp-Release"]);
    let ev = t.take_events();
    assert_eq!(ev.iter().map(|e| e.kind).collect::<Vec<_>>(), vec![TrackpadEventType::Press, TrackpadEventType::Force, TrackpadEventType::Release]);

    // Real pressure: no timer, the host calls force().
    t.press_at(InputSource::Pointer, false, t0);
    assert_eq!(t.next_deadline(), None);
    t.force(InputSource::Pointer);
    assert_eq!(t.phase(), TrackpadPhase::Force);
    t.force(InputSource::Pointer);
    t.release(InputSource::Pointer);
    t.tick(t0 + Duration::from_secs(5));
    assert_eq!(t.phase(), TrackpadPhase::Up);
}

#[test]
fn norwegian_key_sounds() {
    let kb = build_keyboard(&KeyboardOptions { finish: Some("pro-space-black".into()), layout: Some("no".into()), ..Default::default() });
    let want = [
        ("KeyA", KeySound::Key),
        ("F5", KeySound::Key),
        ("Fn", KeySound::Key),
        ("MetaLeft", KeySound::Mod),
        ("ShiftLeft", KeySound::Mod),
        ("Escape", KeySound::Tab),
        ("Tab", KeySound::Tab),
        ("Backspace", KeySound::Tab),
        ("CapsLock", KeySound::Caps),
        ("ShiftRight", KeySound::Wide),
        ("Enter", KeySound::Enter),
        ("Space", KeySound::Space),
        ("ArrowUp", KeySound::Arrow),
        ("TouchID", KeySound::Power),
    ];
    for (id, s) in want {
        assert_eq!(kb.keys.iter().find(|k| k.id == id).map(|k| k.sound), Some(s), "{id}");
    }
}
