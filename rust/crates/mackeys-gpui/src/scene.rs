//! A device as a list of positioned raster layers. The GPUI views draw these layers with `img()`, and
//! the offscreen renderer ([`compose`]) draws the same layers with `tiny-skia`, so both show the same
//! pixels.
use crate::art;
use crate::raster::{art, Art};
use mackeys_core::{Gradient, KeyCap, KeyboardGeometry, KeyboardTheme, Shadow, TopCaseGeometry, TrackpadGeometry, TrackpadPhase};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Room above the deck for the open lid (CSS px).
pub const LID_SPACE: f64 = 200.0;
/// Room left and right of the deck for the open lid.
pub const LID_SIDE: f64 = 120.0;

/// One image, its rectangle in CSS px (relative to the view's top-left corner) and its opacity.
#[derive(Clone, Debug)]
pub struct Layer {
    pub art: Arc<Art>,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub opacity: f32,
}

impl Layer {
    /// Places `art` with its frame moved by (`ox`, `oy`).
    pub fn at(art: Arc<Art>, ox: f64, oy: f64) -> Layer {
        let f = art.frame;
        Layer { x: f.x + ox, y: f.y + oy, w: f.w, h: f.h, opacity: 1.0, art }
    }

    /// Scales the rectangle by `k` around (`cx`, `cy`) and moves it by `dy`.
    pub fn scaled(mut self, cx: f64, cy: f64, k: f64, dy: f64) -> Layer {
        self.x = cx + (self.x - cx) * k;
        self.y = cy + (self.y - cy) * k + dy;
        self.w *= k;
        self.h *= k;
        self
    }

    pub fn opacity(mut self, o: f64) -> Layer {
        self.opacity = o.clamp(0.0, 1.0) as f32;
        self
    }
}

/// The CSS `cubic-bezier(x1, y1, x2, y2)` timing function at `t` (0 to 1).
pub fn cubic_bezier(x1: f64, y1: f64, x2: f64, y2: f64, t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    let bez = |a: f64, b: f64, s: f64| 3.0 * a * s * (1.0 - s).powi(2) + 3.0 * b * s * s * (1.0 - s) + s.powi(3);
    // Solve x(s) = t by bisection.
    let (mut lo, mut hi) = (0.0, 1.0);
    for _ in 0..40 {
        let mid = (lo + hi) / 2.0;
        if bez(x1, x2, mid) < t {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    bez(y1, y2, (lo + hi) / 2.0)
}

/// A value that moves to a target over a time (a CSS transition).
#[derive(Clone, Copy, Debug)]
pub struct Tween {
    from: f64,
    to: f64,
    start: Instant,
    dur: Duration,
}

impl Tween {
    pub fn still(v: f64) -> Self {
        Tween { from: v, to: v, start: Instant::now(), dur: Duration::ZERO }
    }

    /// The value at `now`, with the key transition curve `cubic-bezier(.2, .75, .3, 1)`.
    pub fn value(&self, now: Instant) -> f64 {
        if self.dur.is_zero() {
            return self.to;
        }
        let t = now.saturating_duration_since(self.start).as_secs_f64() / self.dur.as_secs_f64();
        if t >= 1.0 {
            return self.to;
        }
        self.from + (self.to - self.from) * cubic_bezier(0.2, 0.75, 0.3, 1.0, t)
    }

    pub fn target(&self) -> f64 {
        self.to
    }

    /// Starts a move from the current value to `to`. Does nothing when `to` is the target already.
    pub fn go(&mut self, to: f64, dur: Duration, now: Instant) {
        if (self.to - to).abs() < 1e-9 {
            return;
        }
        *self = Tween { from: self.value(now), to, start: now, dur };
    }

    pub fn running(&self, now: Instant) -> bool {
        !self.dur.is_zero() && now.saturating_duration_since(self.start) < self.dur
    }
}

/// Press in 26 ms, release in 95 ms (`.mk-k`).
pub const KEY_PRESS: Duration = Duration::from_millis(26);
pub const KEY_RELEASE: Duration = Duration::from_millis(95);
/// Trackpad: press in 35 ms, release in 140 ms (`.mk-tp`).
pub const PAD_PRESS: Duration = Duration::from_millis(35);
pub const PAD_RELEASE: Duration = Duration::from_millis(140);

/// The depth of a trackpad phase: up 0, down 1, force 2.
pub fn phase_depth(p: TrackpadPhase) -> f64 {
    match p {
        TrackpadPhase::Up => 0.0,
        TrackpadPhase::Down => 1.0,
        TrackpadPhase::Force => 2.0,
    }
}

/// The layers of one key at press amount `p` (0 up, 1 down), with the keyboard origin at (`ox`,
/// `oy`). Between 0 and 1, the pressed image fades in over the released one, and the cap moves down
/// 0.45 px and shrinks to 0.986.
#[allow(clippy::too_many_arguments)]
pub fn key_layers(k: &KeyCap, t: &KeyboardTheme, caps: bool, light_keys: bool, p: f64, ox: f64, oy: f64, scale: f64, out: &mut Vec<Layer>) {
    // Browsers snap box edges to device pixels; so do we.
    let snap = |v: f64| (v * scale).round() / scale;
    let (kx, ky) = (snap(ox + k.x), snap(oy + k.y));
    let (w, h) = (snap(ox + k.x + k.w) - kx, snap(oy + k.y + k.h) - ky);
    let snapped;
    let k = if (w - k.w).abs() > 1e-9 || (h - k.h).abs() > 1e-9 {
        snapped = KeyCap { w, h, ..k.clone() };
        &snapped
    } else {
        k
    };
    let (cx, cy) = (kx + k.w / 2.0, ky + k.h / 2.0);
    let sc = 1.0 - 0.014 * p;
    let dy = 0.45 * p;
    let mut put = |pressed: bool, o: f64| {
        let b = if pressed { t.pressed_brightness } else { 1.0 };
        let face = art(art::key_face(k, t, pressed, light_keys), scale, b);
        let content = art(art::key_content(k, t, caps, scale), scale, b);
        out.push(Layer::at(face, kx, ky).scaled(cx, cy, sc, dy).opacity(o));
        out.push(Layer::at(content, kx, ky).scaled(cx, cy, sc, dy).opacity(o));
    };
    if p < 1.0 {
        put(false, 1.0);
    }
    if p > 0.0 {
        put(true, if p < 1.0 { p } else { 1.0 });
    }
}

/// The trackpad glass at `depth` (0 up, 1 down, 2 force) with its top-left corner at (`x`, `y`).
#[allow(clippy::too_many_arguments)]
pub fn pad_layers(surface: &Gradient, shadows: &[Shadow], radius: f64, w: f64, h: f64, grain: f64, depth: f64, x: f64, y: f64, scale: f64, out: &mut Vec<Layer>) {
    let depth = depth.clamp(0.0, 2.0);
    let phases = [(TrackpadPhase::Up, 0.0, 1.0), (TrackpadPhase::Down, 1.0, 0.97), (TrackpadPhase::Force, 1.8, 0.94)];
    let lo = depth.floor().min(1.0) as usize;
    let f = depth - lo as f64;
    let dy = phases[lo].1 + (phases[lo + 1].1 - phases[lo].1) * f;
    for (i, o) in [(lo, 1.0), (lo + 1, f)] {
        if o <= 0.0 {
            continue;
        }
        let (ph, _, b) = phases[i];
        let a = crate::raster::pad_art(surface, shadows, radius, w, h, grain, ph, scale, b);
        out.push(Layer::at(a, x, y + dy).opacity(o));
    }
}

/// What a keyboard or MacBook view shows.
pub struct DeviceScene<'a> {
    pub kb: &'a KeyboardGeometry,
    pub tc: &'a TopCaseGeometry,
    pub theme: &'a KeyboardTheme,
    pub caps: bool,
    pub pad_surface: &'a Gradient,
    pub pad_shadows: &'a [Shadow],
    /// Trackpad depth: 0 up, 1 down, 2 force.
    pub pad_depth: f64,
    /// Draw the open lid (MacBook finishes with a full top case only).
    pub lid: bool,
    /// Device pixels per CSS px.
    pub scale: f64,
}

impl DeviceScene<'_> {
    /// Where the deck's top-left corner is in the view.
    pub fn origin(&self) -> (f64, f64) {
        if self.lid {
            (LID_SIDE, LID_SPACE)
        } else {
            (0.0, 0.0)
        }
    }

    /// The view size in CSS px.
    pub fn size(&self) -> (f64, f64) {
        let (ox, oy) = self.origin();
        (self.tc.width + 2.0 * ox, self.tc.height + 10.0 + oy)
    }

    /// The layers, back to front. `press` gives each key's press amount (0 to 1).
    pub fn layers(&self, press: impl Fn(&KeyCap) -> f64) -> Vec<Layer> {
        let (ox, oy) = self.origin();
        let mut out = vec![];
        if self.lid {
            out.push(Layer::at(crate::lid::lid_art(&self.kb.finish, self.tc.width, self.tc.height, self.scale), ox, oy));
        }
        let (base, well) = crate::raster::top_case_art(self.tc, self.scale);
        out.push(Layer::at(base, ox, oy));
        if let Some(tp) = &self.tc.trackpad {
            pad_layers(self.pad_surface, self.pad_shadows, tp.radius, tp.w, tp.h, 0.0, self.pad_depth, ox + tp.x, oy + tp.y, self.scale, &mut out);
        }
        out.push(Layer::at(well, ox, oy));
        let (kx, ky) = (ox + self.tc.keyboard.x, oy + self.tc.keyboard.y);
        for k in &self.kb.keys {
            key_layers(k, self.theme, self.caps, self.kb.light_keys, press(k), kx, ky, self.scale, &mut out);
        }
        out
    }
}

/// The layers of a standalone trackpad at `depth`.
pub fn trackpad_layers(tp: &TrackpadGeometry, depth: f64, scale: f64) -> Vec<Layer> {
    let (far, side) = art::pad_side(tp);
    let mut out = vec![Layer::at(crate::raster::art_with_far(far, side, scale), 0.0, 0.0)];
    pad_layers(&tp.surface, &tp.shadows, tp.radius, tp.width, tp.height, tp.grain, depth, 0.0, 0.0, scale, &mut out);
    out
}

/// Draws layers onto a new pixmap of `w` x `h` CSS px at `scale`, over `background` (`#rrggbbaa`),
/// with the layers moved by (`ox`, `oy`).
pub fn compose(layers: &[Layer], w: f64, h: f64, scale: f64, background: &str, ox: f64, oy: f64) -> tiny_skia::Pixmap {
    let mut pm = tiny_skia::Pixmap::new((w * scale).round() as u32, (h * scale).round() as u32).expect("pixmap size");
    let c = mackeys_core::to_rgba(background);
    pm.fill(tiny_skia::Color::from_rgba8(c.r as u8, c.g as u8, c.b as u8, (c.a * 255.0).round() as u8));
    for l in layers {
        let src = &l.art.pixmap;
        let sx = (l.w * scale) / src.width() as f64;
        let sy = (l.h * scale) / src.height() as f64;
        let tr = tiny_skia::Transform::from_row(sx as f32, 0.0, 0.0, sy as f32, ((l.x + ox) * scale) as f32, ((l.y + oy) * scale) as f32);
        let paint = tiny_skia::PixmapPaint { opacity: l.opacity, quality: tiny_skia::FilterQuality::Bilinear, ..Default::default() };
        pm.draw_pixmap(0, 0, src.as_ref(), &paint, tr, None);
    }
    pm
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bezier_ends() {
        assert!(cubic_bezier(0.2, 0.75, 0.3, 1.0, 0.0).abs() < 1e-6);
        assert!((cubic_bezier(0.2, 0.75, 0.3, 1.0, 1.0) - 1.0).abs() < 1e-6);
        assert!(cubic_bezier(0.2, 0.75, 0.3, 1.0, 0.5) > 0.8);
    }

    #[test]
    fn tween_moves() {
        let t0 = Instant::now();
        let mut t = Tween::still(0.0);
        t.go(1.0, KEY_PRESS, t0);
        assert!(t.value(t0) < 0.01);
        assert!(t.running(t0 + Duration::from_millis(10)));
        assert_eq!(t.value(t0 + Duration::from_millis(30)), 1.0);
        t.go(0.0, KEY_RELEASE, t0 + Duration::from_millis(30));
        assert!(t.value(t0 + Duration::from_millis(60)) > 0.0);
        assert_eq!(t.value(t0 + Duration::from_millis(200)), 0.0);
    }
}
