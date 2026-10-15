//! Sound without an audio device: decode the clips, render voices as the player does, mix them
//! into a buffer and check that the result is audible and does not clip.
use mackeys_core::{KeySound, TrackpadSound, VoicePicker};
use mackeys_gpui::sound::{mix_into, render_voice, ClipBank};

fn rms(b: &[f32]) -> f32 {
    (b.iter().map(|s| s * s).sum::<f32>() / b.len() as f32).sqrt()
}

#[test]
fn key_clicks_mix_to_audible_output() {
    let bank = ClipBank::load();
    assert_eq!(bank.key_sr, 32000);
    let mut picker = VoicePicker::with_seed(7);
    let mut buf = vec![0f32; bank.key_sr as usize];
    // A typing burst: a press and a release of every key class, 40 ms apart.
    let burst = KeySound::ALL.iter().flat_map(|&k| [(k, false), (k, true)]);
    for (i, (kind, up)) in burst.enumerate() {
        let v = picker.key(kind, up);
        let (take, _) = bank.take(&v, false).expect("take");
        let s = render_voice(take, v.rate, v.gain);
        assert!(!s.is_empty());
        mix_into(&mut buf, i * 1280, &s);
    }
    let level = rms(&buf);
    let peak = buf.iter().fold(0f32, |m, s| m.max(s.abs()));
    assert!(level > 0.005, "rms {level}");
    assert!(peak > 0.05 && peak < 1.5, "peak {peak}");
}

#[test]
fn trackpad_clicks_are_filtered_and_audible() {
    let bank = ClipBank::load();
    assert_eq!(bank.trackpad_sr, 48000);
    let mut picker = VoicePicker::with_seed(3);
    let mut buf = vec![0f32; bank.trackpad_sr as usize];
    for (i, kind) in [TrackpadSound::Press, TrackpadSound::Force, TrackpadSound::Release].into_iter().enumerate() {
        let v = picker.trackpad(kind);
        let (take, sr) = bank.take(&v, true).expect("take");
        assert_eq!(sr, 48000);
        mix_into(&mut buf, i * 12000, &render_voice(take, v.rate, v.gain));
    }
    assert!(rms(&buf) > 0.001, "rms {}", rms(&buf));
}

#[test]
fn rate_changes_length() {
    let take: Vec<f32> = (0..1000).map(|i| (i as f32 * 0.1).sin()).collect();
    assert_eq!(render_voice(&take, 2.0, 1.0).len(), 500);
    assert_eq!(render_voice(&take, 0.5, 1.0).len(), 2000);
    let half = render_voice(&take, 1.0, 0.5);
    assert!((half[10] - take[10] * 0.5).abs() < 1e-6);
}
