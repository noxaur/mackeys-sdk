//! Recorded click sounds: clip decoding, take selection and the trackpad filter. Port of the
//! framework-free parts of `audio.ts`. Playback lives in the UI crate.
//!
//! Keyboard: a press, its release and a space bar, cut from a CC0 recording of a 2021 14-inch MacBook
//! Pro (Freesound #853602, "Typing on Laptop Keyboard #2" by justamudkip).
//! Trackpad: Force Touch press, release and force click, from a CC0 recording of a 2019 MacBook Pro
//! (Freesound #467490, "MacBook Pro trackpad (48/24)" by neilraouf).
use crate::controller::TrackpadSound;
use crate::keyboard::KeySound;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::OnceLock;

pub const KEYBOARD_CLIPS_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/keyboard-clicks.json"));
pub const TRACKPAD_CLIPS_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/trackpad-clicks.json"));

/// A clip set: mono 16-bit little-endian PCM, base64 encoded, at sample rate `sr`.
#[derive(Clone, Debug, PartialEq)]
pub struct ClipSet {
    pub source: String,
    pub sr: u32,
    /// Base64 takes by kind (`press`, `release`, `space`, `force`).
    pub clips: HashMap<String, Vec<String>>,
}

impl ClipSet {
    pub fn parse(json: &str) -> Result<ClipSet, serde_json::Error> {
        let v: Value = serde_json::from_str(json)?;
        let mut clips = HashMap::new();
        let mut source = String::new();
        let mut sr = 0;
        if let Value::Object(m) = v {
            for (k, val) in m {
                match (k.as_str(), val) {
                    ("source", Value::String(s)) => source = s,
                    ("sr", Value::Number(n)) => sr = n.as_u64().unwrap_or(0) as u32,
                    (_, Value::Array(a)) => {
                        clips.insert(k, a.into_iter().filter_map(|x| x.as_str().map(String::from)).collect());
                    }
                    _ => {}
                }
            }
        }
        Ok(ClipSet { source, sr, clips })
    }

    /// Decodes every take of one kind.
    pub fn decode(&self, kind: &str) -> Vec<Vec<f32>> {
        self.clips.get(kind).map(|l| l.iter().map(|b| decode_clip(b)).collect()).unwrap_or_default()
    }
}

pub fn keyboard_clips() -> &'static ClipSet {
    static C: OnceLock<ClipSet> = OnceLock::new();
    C.get_or_init(|| ClipSet::parse(KEYBOARD_CLIPS_JSON).expect("keyboard-clicks.json"))
}

pub fn trackpad_clips() -> &'static ClipSet {
    static C: OnceLock<ClipSet> = OnceLock::new();
    C.get_or_init(|| ClipSet::parse(TRACKPAD_CLIPS_JSON).expect("trackpad-clicks.json"))
}

/// Decodes standard base64 (with or without padding). Skips whitespace and unknown characters.
pub fn base64_decode(s: &str) -> Vec<u8> {
    fn val(c: u8) -> Option<u32> {
        match c {
            b'A'..=b'Z' => Some((c - b'A') as u32),
            b'a'..=b'z' => Some((c - b'a') as u32 + 26),
            b'0'..=b'9' => Some((c - b'0') as u32 + 52),
            b'+' | b'-' => Some(62),
            b'/' | b'_' => Some(63),
            _ => None,
        }
    }
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut acc = 0u32;
    let mut bits = 0;
    for &c in s.as_bytes() {
        if c == b'=' {
            break;
        }
        if let Some(v) = val(c) {
            acc = (acc << 6) | v;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push((acc >> bits) as u8);
                acc &= (1 << bits) - 1;
            }
        }
    }
    out
}

/// Decodes one base64 clip to float samples in -1..1.
pub fn decode_clip(b64: &str) -> Vec<f32> {
    let bytes = base64_decode(b64);
    let (pairs, _) = bytes.as_chunks::<2>();
    pairs.iter().map(|p| i16::from_le_bytes(*p) as f32 / 32768.0).collect()
}

/// A small xorshift random source, so the crate needs no `rand` dependency.
#[derive(Clone, Debug)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed.max(1))
    }

    /// Seeds from the system clock.
    pub fn from_time() -> Self {
        let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(1);
        Rng::new(t ^ 0x9e37_79b9_7f4a_7c15)
    }

    /// A float in `0..1`.
    pub fn next_f64(&mut self) -> f64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        (x >> 11) as f64 / (1u64 << 53) as f64
    }
}

/// One click to play: which take, at what playback rate and gain.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Voice {
    /// `press`, `release`, `space` (keyboard) or `press`, `release`, `force` (trackpad).
    pub kind: &'static str,
    pub take: usize,
    pub rate: f64,
    pub gain: f64,
}

/// Picks keyboard takes: never the same index twice in a row, rate `0.985 + rand * 0.03`, gain
/// `0.85 * (0.85 + rand * 0.15)`.
#[derive(Clone, Debug)]
pub struct VoicePicker {
    rng: Rng,
    last_key: Option<usize>,
}

impl Default for VoicePicker {
    fn default() -> Self {
        VoicePicker { rng: Rng::from_time(), last_key: None }
    }
}

impl VoicePicker {
    pub fn with_seed(seed: u64) -> Self {
        VoicePicker { rng: Rng::new(seed), last_key: None }
    }

    pub fn key(&mut self, kind: KeySound, up: bool) -> Voice {
        let name = if up {
            "release"
        } else if kind == KeySound::Space {
            "space"
        } else {
            "press"
        };
        let n = keyboard_clips().clips.get(name).map(|l| l.len()).unwrap_or(1).max(1);
        let mut i = (self.rng.next_f64() * n as f64) as usize % n;
        if n > 1 && Some(i) == self.last_key {
            i = (i + 1) % n;
        }
        self.last_key = Some(i);
        let rate = 0.985 + self.rng.next_f64() * 0.03;
        let gain = 0.85 * (0.85 + self.rng.next_f64() * 0.15);
        Voice { kind: name, take: i, rate, gain }
    }

    /// Trackpad: rate `(force ? 0.9 : 1) * (0.99 + rand * 0.02)`, gain `force ? 0.85 : 0.75`.
    pub fn trackpad(&mut self, kind: TrackpadSound) -> Voice {
        let name = match kind {
            TrackpadSound::Press => "press",
            TrackpadSound::Release => "release",
            TrackpadSound::Force => "force",
        };
        let n = trackpad_clips().clips.get(name).map(|l| l.len()).unwrap_or(1).max(1);
        let i = (self.rng.next_f64() * n as f64) as usize % n;
        let force = kind == TrackpadSound::Force;
        let rate = (if force { 0.9 } else { 1.0 }) * (0.99 + self.rng.next_f64() * 0.02);
        Voice { kind: name, take: i, rate, gain: if force { 0.85 } else { 0.75 } }
    }
}

/// An RBJ biquad filter (Web Audio `BiquadFilterNode` formulas).
#[derive(Clone, Copy, Debug)]
pub struct Biquad {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    x1: f64,
    x2: f64,
    y1: f64,
    y2: f64,
}

impl Biquad {
    fn from(b0: f64, b1: f64, b2: f64, a0: f64, a1: f64, a2: f64) -> Self {
        Biquad { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0.0, x2: 0.0, y1: 0.0, y2: 0.0 }
    }

    /// Low-pass with resonance `q` in dB, as Web Audio defines it.
    pub fn lowpass(sr: f64, freq: f64, q_db: f64) -> Self {
        let w0 = 2.0 * std::f64::consts::PI * freq / sr;
        let q = 10f64.powf(q_db / 20.0);
        let alpha = w0.sin() / (2.0 * q);
        let c = w0.cos();
        Self::from((1.0 - c) / 2.0, 1.0 - c, (1.0 - c) / 2.0, 1.0 + alpha, -2.0 * c, 1.0 - alpha)
    }

    /// High shelf with slope 1 and `gain_db`.
    pub fn highshelf(sr: f64, freq: f64, gain_db: f64) -> Self {
        let a = 10f64.powf(gain_db / 40.0);
        let w0 = 2.0 * std::f64::consts::PI * freq / sr;
        let c = w0.cos();
        // Shelf slope S = 1: alpha = sin(w0) / 2 * sqrt((A + 1/A) * (1/S - 1) + 2) = sin(w0) / 2 * sqrt(2).
        let alpha = w0.sin() / 2.0 * std::f64::consts::SQRT_2;
        let sa = 2.0 * a.sqrt() * alpha;
        Self::from(
            a * ((a + 1.0) + (a - 1.0) * c + sa),
            -2.0 * a * ((a - 1.0) + (a + 1.0) * c),
            a * ((a + 1.0) + (a - 1.0) * c - sa),
            (a + 1.0) - (a - 1.0) * c + sa,
            2.0 * ((a - 1.0) - (a + 1.0) * c),
            (a + 1.0) - (a - 1.0) * c - sa,
        )
    }

    pub fn process(&mut self, x: f64) -> f64 {
        let y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;
        y
    }
}

/// The trackpad filter: high shelf at 2 kHz, -14 dB, then low-pass at 5 kHz, Q 0.5.
pub fn filter_trackpad_clip(samples: &[f32], sr: f64) -> Vec<f32> {
    let mut shelf = Biquad::highshelf(sr, 2000.0, -14.0);
    let mut lp = Biquad::lowpass(sr, 5000.0, 0.5);
    samples.iter().map(|&s| lp.process(shelf.process(s as f64)) as f32).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64() {
        assert_eq!(base64_decode("TWFu"), b"Man");
        assert_eq!(base64_decode("TWE="), b"Ma");
        assert_eq!(base64_decode("TQ=="), b"M");
        // 0x0080 and 0xff7f little endian: 128 and -129.
        assert_eq!(decode_clip("gAB//w=="), vec![128.0 / 32768.0, -129.0 / 32768.0]);
    }

    #[test]
    fn clips() {
        let k = keyboard_clips();
        assert_eq!(k.sr, 24000);
        assert_eq!(k.clips["press"].len(), 6);
        assert_eq!(k.decode("press")[0].len(), 4480 / 4 * 3 / 2);
        let t = trackpad_clips();
        assert_eq!(t.sr, 48000);
        assert_eq!(t.clips["force"].len(), 1);
        let f = filter_trackpad_clip(&t.decode("press")[0], 48000.0);
        assert!(f.iter().all(|v| v.is_finite()));
    }

    #[test]
    fn picker_never_repeats() {
        let mut p = VoicePicker::with_seed(7);
        let mut last = None;
        for _ in 0..200 {
            let v = p.key(KeySound::Key, false);
            assert_ne!(Some(v.take), last);
            assert!(v.rate >= 0.985 && v.rate <= 1.015);
            last = Some(v.take);
        }
    }
}
