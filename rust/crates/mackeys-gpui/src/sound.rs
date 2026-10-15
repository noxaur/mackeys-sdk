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

/// The decoded click recordings: keyboard takes as recorded, trackpad takes through the SPEC filter
/// (high shelf 2 kHz -14 dB, then low-pass 5 kHz Q 0.5).
pub struct ClipBank {
    pub key_sr: u32,
    pub trackpad_sr: u32,
    key: std::collections::HashMap<&'static str, Vec<std::sync::Arc<[f32]>>>,
    trackpad: std::collections::HashMap<&'static str, Vec<std::sync::Arc<[f32]>>>,
}

impl ClipBank {
    /// Decodes every take (a few milliseconds).
    pub fn load() -> ClipBank {
        use mackeys_core::{filter_trackpad_clip, key_clip_name, keyboard_clips, trackpad_clips, KeyForce, KeySound};
        use std::sync::Arc;
        let k = keyboard_clips();
        let t = trackpad_clips();
        let arc = |v: Vec<Vec<f32>>| v.into_iter().map(Arc::from).collect::<Vec<Arc<[f32]>>>();
        let mut key = std::collections::HashMap::new();
        for kind in KeySound::ALL {
            for force in [KeyForce::Soft, KeyForce::Hard] {
                for up in [false, true] {
                    let name = key_clip_name(kind, force, up);
                    key.entry(name).or_insert_with(|| arc(k.decode(name)));
                }
            }
        }
        let mut trackpad = std::collections::HashMap::new();
        for kind in ["press", "release", "force"] {
            let f: Vec<Vec<f32>> = t.decode(kind).iter().map(|c| filter_trackpad_clip(c, t.sr as f64)).collect();
            trackpad.insert(kind, arc(f));
        }
        ClipBank { key_sr: k.sr, trackpad_sr: t.sr, key, trackpad }
    }

    /// The take a voice plays, and its sample rate.
    pub fn take(&self, v: &mackeys_core::Voice, trackpad: bool) -> Option<(&[f32], u32)> {
        let (set, sr) = if trackpad { (&self.trackpad, self.trackpad_sr) } else { (&self.key, self.key_sr) };
        set.get(v.kind).and_then(|l| l.get(v.take)).map(|c| (&c[..], sr))
    }
}

/// The samples of one voice: the take resampled for `rate` (linear interpolation; a rate above 1
/// plays faster and higher) and multiplied by `gain`.
pub fn render_voice(take: &[f32], rate: f64, gain: f64) -> Vec<f32> {
    if take.is_empty() || rate <= 0.0 {
        return vec![];
    }
    let n = ((take.len() as f64) / rate).floor() as usize;
    (0..n)
        .map(|i| {
            let p = i as f64 * rate;
            let j = p.floor() as usize;
            let f = (p - j as f64) as f32;
            let a = take[j.min(take.len() - 1)];
            let b = take[(j + 1).min(take.len() - 1)];
            (a + (b - a) * f) * gain as f32
        })
        .collect()
}

/// Adds `samples` into `buf` from `offset` (the clips overlap as on a mixer).
pub fn mix_into(buf: &mut [f32], offset: usize, samples: &[f32]) {
    for (o, s) in buf.iter_mut().skip(offset).zip(samples) {
        *o += *s;
    }
}

#[cfg(feature = "sound")]
mod imp {
    use super::{render_voice, ClipBank};
    use mackeys_core::{KeySound, TrackpadSound, Voice, VoicePicker};
    use rodio::buffer::SamplesBuffer;
    use rodio::{OutputStream, OutputStreamBuilder};

    pub struct Player {
        pub enabled: bool,
        pub volume: f32,
        picker: VoicePicker,
        stream: Option<OutputStream>,
        failed: bool,
        clips: Option<ClipBank>,
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
                self.clips = Some(ClipBank::load());
            }
            true
        }

        fn play(&mut self, v: Voice, trackpad: bool) {
            let (Some(stream), Some(clips)) = (&self.stream, &self.clips) else { return };
            let Some((take, sr)) = clips.take(&v, trackpad) else { return };
            let samples = render_voice(take, v.rate, v.gain * self.volume as f64);
            if sr == 0 || samples.is_empty() {
                return;
            }
            stream.mixer().add(SamplesBuffer::new(1, sr, samples));
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
