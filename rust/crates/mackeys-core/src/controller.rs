//! Framework-free state machines for the keyboard and the trackpad. Port of `controller.ts`.
//!
//! The controllers own no threads and no timers. Every method that starts a delay takes an explicit
//! [`Instant`] (the `*_at` variants; the plain variants use `Instant::now()`). The host calls
//! [`KeyboardController::tick`] at or after [`KeyboardController::next_deadline`] (and the same for the
//! trackpad), for example from a GPUI timer task. Events queue up; read them with `take_events`.
use crate::keyboard::{KeyCap, KeySound};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum InputSource {
    Pointer,
    Keyboard,
    Api,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum KeyEventType {
    Press,
    Release,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyEvent {
    #[serde(rename = "type")]
    pub kind: KeyEventType,
    pub id: String,
    pub label: String,
    pub sound: KeySound,
    pub source: InputSource,
}

/// A snapshot of the keyboard state.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct KeyboardState {
    /// Ids of the keys that are down, in press order.
    pub down: Vec<String>,
    pub caps: bool,
    /// True while the idle timer has switched the backlight off.
    pub idle: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum TrackpadSound {
    Press,
    Release,
    Force,
}

/// Receives the click sounds of a controller.
pub trait SoundSink {
    fn key(&mut self, kind: KeySound, up: bool);
    fn trackpad(&mut self, kind: TrackpadSound);
}

/// System Settings idle delays for "Turn keyboard backlight off after inactivity".
pub const IDLE_DELAYS: [(&str, Option<u64>); 6] = [
    ("never", None),
    ("5s", Some(5_000)),
    ("10s", Some(10_000)),
    ("30s", Some(30_000)),
    ("1m", Some(60_000)),
    ("5m", Some(300_000)),
];

/// Looks up an idle delay by name (`never`, `5s`, `10s`, `30s`, `1m`, `5m`).
pub fn idle_delay(name: &str) -> Option<Duration> {
    IDLE_DELAYS.iter().find(|(n, _)| *n == name).and_then(|(_, ms)| ms.map(Duration::from_millis))
}

/// A physical key down, as a host reports it.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct KeyDownInput {
    /// `KeyboardEvent.code`.
    pub code: String,
    pub repeat: bool,
    pub meta_key: bool,
    pub ctrl_key: bool,
}

#[derive(Clone)]
struct KeyInfo {
    label: String,
    sound: KeySound,
}

pub struct KeyboardControllerOptions {
    pub keys: Vec<KeyCap>,
    pub sound: Option<Box<dyn SoundSink>>,
    /// Switch the backlight off after this long without a key press. `None` = never.
    pub idle_off: Option<Duration>,
    /// How long a synthetic tap (caps lock) holds the key down. Default 110 ms.
    pub tap: Duration,
}

impl Default for KeyboardControllerOptions {
    fn default() -> Self {
        KeyboardControllerOptions { keys: vec![], sound: None, idle_off: None, tap: Duration::from_millis(110) }
    }
}

/// The keyboard state machine: keys down, caps lock, idle backlight.
pub struct KeyboardController {
    down: Vec<String>,
    caps: bool,
    idle: bool,
    keys: HashMap<String, KeyInfo>,
    taps: Vec<(Instant, String, InputSource)>,
    idle_deadline: Option<Instant>,
    events: Vec<KeyEvent>,
    revision: u64,
    pub sound: Option<Box<dyn SoundSink>>,
    pub idle_off: Option<Duration>,
    pub tap_duration: Duration,
}

impl Default for KeyboardController {
    fn default() -> Self {
        Self::new(KeyboardControllerOptions::default())
    }
}

impl KeyboardController {
    pub fn new(opts: KeyboardControllerOptions) -> Self {
        let mut c = KeyboardController {
            down: vec![],
            caps: false,
            idle: false,
            keys: HashMap::new(),
            taps: vec![],
            idle_deadline: None,
            events: vec![],
            revision: 0,
            sound: opts.sound,
            idle_off: opts.idle_off,
            tap_duration: opts.tap,
        };
        c.set_keys(&opts.keys);
        c.arm_idle(Instant::now());
        c
    }

    pub fn set_keys(&mut self, keys: &[KeyCap]) {
        self.keys = keys.iter().map(|k| (k.id.clone(), KeyInfo { label: k.label.clone(), sound: k.sound })).collect();
    }

    pub fn set_idle_off(&mut self, d: Option<Duration>) {
        self.set_idle_off_at(d, Instant::now());
    }

    pub fn set_idle_off_at(&mut self, d: Option<Duration>, now: Instant) {
        self.idle_off = d;
        self.arm_idle(now);
        if d.is_none_or(|d| d.is_zero()) && self.idle {
            self.idle = false;
            self.revision += 1;
        }
    }

    pub fn state(&self) -> KeyboardState {
        KeyboardState { down: self.down.clone(), caps: self.caps, idle: self.idle }
    }

    /// Increments on every state change. Hosts compare it to know when to redraw.
    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn caps(&self) -> bool {
        self.caps
    }

    pub fn idle(&self) -> bool {
        self.idle
    }

    pub fn has(&self, id: &str) -> bool {
        self.keys.contains_key(id)
    }

    pub fn is_down(&self, id: &str) -> bool {
        self.down.iter().any(|d| d == id)
    }

    /// Takes the queued press and release events.
    pub fn take_events(&mut self) -> Vec<KeyEvent> {
        std::mem::take(&mut self.events)
    }

    fn info(&self, id: &str) -> (String, KeySound) {
        match self.keys.get(id) {
            Some(k) => (k.label.clone(), k.sound),
            None => (id.to_string(), KeySound::Key),
        }
    }

    pub fn press(&mut self, id: &str, source: InputSource) {
        self.press_at(id, source, Instant::now())
    }

    pub fn press_at(&mut self, id: &str, source: InputSource, now: Instant) {
        if self.is_down(id) {
            return;
        }
        let (label, kind) = self.info(id);
        if let Some(s) = self.sound.as_mut() {
            s.key(kind, false);
        }
        self.down.push(id.to_string());
        if id == "CapsLock" {
            self.caps = !self.caps;
        }
        self.idle = false;
        self.emit(KeyEvent { kind: KeyEventType::Press, id: id.to_string(), label, sound: kind, source });
        self.arm_idle(now);
    }

    pub fn release(&mut self, id: &str, source: InputSource) {
        if !self.is_down(id) {
            return;
        }
        let (label, kind) = self.info(id);
        if let Some(s) = self.sound.as_mut() {
            s.key(kind, true);
        }
        self.down.retain(|d| d != id);
        self.emit(KeyEvent { kind: KeyEventType::Release, id: id.to_string(), label, sound: kind, source });
    }

    /// Presses a key and lets go after `tap_duration`.
    pub fn tap(&mut self, id: &str, source: InputSource) {
        self.tap_at(id, source, Instant::now())
    }

    pub fn tap_at(&mut self, id: &str, source: InputSource, now: Instant) {
        self.press_at(id, source, now);
        self.taps.push((now + self.tap_duration, id.to_string(), source));
    }

    pub fn release_all(&mut self, source: InputSource) {
        self.release_all_after(None, source);
    }

    /// Releases every key with one release sound: the sound class of `lead` when it is down, else `Key`.
    fn release_all_after(&mut self, lead: Option<&str>, source: InputSource) {
        if self.down.is_empty() {
            return;
        }
        let kind = match lead {
            Some(id) if self.is_down(id) => self.info(id).1,
            _ => KeySound::Key,
        };
        if let Some(s) = self.sound.as_mut() {
            s.key(kind, true);
        }
        let ids = std::mem::take(&mut self.down);
        for id in ids {
            let (label, kind) = self.info(&id);
            self.events.push(KeyEvent { kind: KeyEventType::Release, id, label, sound: kind, source });
        }
        self.revision += 1;
    }

    pub fn set_caps(&mut self, on: bool) {
        if self.caps == on {
            return;
        }
        self.caps = on;
        self.revision += 1;
    }

    /// Feeds a physical key down. Returns true when the host should consume the event: every known key
    /// except Tab and command or control chords.
    pub fn handle_key_down(&mut self, e: &KeyDownInput) -> bool {
        self.handle_key_down_at(e, Instant::now())
    }

    pub fn handle_key_down_at(&mut self, e: &KeyDownInput, now: Instant) -> bool {
        let id = e.code.as_str();
        if !self.keys.contains_key(id) {
            return false;
        }
        let modifier = ["Meta", "Control", "Alt", "Shift"].iter().any(|p| id.starts_with(p));
        let chord = (e.meta_key || e.ctrl_key) && !modifier;
        let prevent = !chord && id != "Tab";
        if e.repeat {
            return prevent;
        }
        // macOS sends one key down when caps lock turns on and one key up when it turns off.
        if id == "CapsLock" {
            self.tap_at(id, InputSource::Keyboard, now);
            return prevent;
        }
        self.press_at(id, InputSource::Keyboard, now);
        prevent
    }

    pub fn handle_key_up(&mut self, code: &str) {
        self.handle_key_up_at(code, Instant::now())
    }

    pub fn handle_key_up_at(&mut self, code: &str, now: Instant) {
        if code == "CapsLock" {
            self.tap_at(code, InputSource::Keyboard, now);
            return;
        }
        // macOS sends no key up for keys typed while command is held, so command's release lets go of
        // everything.
        if code == "MetaLeft" || code == "MetaRight" {
            self.release_all_after(Some(code), InputSource::Keyboard);
            return;
        }
        if self.keys.contains_key(code) {
            self.release(code, InputSource::Keyboard);
        }
    }

    /// The earliest time at which [`tick`](Self::tick) has work to do.
    pub fn next_deadline(&self) -> Option<Instant> {
        self.taps.iter().map(|t| t.0).chain(self.idle_deadline).min()
    }

    /// Runs the timers that are due at `now`: tap releases and the idle switch-off.
    pub fn tick(&mut self, now: Instant) {
        let mut due: Vec<(Instant, String, InputSource)> = vec![];
        self.taps.retain(|t| {
            if t.0 <= now {
                due.push(t.clone());
                false
            } else {
                true
            }
        });
        due.sort_by_key(|t| t.0);
        for (_, id, src) in due {
            self.release(&id, src);
        }
        if let Some(d) = self.idle_deadline {
            if d <= now {
                self.idle_deadline = None;
                self.idle = true;
                self.revision += 1;
            }
        }
    }

    /// Cancels all timers.
    pub fn dispose(&mut self) {
        self.taps.clear();
        self.idle_deadline = None;
        self.events.clear();
    }

    fn arm_idle(&mut self, now: Instant) {
        self.idle_deadline = match self.idle_off {
            Some(d) if !d.is_zero() => Some(now + d),
            _ => None,
        };
    }

    fn emit(&mut self, ev: KeyEvent) {
        self.events.push(ev);
        self.revision += 1;
    }
}

// ---- Trackpad ----------------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum TrackpadPhase {
    #[default]
    Up,
    Down,
    Force,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TrackpadEventType {
    Press,
    Force,
    Release,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrackpadEvent {
    #[serde(rename = "type")]
    pub kind: TrackpadEventType,
    pub source: InputSource,
}

/// The trackpad never moves: a haptic engine clicks it. A press clicks, holding past the force
/// threshold gives a deeper force click, and lifting gives a lighter release click.
pub struct TrackpadController {
    phase: TrackpadPhase,
    force_deadline: Option<(Instant, InputSource)>,
    events: Vec<TrackpadEvent>,
    revision: u64,
    pub sound: Option<Box<dyn SoundSink>>,
    /// Hold time before a press becomes a force click. Default 500 ms.
    pub force_delay: Duration,
}

impl Default for TrackpadController {
    fn default() -> Self {
        Self::new(None, Duration::from_millis(500))
    }
}

impl TrackpadController {
    pub fn new(sound: Option<Box<dyn SoundSink>>, force_delay: Duration) -> Self {
        TrackpadController { phase: TrackpadPhase::Up, force_deadline: None, events: vec![], revision: 0, sound, force_delay }
    }

    pub fn phase(&self) -> TrackpadPhase {
        self.phase
    }

    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn take_events(&mut self) -> Vec<TrackpadEvent> {
        std::mem::take(&mut self.events)
    }

    /// Starts a click. `timed_force` = false when the host reports real pressure and calls
    /// [`force`](Self::force) itself.
    pub fn press(&mut self, source: InputSource, timed_force: bool) {
        self.press_at(source, timed_force, Instant::now())
    }

    pub fn press_at(&mut self, source: InputSource, timed_force: bool, now: Instant) {
        if self.phase != TrackpadPhase::Up {
            return;
        }
        if let Some(s) = self.sound.as_mut() {
            s.trackpad(TrackpadSound::Press);
        }
        self.set(TrackpadPhase::Down, TrackpadEventType::Press, source);
        self.force_deadline = if timed_force { Some((now + self.force_delay, source)) } else { None };
    }

    /// Deepens a held click into a force click.
    pub fn force(&mut self, source: InputSource) {
        if self.phase != TrackpadPhase::Down {
            return;
        }
        self.force_deadline = None;
        if let Some(s) = self.sound.as_mut() {
            s.trackpad(TrackpadSound::Force);
        }
        self.set(TrackpadPhase::Force, TrackpadEventType::Force, source);
    }

    pub fn release(&mut self, source: InputSource) {
        if self.phase == TrackpadPhase::Up {
            return;
        }
        self.force_deadline = None;
        if let Some(s) = self.sound.as_mut() {
            s.trackpad(TrackpadSound::Release);
        }
        self.set(TrackpadPhase::Up, TrackpadEventType::Release, source);
    }

    pub fn next_deadline(&self) -> Option<Instant> {
        self.force_deadline.map(|d| d.0)
    }

    /// Runs the force timer when it is due.
    pub fn tick(&mut self, now: Instant) {
        if let Some((d, src)) = self.force_deadline {
            if d <= now {
                self.force_deadline = None;
                self.force(src);
            }
        }
    }

    pub fn dispose(&mut self) {
        self.force_deadline = None;
        self.events.clear();
    }

    fn set(&mut self, p: TrackpadPhase, kind: TrackpadEventType, source: InputSource) {
        self.phase = p;
        self.events.push(TrackpadEvent { kind, source });
        self.revision += 1;
    }
}
