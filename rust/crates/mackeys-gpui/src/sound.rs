//! Plays the recorded clicks with `rodio` (cargo feature `sound`, on by default).
//!
//! The audio device opens on the first sound. When no device exists, or the feature is off, every
//! call does nothing. Nothing in this module panics.
use mackeys_core::{KeySound, SoundSink, TrackpadSound};
use std::cell::RefCell;
use std::rc::Rc;

/// A handle to one click player. Clones share the player (and its audio stream).
#[derive(Clone)]
pub struct ClickSound(Rc<RefCell<imp::Player>>);

impl ClickSound {
    /// A new player with its own audio stream.
    pub fn new() -> Self {
        ClickSound(Rc::new(RefCell::new(imp::Player::default())))
    }

    /// The player shared by every MacKeys component on this thread.
    pub fn shared() -> Self {
        thread_local! {
            static SHARED: ClickSound = ClickSound::new();
        }
        SHARED.with(|s| s.clone())
    }

    pub fn set_enabled(&self, on: bool) {
        self.0.borrow_mut().enabled = on;
    }

    pub fn enabled(&self) -> bool {
        self.0.borrow().enabled
    }

    /// Master volume, 0 to 1.
    pub fn set_volume(&self, v: f32) {
        self.0.borrow_mut().volume = v.clamp(0.0, 1.0);
    }

    /// True when sound is compiled in (`sound` feature).
    pub fn available() -> bool {
        cfg!(feature = "sound")
    }
}

impl Default for ClickSound {
    fn default() -> Self {
        Self::new()
    }
}

/// A [`SoundSink`] that forwards to a [`ClickSound`] only while `enabled` is true. Each component
/// owns one, so turning sound off on one component does not mute the others.
pub struct GatedSink {
    pub sound: ClickSound,
    pub enabled: Rc<RefCell<bool>>,
}

impl SoundSink for GatedSink {
    fn key(&mut self, kind: KeySound, up: bool) {
        if *self.enabled.borrow() {
            self.sound.0.borrow_mut().key(kind, up);
        }
    }
    fn trackpad(&mut self, kind: TrackpadSound) {
        if *self.enabled.borrow() {
            self.sound.0.borrow_mut().trackpad(kind);
        }
    }
}

impl SoundSink for ClickSound {
    fn key(&mut self, kind: KeySound, up: bool) {
        self.0.borrow_mut().key(kind, up);
    }
    fn trackpad(&mut self, kind: TrackpadSound) {
        self.0.borrow_mut().trackpad(kind);
    }
}

#[cfg(feature = "sound")]
mod imp {
    use mackeys_core::{filter_trackpad_clip, keyboard_clips, trackpad_clips, KeySound, TrackpadSound, Voice, VoicePicker};
    use rodio::buffer::SamplesBuffer;
    use rodio::{OutputStream, OutputStreamBuilder, Source};
    use std::collections::HashMap;
    use std::sync::Arc;

    struct Clips {
        key_sr: u32,
        tp_sr: u32,
        key: HashMap<&'static str, Vec<Arc<[f32]>>>,
        tp: HashMap<&'static str, Vec<Arc<[f32]>>>,
    }

    impl Clips {
        fn load() -> Clips {
            let k = keyboard_clips();
            let t = trackpad_clips();
            let arc = |v: Vec<Vec<f32>>| v.into_iter().map(Arc::from).collect::<Vec<Arc<[f32]>>>();
            let mut key = HashMap::new();
            for kind in ["press", "release", "space"] {
                key.insert(kind, arc(k.decode(kind)));
            }
            let mut tp = HashMap::new();
            for kind in ["press", "release", "force"] {
                let f: Vec<Vec<f32>> = t.decode(kind).iter().map(|c| filter_trackpad_clip(c, t.sr as f64)).collect();
                tp.insert(kind, arc(f));
            }
            Clips { key_sr: k.sr, tp_sr: t.sr, key, tp }
        }
    }

    pub struct Player {
        pub enabled: bool,
        pub volume: f32,
        picker: VoicePicker,
        stream: Option<OutputStream>,
        failed: bool,
        clips: Option<Clips>,
    }

    impl Default for Player {
        fn default() -> Self {
            Player { enabled: true, volume: 1.0, picker: VoicePicker::default(), stream: None, failed: false, clips: None }
        }
    }

    impl Player {
        fn ready(&mut self) -> bool {
            if !self.enabled || self.failed {
                return false;
            }
            if self.stream.is_none() {
                match std::panic::catch_unwind(OutputStreamBuilder::open_default_stream) {
                    Ok(Ok(mut s)) => {
                        s.log_on_drop(false);
                        self.stream = Some(s);
                    }
                    _ => {
                        self.failed = true;
                        return false;
                    }
                }
            }
            if self.clips.is_none() {
                self.clips = Some(Clips::load());
            }
            true
        }

        fn play(&mut self, v: Voice, trackpad: bool) {
            let (Some(stream), Some(clips)) = (&self.stream, &self.clips) else { return };
            let (set, sr) = if trackpad { (&clips.tp, clips.tp_sr) } else { (&clips.key, clips.key_sr) };
            let Some(take) = set.get(v.kind).and_then(|l| l.get(v.take)) else { return };
            if sr == 0 || take.is_empty() {
                return;
            }
            let src = SamplesBuffer::new(1, sr, take.to_vec()).speed(v.rate as f32).amplify(v.gain as f32 * self.volume);
            stream.mixer().add(src);
        }

        pub fn key(&mut self, kind: KeySound, up: bool) {
            if self.ready() {
                let v = self.picker.key(kind, up);
                self.play(v, false);
            }
        }

        pub fn trackpad(&mut self, kind: TrackpadSound) {
            if self.ready() {
                let v = self.picker.trackpad(kind);
                self.play(v, true);
            }
        }
    }
}

#[cfg(not(feature = "sound"))]
mod imp {
    use mackeys_core::{KeySound, TrackpadSound};

    pub struct Player {
        pub enabled: bool,
        pub volume: f32,
    }

    impl Default for Player {
        fn default() -> Self {
            Player { enabled: true, volume: 1.0 }
        }
    }

    impl Player {
        pub fn key(&mut self, _kind: KeySound, _up: bool) {}
        pub fn trackpad(&mut self, _kind: TrackpadSound) {}
    }
}
