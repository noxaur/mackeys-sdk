//! Full-color art as SVG documents: key cap faces and their contents, the top case, the trackpad and
//! the lid. `raster.rs` turns each document into pixels with `resvg`.
//!
//! Every document covers a rectangle in CSS px at scale 1 (`Doc::x`, `y`, `w`, `h`). The rectangle is
//! larger than the part, so shadows and glows fit. The scene places the raster image over that
//! rectangle. The SVG follows `MACKEYS_CSS` in `packages/core/src/dom.ts`:
//!
//! - CSS box shadows: an outer shadow is the shape, moved, grown by the spread and blurred with a
//!   Gaussian of sigma = blur / 2. An inset shadow is a frame (a large rect with the moved, shrunk
//!   shape cut out), blurred, then clipped to the shape. CSS draws the first shadow on top.
//! - Radial gradients use `gradientTransform` for the CSS ellipse size.
//! - Text is shaped by [`crate::text`] into paths, so letter spacing and glow filters work.
use crate::text::{self, TextStyle};
use mackeys_core::{
    fmt, to_rgba, Align, Gradient, KeyCap, KeyboardTheme, Shadow, TextGlow, TopCaseGeometry, TouchIdStyle,
    TrackpadGeometry, TrackpadPhase,
};
use std::fmt::Write as _;

/// An SVG document in progress, over the rectangle `x, y, w, h` (CSS px).
pub struct Doc {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    defs: String,
    body: String,
    next: u32,
    blurs: Vec<(String, String)>,
}

/// Returns `fill="#rrggbb" fill-opacity="a"` for a `#rrggbbaa` color, with RGB multiplied by `k`.
pub fn fill(c: &str, k: f64) -> String {
    let (rgb, a) = rgb_a(c, k);
    if a >= 1.0 {
        format!(r#"fill="{rgb}""#)
    } else {
        format!(r#"fill="{rgb}" fill-opacity="{}""#, fmt(a))
    }
}

fn stroke(c: &str, k: f64, width: f64) -> String {
    let (rgb, a) = rgb_a(c, k);
    format!(r#"fill="none" stroke="{rgb}" stroke-opacity="{}" stroke-width="{}""#, fmt(a), fmt(width))
}

/// `#rrggbb` (RGB times `k`) and alpha of a color.
pub fn rgb_a(c: &str, k: f64) -> (String, f64) {
    let p = to_rgba(c);
    let ch = |v: f64| (v * k).round().clamp(0.0, 255.0) as u8;
    (format!("#{:02x}{:02x}{:02x}", ch(p.r), ch(p.g), ch(p.b)), p.a.clamp(0.0, 1.0))
}

fn stop(at: f64, c: &str, k: f64) -> String {
    let (rgb, a) = rgb_a(c, k);
    format!(r#"<stop offset="{}" stop-color="{rgb}" stop-opacity="{}"/>"#, fmt(at.clamp(0.0, 1.0)), fmt(a))
}

/// A rounded rect: position, size and corner radii (top-left, top-right, bottom-right, bottom-left).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shape {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub r: [f64; 4],
}

impl Shape {
    pub fn new(x: f64, y: f64, w: f64, h: f64, r: f64) -> Self {
        Shape { x, y, w, h, r: [r; 4] }
    }
    pub fn radii(x: f64, y: f64, w: f64, h: f64, r: [f64; 4]) -> Self {
        Shape { x, y, w, h, r }
    }
    /// Moved by (`dx`, `dy`) and grown by `g` on every side (negative shrinks). Radii follow the CSS
    /// shadow rule: a radius grows with the spread, and a zero radius stays zero.
    pub fn grow(&self, dx: f64, dy: f64, g: f64) -> Shape {
        let r = self.r.map(|r| if r > 0.0 { (r + g).max(0.0) } else { 0.0 });
        Shape { x: self.x + dx - g, y: self.y + dy - g, w: (self.w + 2.0 * g).max(0.0), h: (self.h + 2.0 * g).max(0.0), r }
    }
    /// The SVG path. Radii scale down as in CSS when they do not fit.
    pub fn path(&self) -> String {
        let Shape { x, y, w, h, r } = *self;
        if w <= 0.0 || h <= 0.0 {
            return String::new();
        }
        let mut f: f64 = 1.0;
        for (a, b, side) in [(r[0], r[1], w), (r[3], r[2], w), (r[0], r[3], h), (r[1], r[2], h)] {
            if a + b > side && a + b > 0.0 {
                f = f.min(side / (a + b));
            }
        }
        let [tl, tr, br, bl] = r.map(|v| (v * f).max(0.0));
        let n = fmt;
        let mut d = format!("M{} {}", n(x + tl), n(y));
        let _ = write!(d, "H{}", n(x + w - tr));
        if tr > 0.0 {
            let _ = write!(d, "A{0} {0} 0 0 1 {1} {2}", n(tr), n(x + w), n(y + tr));
        }
        let _ = write!(d, "V{}", n(y + h - br));
        if br > 0.0 {
            let _ = write!(d, "A{0} {0} 0 0 1 {1} {2}", n(br), n(x + w - br), n(y + h));
        }
        let _ = write!(d, "H{}", n(x + bl));
        if bl > 0.0 {
            let _ = write!(d, "A{0} {0} 0 0 1 {1} {2}", n(bl), n(x), n(y + h - bl));
        }
        let _ = write!(d, "V{}", n(y + tl));
        if tl > 0.0 {
            let _ = write!(d, "A{0} {0} 0 0 1 {1} {2}", n(tl), n(x + tl), n(y));
        }
        d.push('Z');
        d
    }
}

impl Shape {
    /// The rounded rect as a convex polygon (corners in steps of at most 5.6 degrees).
    pub fn polygon(&self) -> Vec<(f64, f64)> {
        let Shape { x, y, w, h, r } = *self;
        if w <= 0.0 || h <= 0.0 {
            return vec![];
        }
        let mut f: f64 = 1.0;
        for (a, b, side) in [(r[0], r[1], w), (r[3], r[2], w), (r[0], r[3], h), (r[1], r[2], h)] {
            if a + b > side && a + b > 0.0 {
                f = f.min(side / (a + b));
            }
        }
        let [tl, tr, br, bl] = r.map(|v| (v * f).max(0.0));
        let mut out = vec![];
        let mut corner = |cx: f64, cy: f64, rad: f64, a0: f64| {
            if rad <= 0.0 {
                out.push((cx, cy));
                return;
            }
            let n = 16;
            for i in 0..=n {
                let a = (a0 + 90.0 * i as f64 / n as f64).to_radians();
                out.push((cx + rad * a.cos(), cy + rad * a.sin()));
            }
        };
        corner(x + tl, y + tl, tl, 180.0);
        corner(x + w - tr, y + tr, tr, 270.0);
        corner(x + w - br, y + h - br, br, 0.0);
        corner(x + bl, y + h - bl, bl, 90.0);
        out
    }
}

/// Cuts a convex polygon to a rect (x, y, w, h) (Sutherland-Hodgman).
pub fn clip_poly(poly: &[(f64, f64)], r: (f64, f64, f64, f64)) -> Vec<(f64, f64)> {
    let (x0, y0, x1, y1) = (r.0, r.1, r.0 + r.2, r.1 + r.3);
    let mut pts = poly.to_vec();
    let edges: [(usize, f64, bool); 4] = [(0, x0, true), (0, x1, false), (1, y0, true), (1, y1, false)];
    for (axis, v, keep_greater) in edges {
        if pts.is_empty() {
            break;
        }
        let inside = |p: &(f64, f64)| {
            let c = if axis == 0 { p.0 } else { p.1 };
            if keep_greater {
                c >= v
            } else {
                c <= v
            }
        };
        let mut out = vec![];
        for i in 0..pts.len() {
            let a = pts[i];
            let b = pts[(i + 1) % pts.len()];
            let (ia, ib) = (inside(&a), inside(&b));
            if ia {
                out.push(a);
            }
            if ia != ib {
                let (ca, cb) = if axis == 0 { (a.0, b.0) } else { (a.1, b.1) };
                let t = (v - ca) / (cb - ca);
                out.push((a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t));
            }
        }
        pts = out;
    }
    pts
}

/// A closed SVG path through the points.
pub fn poly_path(p: &[(f64, f64)]) -> String {
    if p.len() < 3 {
        return String::new();
    }
    let mut d = String::new();
    for (i, (x, y)) in p.iter().enumerate() {
        let _ = write!(d, "{}{} {}", if i == 0 { 'M' } else { 'L' }, fmt(*x), fmt(*y));
    }
    d.push('Z');
    d
}

/// How far outer shadows reach past a shape.
pub fn shadow_reach(list: &[Shadow]) -> f64 {
    list.iter().filter(|s| !s.inset).map(|s| s.blur * 1.5 + s.x.abs().max(s.y.abs()) + s.spread.max(0.0)).fold(0.0, f64::max)
}

impl Doc {
    pub fn new(x: f64, y: f64, w: f64, h: f64) -> Self {
        Doc { x, y, w, h, defs: String::new(), body: String::new(), next: 0, blurs: vec![] }
    }

    /// A document over `w` x `h` with `m` px of room on every side.
    /// The margin is rounded up to whole px, so the part stays on the pixel grid of its image.
    pub fn with_margin(w: f64, h: f64, m: f64) -> Self {
        let m = m.ceil();
        Doc::new(-m, -m, w + 2.0 * m, h + 2.0 * m)
    }

    pub fn id(&mut self, prefix: &str) -> String {
        self.next += 1;
        format!("{prefix}{}", self.next)
    }

    pub fn def(&mut self, s: &str) {
        self.defs.push_str(s);
    }

    pub fn push(&mut self, s: &str) {
        self.body.push_str(s);
    }

    /// The region attributes that make a filter cover the whole document.
    fn region(&self) -> String {
        format!(r#"filterUnits="userSpaceOnUse" x="{}" y="{}" width="{}" height="{}""#, fmt(self.x), fmt(self.y), fmt(self.w), fmt(self.h))
    }

    /// A Gaussian blur filter with standard deviation `sigma` (CSS blur radius / 2). Returns its id.
    pub fn blur(&mut self, sigma: f64) -> String {
        self.blur_xy(sigma, sigma)
    }

    pub fn blur_xy(&mut self, sx: f64, sy: f64) -> String {
        let region = self.region();
        self.blur_region(sx, sy, region)
    }

    /// A blur filter whose region is the box `b` grown by three sigmas (faster than the whole
    /// document for small shapes).
    pub fn blur_in(&mut self, sigma: f64, b: (f64, f64, f64, f64)) -> String {
        let m = sigma * 3.0 + 2.0;
        let region = format!(
            r#"filterUnits="userSpaceOnUse" x="{}" y="{}" width="{}" height="{}""#,
            fmt(b.0 - m),
            fmt(b.1 - m),
            fmt(b.2 + 2.0 * m),
            fmt(b.3 + 2.0 * m)
        );
        self.blur_region(sigma, sigma, region)
    }

    fn blur_region(&mut self, sx: f64, sy: f64, region: String) -> String {
        let key = format!("{} {}|{region}", fmt(sx), fmt(sy));
        if let Some((_, id)) = self.blurs.iter().find(|(k, _)| *k == key) {
            return id.clone();
        }
        let id = self.id("b");
        let def = format!(
            r#"<filter id="{id}" {region} color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="{} {}"/></filter>"#,
            fmt(sx),
            fmt(sy)
        );
        self.def(&def);
        self.blurs.push((key, id.clone()));
        id
    }

    /// A clip path of `d`. Returns its id.
    pub fn clip(&mut self, d: &str) -> String {
        let id = self.id("c");
        self.def(&format!(r#"<clipPath id="{id}"><path d="{d}"/></clipPath>"#));
        id
    }

    /// A vertical linear gradient (top to bottom over the bounding box). Returns its id.
    pub fn vgrad(&mut self, g: &Gradient, k: f64) -> String {
        let id = self.id("g");
        let stops: String = g.stops.iter().map(|s| stop(s.at, &s.color, k)).collect();
        self.def(&format!(r#"<linearGradient id="{id}" x1="0" y1="0" x2="0" y2="1">{stops}</linearGradient>"#));
        id
    }

    /// A CSS `linear-gradient(<angle>deg, ...)` over the box `s`. Returns its id.
    pub fn css_linear(&mut self, angle_deg: f64, stops: &[(String, f64)], s: (f64, f64, f64, f64)) -> String {
        let (x, y, w, h) = s;
        let a = angle_deg.to_radians();
        let (dx, dy) = (a.sin(), -a.cos());
        let len = (w * a.sin()).abs() + (h * a.cos()).abs();
        let (cx, cy) = (x + w / 2.0, y + h / 2.0);
        let id = self.id("g");
        let st: String = stops.iter().map(|(c, at)| stop(*at, c, 1.0)).collect();
        self.def(&format!(
            r#"<linearGradient id="{id}" gradientUnits="userSpaceOnUse" x1="{}" y1="{}" x2="{}" y2="{}">{st}</linearGradient>"#,
            fmt(cx - dx * len / 2.0),
            fmt(cy - dy * len / 2.0),
            fmt(cx + dx * len / 2.0),
            fmt(cy + dy * len / 2.0)
        ));
        id
    }

    /// A CSS `radial-gradient(rx ry at cx cy, ...)` in user space (ellipse radii in px). Returns its id.
    pub fn css_radial(&mut self, cx: f64, cy: f64, rx: f64, ry: f64, stops: &[(String, f64)]) -> String {
        let id = self.id("g");
        let st: String = stops.iter().map(|(c, at)| stop(*at, c, 1.0)).collect();
        let ry = ry.max(0.001);
        self.def(&format!(
            r#"<radialGradient id="{id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate({} {}) scale({} {})">{st}</radialGradient>"#,
            fmt(cx),
            fmt(cy),
            fmt(rx),
            fmt(ry)
        ));
        id
    }

    /// The bands along the edges of `s` that a shadow can change: `t` px on both sides of each edge.
    /// A small shape gets one band (its box grown by `t`).
    fn bands(s: &Shape, t: f64) -> Vec<(f64, f64, f64, f64)> {
        let (bx, by, bw, bh) = (s.x, s.y, s.w, s.h);
        if bw <= 4.0 * t || bh <= 4.0 * t {
            vec![(bx - t, by - t, bw + 2.0 * t, bh + 2.0 * t)]
        } else {
            vec![
                (bx - t, by - t, bw + 2.0 * t, 2.0 * t),
                (bx - t, by + bh - t, bw + 2.0 * t, 2.0 * t),
                (bx - t, by + t, 2.0 * t, bh - 2.0 * t),
                (bx + bw - t, by + t, 2.0 * t, bh - 2.0 * t),
            ]
        }
    }

    /// Outer CSS box shadows of `s`, last first (CSS paints the first on top). As in CSS, they are
    /// clipped to the outside of the box.
    ///
    /// Every shadow is drawn in bands along the edges of the box, with geometry cut to each band.
    /// This keeps resvg's layers and filter regions small (a shadow does not change the inside of
    /// a large box, and the box hides it there).
    pub fn outer_shadows(&mut self, s: &Shape, list: &[Shadow], k: f64) {
        for sh in list.iter().rev().filter(|sh| !sh.inset && to_rgba(&sh.color).a > 0.0) {
            let g = s.grow(sh.x, sh.y, sh.spread);
            if g.w <= 0.0 || g.h <= 0.0 {
                continue;
            }
            let sigma = sh.blur / 2.0;
            let rmax = s.r.iter().chain(g.r.iter()).cloned().fold(0.0, f64::max);
            let t = sh.x.abs() + sh.y.abs() + sh.spread.abs() + 3.0 * sigma + 2.0 + 0.3 * rmax;
            for band in Self::bands(s, t) {
                let m = 3.0 * sigma + 1.0;
                let wide = (band.0 - m, band.1 - m, band.2 + 2.0 * m, band.3 + 2.0 * m);
                let shadow = poly_path(&clip_poly(&g.polygon(), wide));
                if shadow.is_empty() {
                    continue;
                }
                let inner = poly_path(&clip_poly(&s.polygon(), band));
                let bandp = Shape::new(band.0, band.1, band.2, band.3, 0.0).path();
                let cid = self.id("c");
                self.def(&format!(r#"<clipPath id="{cid}"><path d="{bandp}{inner}" clip-rule="evenodd"/></clipPath>"#));
                let f = if sigma > 0.0 { format!(r#" filter="url(#{})""#, self.blur_in(sigma, band)) } else { String::new() };
                self.push(&format!(r#"<g clip-path="url(#{cid})"><path d="{shadow}" {}{f}/></g>"#, fill(&sh.color, k)));
            }
        }
    }

    /// Inset CSS box shadows of `s`, last first. Drawn in bands, as [`Doc::outer_shadows`].
    pub fn inset_shadows(&mut self, s: &Shape, list: &[Shadow], k: f64) {
        for sh in list.iter().rev().filter(|sh| sh.inset && to_rgba(&sh.color).a > 0.0) {
            let hole = s.grow(sh.x, sh.y, -sh.spread);
            let sigma = sh.blur / 2.0;
            let rmax = s.r.iter().cloned().fold(0.0, f64::max);
            let t = sh.x.abs() + sh.y.abs() + sh.spread.abs() + 3.0 * sigma + 2.0 + 0.3 * rmax;
            for band in Self::bands(s, t) {
                let m = 3.0 * sigma + 1.0;
                let wide = (band.0 - m, band.1 - m, band.2 + 2.0 * m, band.3 + 2.0 * m);
                let widep = Shape::new(wide.0, wide.1, wide.2, wide.3, 0.0).path();
                let holep = if hole.w > 0.0 && hole.h > 0.0 { poly_path(&clip_poly(&hole.polygon(), wide)) } else { String::new() };
                let inside = poly_path(&clip_poly(&s.polygon(), band));
                if inside.is_empty() {
                    continue;
                }
                let cid = self.clip(&inside);
                let f = if sigma > 0.0 { format!(r#" filter="url(#{})""#, self.blur_in(sigma, band)) } else { String::new() };
                self.push(&format!(r#"<g clip-path="url(#{cid})"><path d="{widep}{holep}" fill-rule="evenodd" {}{f}/></g>"#, fill(&sh.color, k)));
            }
        }
    }

    /// A CSS box: outer shadows, the fill (`paint` is a fill attribute), inset shadows.
    pub fn boxed(&mut self, s: &Shape, paint: &str, shadows: &[Shadow], k: f64) {
        self.outer_shadows(s, shadows, k);
        self.push(&format!(r#"<path d="{}" {paint}/>"#, s.path()));
        self.inset_shadows(s, shadows, k);
    }

    /// The finished document without consuming it.
    pub fn finish_ref(&self, scale: f64) -> (String, Frame) {
        Doc { defs: self.defs.clone(), body: self.body.clone(), blurs: vec![], ..*self }.finish(scale)
    }

    /// The finished document. `scale` rounds the size up to whole device pixels.
    pub fn finish(mut self, scale: f64) -> (String, Frame) {
        let pw = (self.w * scale).ceil().max(1.0);
        let ph = (self.h * scale).ceil().max(1.0);
        self.w = pw / scale;
        self.h = ph / scale;
        let svg = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="{} {} {} {}"><defs>{}</defs>{}</svg>"#,
            pw,
            ph,
            fmt(self.x),
            fmt(self.y),
            fmt(self.w),
            fmt(self.h),
            self.defs,
            self.body
        );
        (svg, Frame { x: self.x, y: self.y, w: self.w, h: self.h, px_w: pw as u32, px_h: ph as u32 })
    }
}

/// Where a raster image goes: its rectangle in CSS px (relative to the part), and its pixel size.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub px_w: u32,
    pub px_h: u32,
}

// ---- Key caps --------------------------------------------------------------------------------------

/// The radial face gradient of a cap: `radial-gradient(125% 110% at 50% 100%, face1, face0)` over
/// the box `w` x `h` (or, for ISO paths, `r = 90%` of the bounding box at the bottom middle).
fn face_gradient(doc: &mut Doc, t: &KeyboardTheme, w: f64, h: f64, iso: bool) -> String {
    let (rx, ry) = if iso { (0.9 * w, 0.9 * h) } else { (1.25 * w, 1.1 * h) };
    doc.css_radial(w / 2.0, h, rx, ry, &[(t.face1.clone(), 0.0), (t.face0.clone(), 1.0)])
}

/// The cap face: outer shadows, the radial face, the top highlight (not when pressed) and the 1 px
/// outline. For an ISO or JIS return key, the L-shaped path with its strokes and drop shadow.
/// Pressed brightness is applied later to the pixels.
pub fn key_face(k: &KeyCap, t: &KeyboardTheme, pressed: bool, light_keys: bool) -> Doc {
    let (w, h) = (k.w, k.h);
    if let Some(iso) = &k.iso {
        let mut d = Doc::with_margin(w, h, 4.0);
        let g = face_gradient(&mut d, t, w, h, true);
        let sh = if light_keys { "#00000024" } else { "#00000066" };
        let b = d.blur(0.5);
        d.push(&format!(r#"<g transform="translate(0 1)" filter="url(#{b})"><path d="{}" {}/><path d="{}" {}/></g>"#, iso.path, fill(sh, 1.0), iso.path, stroke(sh, 1.0, 1.0)));
        d.push(&format!(r#"<path d="{}" fill="url(#{g})"/>"#, iso.path));
        d.push(&format!(r#"<path d="{}" {}/>"#, iso.path, stroke(&t.outline, 1.0, 1.0)));
        d.push(&format!(r#"<path d="{}" {} stroke-linecap="round"/>"#, iso.highlight, stroke(&t.highlight, 1.0, 0.8)));
        return d;
    }
    let m = shadow_reach(&t.cap_shadows) + 2.0;
    let mut d = Doc::with_margin(w, h, m);
    let s = Shape::new(0.0, 0.0, w, h, k.radius);
    let g = face_gradient(&mut d, t, w, h, false);
    let mut list = vec![Shadow { x: 0.0, y: 0.0, blur: 0.0, spread: 1.0, color: t.outline.clone(), inset: true }];
    if !pressed {
        list.push(Shadow { x: 0.0, y: 1.8, blur: 0.0, spread: 0.0, color: t.highlight.clone(), inset: true });
    }
    list.extend(t.cap_shadows.iter().cloned());
    d.boxed(&s, &format!(r#"fill="url(#{g})""#), &list, 1.0);
    d
}

fn glow_reach(g: &[TextGlow]) -> f64 {
    g.iter().map(|g| g.blur * 1.5).fold(0.0, f64::max)
}

/// The contents of a cap: legends (with letter spacing and glow), icon (with glow), caps lock LED,
/// home bar and Touch ID.
///
/// `snap` is the device pixels per px: legend baselines go to whole device pixels, as in browsers.
pub fn key_content(k: &KeyCap, t: &KeyboardTheme, caps: bool, snap: f64) -> Doc {
    let (w, h) = (k.w, k.h);
    let m = 4.0 + glow_reach(&t.legend_glow).max(glow_reach(&t.icon_glow)).max(glow_reach(&t.caps_led_glow));
    let mut d = Doc::with_margin(w, h, m);
    let base = text::baseline_offset() as f64;
    for l in &k.legends {
        let shaped = text::shape(&l.text, TextStyle::at(l.size as f32, l.tracking as f32, snap as f32));
        if shaped.path.is_empty() {
            continue;
        }
        let tw = shaped.width as f64;
        let x = match l.align {
            Align::Center => (w - tw) / 2.0,
            Align::Left => l.inset,
            Align::Right => w - l.inset - tw,
        };
        let y = ((l.top + l.size * base) * snap).round() / snap;
        let tr = format!(r#"transform="translate({} {})""#, fmt(x), fmt(y));
        for g in t.legend_glow.iter().rev() {
            let b = d.blur(g.blur / 2.0);
            d.push(&format!(r#"<path {tr} d="{}" {} filter="url(#{b})"/>"#, shaped.path, fill(&g.color, 1.0)));
        }
        d.push(&format!(r#"<path {tr} d="{}" {}/>"#, shaped.path, fill(&t.legend, 1.0)));
    }
    if let Some(ic) = &k.icon {
        let vb = ic.view_box;
        let sc = (ic.w / vb[2]).min(ic.h / vb[3]);
        let ox = ic.x + (ic.w - vb[2] * sc) / 2.0 - vb[0] * sc;
        let oy = ic.y + (ic.h - vb[3] * sc) / 2.0 - vb[1] * sc;
        let tr = format!(r#"transform="translate({} {}) scale({})""#, fmt(ox), fmt(oy), fmt(sc));
        let body = |c: &str| {
            let (rgb, a) = rgb_a(c, 1.0);
            let mut s = String::new();
            if !ic.fill.is_empty() {
                let _ = write!(s, r#"<path d="{}" fill="{rgb}" fill-opacity="{}"/>"#, ic.fill, fmt(a));
            }
            if !ic.stroke.is_empty() {
                let _ = write!(
                    s,
                    r#"<path d="{}" fill="none" stroke="{rgb}" stroke-opacity="{}" stroke-width="{}" stroke-linecap="round" stroke-linejoin="round"/>"#,
                    ic.stroke,
                    fmt(a),
                    fmt(ic.stroke_width)
                );
            }
            s
        };
        for g in t.icon_glow.iter().rev() {
            let b = d.blur(g.blur / 2.0);
            d.push(&format!(r#"<g filter="url(#{b})"><g {tr}>{}</g></g>"#, body(&g.color)));
        }
        d.push(&format!(r#"<g {tr}>{}</g>"#, body(&t.legend)));
    }
    if let Some(led) = &k.caps_led {
        let (cx, cy, r) = (led.x + led.d / 2.0, led.y + led.d / 2.0, led.d / 2.0);
        if caps {
            for g in t.caps_led_glow.iter().rev() {
                let b = d.blur(g.blur / 2.0);
                d.push(&format!(r#"<circle cx="{}" cy="{}" r="{}" {} filter="url(#{b})"/>"#, fmt(cx), fmt(cy), fmt(r), fill(&g.color, 1.0)));
            }
        }
        let c = if caps { &t.caps_led_on } else { &t.caps_led_off };
        d.push(&format!(r#"<circle cx="{}" cy="{}" r="{}" {}/>"#, fmt(cx), fmt(cy), fmt(r), fill(c, 1.0)));
    }
    if let Some(hb) = &k.home_bar {
        d.push(&format!(r#"<path d="{}" {}/>"#, Shape::new(hb.x, hb.y, hb.w, hb.h, 1.0).path(), fill(&t.home_bar, 1.0)));
    }
    if let Some(tid) = &k.touch_id {
        touch_id(&mut d, w / 2.0, h / 2.0, tid.d, t);
    }
    d
}

/// The conic stops of the dark Touch ID ring, in degrees.
const CONIC: [(f64, u32); 6] = [(0.0, 0x5a5a5e), (60.0, 0x48484c), (140.0, 0x3a3a3d), (215.0, 0x444448), (290.0, 0x3a3a3d), (360.0, 0x5a5a5e)];

fn conic_color(deg: f64, k: f64) -> String {
    let mut i = 0;
    while i + 2 < CONIC.len() && deg > CONIC[i + 1].0 {
        i += 1;
    }
    let (a0, c0) = CONIC[i];
    let (a1, c1) = CONIC[i + 1];
    let f = ((deg - a0) / (a1 - a0)).clamp(0.0, 1.0);
    let ch = |c: u32, sh: u32| ((c >> sh) & 255) as f64;
    let mix = |sh: u32| ((ch(c0, sh) + (ch(c1, sh) - ch(c0, sh)) * f) * k).round().clamp(0.0, 255.0) as u8;
    format!("#{:02x}{:02x}{:02x}", mix(16), mix(8), mix(0))
}

fn touch_id(d: &mut Doc, cx: f64, cy: f64, dia: f64, t: &KeyboardTheme) {
    let k = t.touch_id_brightness;
    let r = dia / 2.0;
    let disc = Shape::new(cx - r, cy - r, dia, dia, r);
    let sh = |x: f64, y: f64, blur: f64, spread: f64, c: &str, inset: bool| Shadow { x, y, blur, spread, color: mackeys_core::color(c), inset };
    match t.touch_id {
        TouchIdStyle::Dark => {
            d.outer_shadows(&disc, &[sh(0.0, 0.0, 0.0, 0.5, "rgba(0,0,0,.65)", false)], k);
            // The conic ring as thin wedges, clockwise from the top.
            let n = 120;
            let mut s = String::new();
            for i in 0..n {
                let a0 = i as f64 * 360.0 / n as f64;
                let a1 = a0 + 360.0 / n as f64 + 0.6;
                let p = |a: f64| (cx + r * a.to_radians().sin(), cy - r * a.to_radians().cos());
                let (x0, y0) = p(a0);
                let (x1, y1) = p(a1);
                let _ = write!(
                    s,
                    r#"<path d="M{} {}L{} {}A{} {} 0 0 1 {} {}Z" fill="{}"/>"#,
                    fmt(cx),
                    fmt(cy),
                    fmt(x0),
                    fmt(y0),
                    fmt(r),
                    fmt(r),
                    fmt(x1),
                    fmt(y1),
                    conic_color(a0 + 180.0 / n as f64, k)
                );
            }
            let clip = d.clip(&disc.path());
            d.push(&format!(r#"<g clip-path="url(#{clip})">{s}</g>"#));
            let inner = disc.grow(0.0, 0.0, -0.7);
            d.boxed(&inner, &fill("#1b1b1dff", k), &[sh(0.0, 0.8, 1.0, 0.0, "rgba(0,0,0,.45)", true)], k);
        }
        TouchIdStyle::Light => {
            d.boxed(&disc, &fill("#c4c4c8ff", k), &[sh(0.0, 0.0, 0.0, 0.6, "rgba(60,60,66,.55)", false)], k);
            let inner = disc.grow(0.0, 0.0, -1.1);
            d.boxed(
                &inner,
                &fill("#eeeef0ff", k),
                &[sh(0.0, 0.0, 0.0, 0.5, "rgba(70,70,76,.45)", true), sh(0.0, 1.0, 1.0, 0.0, "rgba(0,0,0,.06)", true)],
                k,
            );
        }
        TouchIdStyle::Flush => {
            d.boxed(
                &disc,
                &fill(&t.face1, k),
                &[
                    sh(0.0, 1.0, 1.0, 0.0, "rgba(0,0,0,.10)", true),
                    sh(0.0, -0.8, 0.0, 0.0, "rgba(255,255,255,.6)", true),
                    sh(0.0, 0.6, 0.0, 0.0, "rgba(255,255,255,.5)", false),
                    sh(0.0, -0.4, 0.0, 0.0, "rgba(0,0,0,.08)", false),
                ],
                k,
            );
        }
    }
}

// ---- Top case --------------------------------------------------------------------------------------

/// The parts of the top case (without the trackpad), as documents over the same rectangle.
pub struct TopCaseDocs {
    /// The wide, soft outer shadows of the side (rasterized at a low resolution).
    pub far: Doc,
    /// Side and deck.
    pub deck: Doc,
    /// The deck shape alone, white: the grain mask.
    pub mask: Doc,
    /// Hinge, notch and grilles (drawn over the grain).
    pub details: Doc,
    /// Dim and well: the parts the backlight changes.
    pub well: Doc,
}

/// The top case without the trackpad: side, deck, (grain, see [`crate::grain`]), hinge, notch,
/// grilles, dim and well.
pub fn top_case(tc: &TopCaseGeometry) -> TopCaseDocs {
    let (w, h) = (tc.width, tc.height);
    let m = shadow_reach(&tc.side_shadows).max(shadow_reach(&tc.deck_shadows)).max(shadow_reach(&tc.well.shadows)) + 4.0;
    let doc = || Doc::new(-m, -m, w + 2.0 * m, h + 10.0 + 2.0 * m);
    let mut d = doc();
    // 1. Side, 10 px down.
    let side = Shape::radii(0.0, 10.0, w, h, tc.radius);
    let g = d.vgrad(&tc.side, 1.0);
    let (far_list, near) = split_far(&tc.side_shadows);
    let mut far = doc();
    far.outer_shadows(&side, &far_list, 1.0);
    d.boxed(&side, &format!(r#"fill="url(#{g})""#), &near, 1.0);
    // 2. Deck.
    let deck = Shape::radii(0.0, 0.0, w, h, tc.radius);
    let g = d.vgrad(&tc.deck, 1.0);
    d.boxed(&deck, &format!(r#"fill="url(#{g})""#), &tc.deck_shadows, 1.0);
    let deck_doc = d;
    let mut mask = doc();
    mask.push(&format!(r##"<path d="{}" fill="#fff"/>"##, deck.path()));
    let mut d = doc();
    // 4. Hinge and notch.
    if let Some(hg) = &tc.hinge {
        let bar = Shape::radii(hg.x, 0.0, hg.w, hg.h, [0.0, 0.0, 3.0, 3.0]);
        let g = d.vgrad(&Gradient { stops: vec![gs("#000000ff", 0.0), gs("#0b0b0cff", 1.0)] }, 1.0);
        d.push(&format!(r#"<path d="{}" fill="url(#{g})"/>"#, bar.path()));
        for (x, r) in [(hg.x, [0.0, 0.0, 2.0, 3.0]), (hg.x + hg.w - hg.barrel_w, [0.0, 0.0, 3.0, 2.0])] {
            let b = Shape::radii(x, 0.0, hg.barrel_w, hg.h, r);
            let g = d.vgrad(&hg.barrel, 1.0);
            d.push(&format!(r#"<path d="{}" fill="url(#{g})"/>"#, b.path()));
        }
    }
    if let Some(n) = &tc.notch {
        let lip = Shape::radii(n.x, n.y, n.w, n.h, [0.0, 0.0, 5.0, 5.0]);
        let g = d.vgrad(&n.fill, 1.0);
        let sh = |x: f64| Shadow { x, y: 0.0, blur: 3.0, spread: -2.0, color: "#00000059".into(), inset: true };
        d.boxed(&lip, &format!(r#"fill="url(#{g})""#), &[sh(4.0), sh(-4.0)], 1.0);
        let (x, y, sw) = (n.x, n.y - 6.0, n.w);
        let g = d.vgrad(&Gradient { stops: vec![gs("#00000000", 0.0), gs(&mackeys_core::rgba(0.0, 0.0, 0.0, n.scoop_opacity), 1.0)] }, 1.0);
        d.push(&format!(
            r#"<path d="M{} {}A{} 6 0 0 1 {} {}A{} 6 0 0 1 {} {}Z" fill="url(#{g})"/>"#,
            fmt(x),
            fmt(y + 6.0),
            fmt(sw / 2.0),
            fmt(x + sw / 2.0),
            fmt(y),
            fmt(sw / 2.0),
            fmt(x + sw),
            fmt(y + 6.0)
        ));
    }
    // 5. Grilles: dots on a pitch grid, centered.
    for gr in &tc.grilles {
        if to_rgba(&gr.dot).a <= 0.0 {
            continue;
        }
        let mut s = String::new();
        let nx = (gr.w / 2.0 / gr.pitch).floor() as i64 + 1;
        let ny = (gr.h / 2.0 / gr.pitch).floor() as i64 + 1;
        // CSS tiles start at the center minus half a tile, with the dot at each tile's center.
        for j in -ny..=ny {
            let cy = gr.y + gr.h / 2.0 + j as f64 * gr.pitch;
            if cy < gr.y || cy > gr.y + gr.h {
                continue;
            }
            for i in -nx..=nx {
                let cx = gr.x + gr.w / 2.0 + i as f64 * gr.pitch;
                if cx < gr.x || cx > gr.x + gr.w {
                    continue;
                }
                let _ = write!(s, "M{} {}a{r} {r} 0 1 0 {} 0a{r} {r} 0 1 0 {} 0Z", fmt(cx - gr.dot_radius - 0.15), fmt(cy), fmt(2.0 * gr.dot_radius + 0.3), fmt(-2.0 * gr.dot_radius - 0.3), r = fmt(gr.dot_radius + 0.15));
            }
        }
        let clip = d.clip(&Shape::new(gr.x, gr.y, gr.w, gr.h, 3.0).path());
        d.push(&format!(r#"<path clip-path="url(#{clip})" d="{s}" {}/>"#, fill(&gr.dot, 1.0)));
    }
    let details = d;
    let mut d = doc();
    // 6. Dim.
    if tc.dim > 0.0 {
        d.push(&format!(r##"<path d="{}" fill="#000" fill-opacity="{}"/>"##, deck.path(), fmt(tc.dim)));
    }
    // 7. Well.
    let wl = &tc.well;
    d.boxed(&Shape::new(wl.x, wl.y, wl.w, wl.h, wl.radius), &fill(&wl.fill, 1.0), &wl.shadows, 1.0);
    TopCaseDocs { far, deck: deck_doc, mask, details, well: d }
}

fn gs(c: &str, at: f64) -> mackeys_core::GradientStop {
    mackeys_core::GradientStop { color: mackeys_core::color(c), at }
}

// ---- Trackpad --------------------------------------------------------------------------------------

/// The inner shadow of a pressed trackpad (`.mk-tp.mk-dn::after`, `.mk-force::after`).
pub fn pad_press_shadow(phase: TrackpadPhase) -> Option<Shadow> {
    match phase {
        TrackpadPhase::Up => None,
        TrackpadPhase::Down => Some(Shadow { x: 0.0, y: 1.0, blur: 5.0, spread: 0.0, color: "#00000038".into(), inset: true }),
        TrackpadPhase::Force => Some(Shadow { x: 0.0, y: 2.0, blur: 9.0, spread: 0.0, color: "#00000052".into(), inset: true }),
    }
}

/// The trackpad glass in two documents over the same rectangle: outer shadows and surface; then
/// inset shadows and the pressed inner shadow. Grain goes between them (see
/// [`crate::raster::pad_art`]). Phase brightness is applied later to the pixels.
pub fn pad_surface(surface: &Gradient, shadows: &[Shadow], radius: f64, w: f64, h: f64, phase: TrackpadPhase) -> (Doc, Doc, Shape) {
    let m = shadow_reach(shadows) + 3.0;
    let mut d = Doc::with_margin(w, h, m);
    let s = Shape::new(0.0, 0.0, w, h, radius);
    let g = d.vgrad(surface, 1.0);
    d.outer_shadows(&s, shadows, 1.0);
    d.push(&format!(r#"<path d="{}" fill="url(#{g})"/>"#, s.path()));
    let mut o = Doc::with_margin(w, h, m);
    o.inset_shadows(&s, shadows, 1.0);
    if let Some(sh) = pad_press_shadow(phase) {
        o.inset_shadows(&s, &[sh], 1.0);
    }
    (d, o, s)
}

/// Returns the soft outer shadows (blur 12 px or more, drawn first), and the rest.
pub fn split_far(list: &[Shadow]) -> (Vec<Shadow>, Vec<Shadow>) {
    list.iter().cloned().partition(|s| !s.inset && s.blur >= FAR_BLUR)
}

/// Outer shadows with at least this blur go to a low-resolution layer.
pub const FAR_BLUR: f64 = 12.0;

/// The side of a standalone trackpad, `sideDepth` below the glass: the soft shadows (low
/// resolution) and the rest.
pub fn pad_side(tp: &TrackpadGeometry) -> (Doc, Doc) {
    let m = shadow_reach(&tp.side_shadows) + 3.0;
    let doc = || Doc::new(-m, -m, tp.width + 2.0 * m, tp.height + tp.side_depth + 2.0 * m);
    let mut d = doc();
    let s = Shape::new(0.0, tp.side_depth, tp.width, tp.height, tp.radius);
    let g = d.vgrad(&tp.side, 1.0);
    let (far_list, near) = split_far(&tp.side_shadows);
    let mut far = doc();
    far.outer_shadows(&s, &far_list, 1.0);
    d.boxed(&s, &format!(r#"fill="url(#{g})""#), &near, 1.0);
    (far, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounded_rect_paths() {
        assert_eq!(Shape::new(0.0, 0.0, 10.0, 4.0, 0.0).path(), "M0 0H10V4H0V0Z");
        let p = Shape::new(0.0, 0.0, 10.0, 4.0, 4.0).path();
        assert!(p.contains("A2 2"), "{p}");
        let g = Shape::new(0.0, 0.0, 10.0, 10.0, 2.0).grow(1.0, 2.0, 1.0);
        assert_eq!(g, Shape::radii(0.0, 1.0, 12.0, 12.0, [3.0; 4]));
    }

    #[test]
    fn conic_stops() {
        assert_eq!(conic_color(0.0, 1.0), "#5a5a5e");
        assert_eq!(conic_color(140.0, 1.0), "#3a3a3d");
        assert_eq!(conic_color(360.0, 1.0), "#5a5a5e");
    }
}
