//! The open MacBook lid: a port of the web `Lid` (shell, bezel, wallpaper, ribbons, vignette, menu
//! bar, widgets, dock, glass, notch and camera), drawn flat as SVG, then projected with the CSS
//! transform `perspective(4200px) rotateX(-80deg)` about the bottom center.
//!
//! The flat lid covers `width` x `height` above the deck (its bottom edge is the hinge, at y = 0).
//! The projected image covers x from `-LID_SIDE` to `width + LID_SIDE` and y from `-LID_SPACE` to 0.
use crate::art::{fill, rgb_a, Doc, Frame, Shape};
use crate::css;
use crate::raster::{cached, rasterize_svg, Art};
use crate::scene::{LID_SIDE, LID_SPACE};
use crate::text::{self, TextStyle};
use mackeys_core::{fmt, get_finish};
use std::fmt::Write as _;
use std::sync::Arc;
use tiny_skia::Pixmap;

/// CSS `perspective` and `rotateX` of the lid.
pub const PERSPECTIVE: f64 = 4200.0;
pub const TILT_DEG: f64 = -80.0;

const APPS: [(&str, &str); 12] = [
    ("linear-gradient(180deg, #ffffff 0%, #e4e8ef 100%)", "width: 16px; height: 14px; border-radius: 3px; background: linear-gradient(90deg, #2d7cf6 50%, #9fd0ff 50%);"),
    ("linear-gradient(180deg, #6fd3ff 0%, #1f7cff 100%)", "width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.95);"),
    ("linear-gradient(180deg, #7cf08a 0%, #23b14d 100%)", "width: 14px; height: 10px; border-radius: 6px; background: rgba(255,255,255,.95);"),
    ("linear-gradient(180deg, #ffffff 0%, #eceff3 100%)", "width: 14px; height: 15px; border-radius: 3px; background: linear-gradient(180deg, #ff3b30 0 30%, #ffffff 30%); box-shadow: inset 0 0 0 1px #d6d9df;"),
    ("linear-gradient(180deg, #ffd84d 0%, #ff9f0a 100%)", "width: 6px; height: 16px; border-radius: 3px; background: rgba(255,255,255,.95); transform: rotate(35deg);"),
    ("linear-gradient(180deg, #ff8a80 0%, #ff3b30 100%)", "width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,.95);"),
    ("linear-gradient(180deg, #fffbe6 0%, #f4e6a6 100%)", "width: 14px; height: 3px; border-radius: 2px; background: #c9a227; box-shadow: 0 5px 0 #d9b94a, 0 -5px 0 #c9a227;"),
    ("linear-gradient(180deg, #d7a8ff 0%, #8e44ff 100%)", "width: 14px; height: 14px; border-radius: 4px; border: 2.5px solid rgba(255,255,255,.9);"),
    ("linear-gradient(180deg, #5ee0d0 0%, #10a39a 100%)", "width: 12px; height: 12px; background: rgba(255,255,255,.95); clip-path: polygon(50% 0, 100% 100%, 0 100%);"),
    ("linear-gradient(180deg, #3a3a40 0%, #141417 100%)", "width: 14px; height: 9px; border-radius: 2px; border: 2px solid #4cd964;"),
    ("linear-gradient(180deg, #ffffff 0%, #e9ecf1 100%)", "width: 14px; height: 14px; border-radius: 50%; background: conic-gradient(#ff3b30 0 25%, #ffcc00 0 50%, #34c759 0 75%, #007aff 0);"),
    ("linear-gradient(180deg, #9be7ff 0%, #2bb7f0 100%)", "width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.9); border-top-color: transparent;"),
];

/// The colors of the lid for a finish (`lidModel` in `dom.ts`).
pub struct LidModel {
    pub lid: String,
    pub wall: String,
    pub ribbon_a: String,
    pub ribbon_hi: String,
    pub ribbon_b: String,
    pub ribbon_c: String,
    pub ink: String,
    pub bar_bg: String,
    pub widget_bg: String,
    pub widget_shadow: String,
    pub dock_bg: String,
}

pub fn lid_model(finish: &str) -> LidModel {
    let f = get_finish(finish);
    let r = |i: usize| f.ribbon.get(i).and_then(|v| v.as_str()).map(String::from);
    let dark_ink = f.ribbon.get(3).and_then(|v| v.as_f64()).unwrap_or(0.0) != 0.0;
    let a = r(0).unwrap_or_else(|| "#888888".into());
    LidModel {
        lid: format!("linear-gradient(180deg, {} 0%, {} 45%, {} 100%)", f.lid[0], f.lid[1], f.lid[2]),
        wall: f.wall.clone(),
        ribbon_hi: r(1).unwrap_or_else(|| "#ffffff".into()),
        ribbon_b: r(2).unwrap_or_else(|| a.clone()),
        ribbon_c: r(4).unwrap_or_else(|| a.clone()),
        ribbon_a: a,
        ink: if dark_ink { "#ffffff" } else { "#111114" }.into(),
        bar_bg: if dark_ink { "rgba(0,0,0,.06)" } else { "rgba(255,255,255,.12)" }.into(),
        widget_bg: if dark_ink { "rgba(255,255,255,.16)" } else { "rgba(40,30,20,.12)" }.into(),
        widget_shadow: if dark_ink {
            "inset 0 0 0 1px rgba(255,255,255,.28), 0 4px 12px rgba(0,0,0,.18)"
        } else {
            "inset 0 0 0 1px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.5), 0 4px 12px rgba(0,0,0,.12)"
        }
        .into(),
        dock_bg: if dark_ink { "rgba(255,255,255,.14)" } else { "rgba(255,255,255,.26)" }.into(),
    }
}

fn c(s: &str) -> String {
    css::css_color(s).unwrap_or_else(|| "#000000ff".into())
}

/// Text at `x`, with the top of its `line-height: 1` box at `top`. Returns the width.
///
/// The lid text has no `-webkit-font-smoothing: antialiased`, so macOS draws it with font
/// smoothing, which makes stems a little heavier. A thin stroke in the text color does the same.
fn text_at(d: &mut Doc, s: &str, x: f64, top: f64, style: TextStyle, color: &str) -> f64 {
    let t = text::shape(s, style);
    let base = top + style.size as f64 * text::baseline_offset() as f64;
    let (rgb, a) = rgb_a(color, 1.0);
    d.push(&format!(
        r#"<path transform="translate({} {})" d="{}" fill="{rgb}" fill-opacity="{}" stroke="{rgb}" stroke-opacity="{}" stroke-width="{}" stroke-linejoin="round"/>"#,
        fmt(x),
        fmt(base),
        t.path,
        fmt(a),
        fmt(a),
        fmt(style.size as f64 * 0.035)
    ));
    t.width as f64
}

fn text_width(s: &str, style: TextStyle) -> f64 {
    text::shape(s, style).width as f64
}

/// The flat lid as three SVG documents over (0, 0, `w`, `h`): the shell, bezel and wallpaper; the
/// blurred ribbons (rasterized at a lower resolution, since they are soft); and the screen contents,
/// notch and camera.
pub fn flat_lid(finish: &str, w: f64, h: f64) -> (Doc, Doc, Doc) {
    let m = lid_model(finish);
    let doc = || Doc::new(-2.0, -2.0, w + 4.0, h + 4.0);
    let mut d = doc();
    // Shell.
    let shell = Shape::radii(0.0, 0.0, w, h, [20.0, 20.0, 12.0, 12.0]);
    d.outer_shadows(&shell, &css::shadows("0 0 0 1px rgba(0,0,0,.3)"), 1.0);
    css::background(&mut d, &m.lid, (0.0, 0.0, w, h), &shell.path());
    d.inset_shadows(&shell, &css::shadows("inset 0 0 0 1.5px rgba(255,255,255,.4)"), 1.0);
    // Bezel.
    let bezel = Shape::radii(2.0, 3.0, w - 4.0, h - 6.0, [17.0, 17.0, 9.0, 9.0]);
    d.boxed(&bezel, &fill("#050506ff", 1.0), &css::shadows("inset 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.12)"), 1.0);
    // Screen.
    let (sx, sy, sw, sh) = (6.0, 14.0, w - 12.0, h - 32.0);
    let screen = Shape::radii(sx, sy, sw, sh, [10.0, 10.0, 2.0, 2.0]);
    let clip = d.clip(&screen.path());
    d.push(&format!(r#"<g clip-path="url(#{clip})">"#));
    css::background(&mut d, &m.wall, (sx, sy, sw, sh), "");
    d.push("</g>");
    let under = d;
    let mut d = doc();
    let clip = d.clip(&screen.path());
    d.push(&format!(r#"<g clip-path="url(#{clip})">"#));
    ribbons(&mut d, &m, sx, sy, sw, sh);
    d.push("</g>");
    let rib = d;
    let mut d = doc();
    let clip = d.clip(&screen.path());
    d.push(&format!(r#"<g clip-path="url(#{clip})">"#));
    css::background(
        &mut d,
        "radial-gradient(120% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%), linear-gradient(180deg, rgba(0,0,0,.14) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 80%, rgba(0,0,0,.18) 100%)",
        (sx, sy, sw, sh),
        "",
    );
    d.push(&format!(r#"<g transform="translate({} {})">"#, fmt(sx), fmt(sy)));
    menu_bar(&mut d, &m, sw);
    widgets(&mut d, &m);
    dock(&mut d, &m, sw, sh);
    d.push("</g>");
    css::background(&mut d, "linear-gradient(155deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.02) 28%, rgba(255,255,255,0) 45%)", (sx, sy, sw, sh), "");
    // Glimmer: a soft band, rotated 18 degrees, at 14 % opacity.
    let (gw, gh) = (sw * 0.09, sh * 1.8);
    let (gx, gy) = (sx + sw * 0.66, sy - sh * 0.4);
    d.push(&format!(r#"<g opacity="0.14" transform="rotate(18 {} {})">"#, fmt(gx + gw / 2.0), fmt(gy + gh / 2.0)));
    css::background(
        &mut d,
        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.14) 35%, rgba(255,255,255,.38) 50%, rgba(255,255,255,.14) 65%, rgba(255,255,255,0) 100%)",
        (gx, gy, gw, gh),
        "",
    );
    d.push("</g></g>");
    // Notch and camera.
    d.push(&format!(r##"<path d="{}" fill="#050506"/>"##, Shape::radii(w / 2.0 - 54.0, 3.0, 108.0, 22.0, [0.0, 0.0, 9.0, 9.0]).path()));
    let cam = d.css_radial(w / 2.0 - 3.5 + 7.0 * 0.35, 9.0 + 7.0 * 0.35, 6.75, 6.75, &[("#2a3550ff".into(), 0.0), ("#0b0d14ff".into(), 0.6)]);
    d.push(&format!(r#"<circle cx="{}" cy="12.5" r="3.5" fill="url(#{cam})"/>"#, fmt(w / 2.0)));
    (under, rib, d)
}

fn ribbons(d: &mut Doc, m: &LidModel, sx: f64, sy: f64, sw: f64, sh: f64) {
    let id = d.id("rb");
    let (a, aa) = rgb_a(&c(&m.ribbon_a), 1.0);
    let (hi, _) = rgb_a(&c(&m.ribbon_hi), 1.0);
    let (b, _) = rgb_a(&c(&m.ribbon_b), 1.0);
    let (cc, _) = rgb_a(&c(&m.ribbon_c), 1.0);
    d.def(&format!(
        r#"<filter id="{id}b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter><filter id="{id}s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter><linearGradient id="{id}A" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{a}" stop-opacity="{}"/><stop offset="0.5" stop-color="{a}" stop-opacity="{}"/><stop offset="1" stop-color="{hi}" stop-opacity="0.5"/></linearGradient>"#,
        fmt(0.55 * aa),
        fmt(aa)
    ));
    let mut s = String::new();
    let _ = write!(
        s,
        r#"<g transform="translate({} {}) scale({} {})">"#,
        fmt(sx),
        fmt(sy),
        fmt(sw / 1000.0),
        fmt(sh / 650.0)
    );
    let _ = write!(s, r#"<g filter="url(#{id}s)"><path d="M-60 600C170 470 330 380 490 420S790 560 1060 230L1060 330C820 680 600 600 470 520S200 600 -60 680Z" fill="{b}" opacity="0.35"/></g>"#);
    let _ = write!(
        s,
        r#"<g filter="url(#{id}b)"><path d="M300 -30C450 110 520 210 700 225S950 150 1060 255L1060 300C900 265 760 320 615 300S420 160 300 -30Z" fill="{cc}" opacity="0.85"/><path d="M-60 520C150 380 300 250 480 300S780 520 1060 110L1060 165C820 620 600 560 470 470S200 520 -60 565Z" fill="url(#{id}A)"/><path d="M-60 545C170 440 322 330 482 365S762 520 1060 140L1060 158C802 560 602 500 482 430S182 515 -60 555Z" fill="{b}" opacity="0.95"/></g>"#
    );
    let _ = write!(s, r##"<path d="M-60 520C150 380 300 250 480 300S780 520 1060 110" fill="none" stroke="#f4fbff" stroke-opacity="0.9" stroke-width="5" filter="url(#{id}b)"/>"##);
    let _ = write!(s, r##"<path d="M300 -30C450 110 520 210 700 225S950 150 1060 255" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="3" filter="url(#{id}b)"/>"##);
    s.push_str("</g>");
    d.push(&s);
}

fn menu_bar(d: &mut Doc, m: &LidModel, sw: f64) {
    let ink = c(&m.ink);
    d.push(r#"<g opacity="0.8">"#);
    d.push(&format!(r#"<rect x="0" y="0" width="{}" height="30" {}/>"#, fmt(sw), fill(&c(&m.bar_bg), 1.0)));
    let st = |weight: f32| TextStyle { weight, ..TextStyle::new(14.0) };
    let top = 8.0;
    let mut x = 16.0;
    x += text_at(d, "Finder", x, top, st(700.0), &ink) + 14.0;
    for t in ["File", "Edit", "View", "Go", "Window", "Help"] {
        x += text_at(d, t, x, top, st(500.0), &ink) + 14.0;
    }
    // Right side, laid out from the right edge: wifi, battery, search, control center, clock.
    let clock = "Tue 9:41";
    let widths = [16.0, 24.0, 10.0, 16.0, text_width(clock, st(500.0))];
    let total: f64 = widths.iter().sum::<f64>() + 13.0 * 4.0;
    let mut x = sw - 16.0 - total;
    let (inkc, inka) = rgb_a(&ink, 1.0);
    // Wifi: a quarter of a disc (90 degrees, pointing down), 16 x 16, 2 px lower.
    let (cx, cy) = (x + 8.0, 24.0);
    let r = 16.0;
    let p = |a: f64| (cx + r * a.to_radians().sin(), cy - r * a.to_radians().cos());
    let (x0, y0) = p(-45.0);
    let (x1, y1) = p(45.0);
    let wclip = d.clip(&Shape::radii(x, cy - 16.0, 16.0, 16.0, [16.0, 16.0, 0.0, 0.0]).path());
    d.push(&format!(
        r#"<path d="M{} {}L{} {}A{r} {r} 0 0 1 {} {}Z" fill="{inkc}" fill-opacity="{}" clip-path="url(#{})"/>"#,
        fmt(cx),
        fmt(cy),
        fmt(x0),
        fmt(y0),
        fmt(x1),
        fmt(y1),
        fmt(0.95 * inka),
        wclip,
        r = fmt(r)
    ));
    x += widths[0] + 13.0;
    // Battery: 24 x 12 outline, 48 % fill, nub.
    let by = 15.0 - 6.0;
    d.push(&format!(
        r#"<g opacity="0.95"><path d="{}" fill="none" stroke="{inkc}" stroke-width="1.5"/><path d="{}" fill="{inkc}"/><path d="{}" fill="{inkc}"/></g>"#,
        Shape::new(x + 0.75, by + 0.75, 22.5, 10.5, 3.25).path(),
        Shape::new(x + 3.0, by + 3.0, (24.0 - 3.0) * 0.48, 6.0, 1.5).path(),
        Shape::radii(x + 24.5, by + 4.5, 2.0, 4.0, [0.0, 1.0, 1.0, 0.0]).path()
    ));
    x += widths[1] + 13.0;
    // Search: a 10 px ring and a handle.
    let sy = 15.0 - 5.0;
    d.push(&format!(
        r#"<circle cx="{}" cy="{}" r="4.1" fill="none" stroke="{inkc}" stroke-width="1.8"/><path d="M{} {}L{} {}" stroke="{inkc}" stroke-width="1.8"/>"#,
        fmt(x + 5.0),
        fmt(sy + 5.0),
        fmt(x + 7.93),
        fmt(18.53),
        fmt(x + 11.47),
        fmt(22.07)
    ));
    x += widths[2] + 13.0;
    // Control center: two pills.
    let cy0 = 15.0 - 6.0;
    for dy in [0.0, 7.0] {
        d.push(&format!(r#"<path d="{}" fill="none" stroke="{inkc}" stroke-width="1.4"/>"#, Shape::new(x + 0.7, cy0 + dy + 0.7, 14.6, 3.6, 2.3).path()));
    }
    x += widths[3] + 13.0;
    text_at(d, clock, x, top, st(500.0), &ink);
    d.push("</g>");
}

fn widgets(d: &mut Doc, m: &LidModel) {
    let ink = c(&m.ink);
    let bg = c(&m.widget_bg);
    let shadows = css::shadows(&m.widget_shadow);
    let temp = TextStyle { tracking: -0.02, ..TextStyle::new(34.0) };
    for (i, y) in [(0, 52.0), (1, 52.0 + 104.0 + 10.0)] {
        let x = 34.0;
        let s = Shape::new(x, y, 100.0, 104.0, 20.0);
        d.boxed(&s, &fill(&bg, 1.0), &shadows, 1.0);
        if i == 0 {
            text_at(d, "14°", x + 12.0, y + 11.0, temp, &ink);
            sun(d, x + 66.0 + 11.0, y + 71.0 + 11.0);
        } else {
            ring(d, x + 12.0 + 20.0, y + 11.0 + 20.0);
            text_at(d, "49%", x + 12.0, y + 59.0, temp, &ink);
        }
    }
}

/// The sun: a core disc and eight rays (a conic pattern in a 22 px circle).
fn sun(d: &mut Doc, cx: f64, cy: f64) {
    let r = 11.0;
    let mut s = String::new();
    for i in 0..8 {
        let a0 = i as f64 * 45.0;
        let a1 = a0 + 21.6;
        let p = |a: f64| (cx + r * a.to_radians().sin(), cy - r * a.to_radians().cos());
        let (x0, y0) = p(a0);
        let (x1, y1) = p(a1);
        let _ = write!(s, "M{} {}L{} {}A{r} {r} 0 0 1 {} {}Z", fmt(cx), fmt(cy), fmt(x0), fmt(y0), fmt(x1), fmt(y1), r = fmt(r));
    }
    d.push(&format!(r##"<path d="{s}" fill="#ffd84d"/><circle cx="{}" cy="{}" r="7.1" fill="#ffd84d"/>"##, fmt(cx), fmt(cy)));
}

/// The battery ring: 40 px, 4 px border, green on the left half, gray on the right.
fn ring(d: &mut Doc, cx: f64, cy: f64) {
    let r = 18.0;
    d.push(&format!(
        r##"<path d="M{} {}A{r} {r} 0 0 1 {} {}" fill="none" stroke="#30d158" stroke-width="4"/><path d="M{} {}A{r} {r} 0 0 1 {} {}" fill="none" stroke="#a0a0a5" stroke-opacity="0.45" stroke-width="4"/>"##,
        fmt(cx),
        fmt(cy + r),
        fmt(cx),
        fmt(cy - r),
        fmt(cx),
        fmt(cy - r),
        fmt(cx),
        fmt(cy + r),
        r = fmt(r)
    ));
}

fn dock(d: &mut Doc, m: &LidModel, sw: f64, sh: f64) {
    let width = 6.0 + 12.0 * 22.0 + 11.0 * 3.0 + 3.0 + 5.0 + 3.0 + 22.0 + 6.0;
    let height = 52.0;
    let (x0, y0) = ((sw - width) / 2.0, sh - 16.0 - height);
    d.boxed(
        &Shape::new(x0, y0, width, height, 13.0),
        &fill(&c(&m.dock_bg), 1.0),
        &css::shadows("inset 0 0 0 1px rgba(255,255,255,.28), 0 3px 10px rgba(0,0,0,.12)"),
        1.0,
    );
    let app_shadows = css::shadows("inset 0 1px 0 rgba(255,255,255,.35), 0 1px 2px rgba(0,0,0,.25)");
    let mut x = x0 + 6.0;
    let y = y0 + 5.0;
    let app = |d: &mut Doc, x: f64, bg: &str, glyph: Option<&str>| {
        let s = Shape::new(x, y, 22.0, 42.0, 7.0);
        d.outer_shadows(&s, &app_shadows, 1.0);
        css::background(d, bg, (x, y, 22.0, 42.0), &s.path());
        d.inset_shadows(&s, &app_shadows, 1.0);
        if let Some(g) = glyph {
            app_glyph(d, x + 11.0, y + 21.0, g);
        }
    };
    for (i, (bg, glyph)) in APPS.iter().enumerate() {
        app(d, x, bg, Some(glyph));
        x += 22.0 + if i < 11 { 3.0 } else { 0.0 };
    }
    x += 3.0 + 2.0;
    d.push(&format!(r##"<rect x="{}" y="{}" width="1" height="34" fill="#ffffff" fill-opacity="0.45"/>"##, fmt(x), fmt(y0 + 9.0)));
    x += 1.0 + 2.0 + 3.0;
    app(d, x, "linear-gradient(160deg, #f2f2f4 0%, #c9cbd1 100%)", None);
}

/// One dock glyph from its inline style (width, height, border-radius, background, border,
/// box-shadow, clip-path triangle, rotate), centered at (`cx`, `cy`) and scaled by (0.8, 1.5).
fn app_glyph(d: &mut Doc, cx: f64, cy: f64, style: &str) {
    let mut w = 0.0;
    let mut h = 0.0;
    let mut radius = String::new();
    let mut bg = String::new();
    let mut border = String::new();
    let mut top_transparent = false;
    let mut shadow = String::new();
    let mut tri = false;
    let mut rot = 0.0;
    for decl in style.split(';') {
        let Some((k, v)) = decl.split_once(':') else { continue };
        let v = v.trim();
        match k.trim() {
            "width" => w = css::length(v, 0.0).unwrap_or(0.0),
            "height" => h = css::length(v, 0.0).unwrap_or(0.0),
            "border-radius" => radius = v.to_string(),
            "background" => bg = v.to_string(),
            "border" => border = v.to_string(),
            "border-top-color" => top_transparent = v == "transparent",
            "box-shadow" => shadow = v.to_string(),
            "clip-path" => tri = v.starts_with("polygon"),
            "transform" => rot = v.trim_start_matches("rotate(").trim_end_matches("deg)").parse().unwrap_or(0.0),
            _ => {}
        }
    }
    let r = if radius.ends_with('%') { w.min(h) / 2.0 } else { css::length(&radius, 0.0).unwrap_or(0.0) };
    let (x, y) = (-w / 2.0, -h / 2.0);
    let s = Shape::new(x, y, w, h, r);
    d.push(&format!(r#"<g transform="translate({} {}) scale(0.8 1.5) rotate({})">"#, fmt(cx), fmt(cy), fmt(rot)));
    let sh = css::shadows(&shadow);
    d.outer_shadows(&s, &sh, 1.0);
    if tri {
        d.push(&format!(r#"<path d="M0 {}L{} {}L{} {}Z" {}/>"#, fmt(y), fmt(x + w), fmt(y + h), fmt(x), fmt(y + h), fill(&c(&bg), 1.0)));
    } else if let Some(conic) = bg.strip_prefix("conic-gradient(") {
        let cols: Vec<String> = css::split_top(conic.trim_end_matches(')')).iter().map(|p| c(p.split_whitespace().next().unwrap_or(""))).collect();
        for (i, col) in cols.iter().enumerate() {
            let a0 = i as f64 * 90.0;
            let p = |a: f64| (w / 2.0 * a.to_radians().sin(), -h / 2.0 * a.to_radians().cos());
            let (x0, y0) = p(a0);
            let (x1, y1) = p(a0 + 90.0);
            d.push(&format!(r#"<path d="M0 0L{} {}A{} {} 0 0 1 {} {}Z" {}/>"#, fmt(x0), fmt(y0), fmt(w / 2.0), fmt(h / 2.0), fmt(x1), fmt(y1), fill(col, 1.0)));
        }
    } else if !bg.is_empty() {
        css::background(d, &bg, (x, y, w, h), &s.path());
    }
    if !border.is_empty() {
        let parts: Vec<&str> = border.split_whitespace().collect();
        let bw = parts.first().and_then(|v| css::length(v, 0.0)).unwrap_or(1.0);
        let col = c(&parts[2..].join(" "));
        let inner = s.grow(0.0, 0.0, -bw / 2.0);
        let (rgb, a) = rgb_a(&col, 1.0);
        if top_transparent {
            // The top quarter of the ring is transparent.
            let clip = d.clip(&format!("M0 0L{} {}H{}V{}H{}V{}Z", fmt(-w), fmt(-h), fmt(-w), fmt(h), fmt(w), fmt(-h)));
            let clip2 = d.clip(&format!("M0 0L{} {}V{}H{}Z", fmt(w), fmt(-h), fmt(h * 2.0), fmt(-w * 2.0)));
            d.push(&format!(
                r#"<g clip-path="url(#{clip})"><path clip-path="url(#{clip2})" d="{}" fill="none" stroke="{rgb}" stroke-opacity="{}" stroke-width="{}"/></g>"#,
                inner.path(),
                fmt(a),
                fmt(bw)
            ));
        } else {
            d.push(&format!(r#"<path d="{}" fill="none" stroke="{rgb}" stroke-opacity="{}" stroke-width="{}"/>"#, inner.path(), fmt(a), fmt(bw)));
        }
    }
    d.inset_shadows(&s, &sh, 1.0);
    d.push("</g>");
}

/// Projects the flat lid image (`flat` covers `frame` in CSS px; the lid box is (0, 0, `w`, `h`))
/// with `perspective(4200px) rotateX(-80deg)` about the bottom center. The result covers
/// (`-LID_SIDE`, `-LID_SPACE`) to (`w + LID_SIDE`, 0) relative to the lid's bottom-left corner.
pub fn project(flat: &Pixmap, frame: Frame, w: f64, h: f64, scale: f64) -> (Pixmap, Frame) {
    let out_w = ((w + 2.0 * LID_SIDE) * scale).ceil() as u32;
    let out_h = (LID_SPACE * scale).ceil() as u32;
    let mut out = Pixmap::new(out_w, out_h).expect("lid size");
    // Pre-shrink the source rows: the projection squeezes the lid about 5x vertically.
    let fs = flat.width() as f64 / frame.w;
    let shrink = 4usize;
    let (sw, sh0) = (flat.width() as usize, flat.height() as usize);
    let sh = sh0.div_ceil(shrink);
    let src = flat.data();
    let mut small = vec![0f32; sw * sh * 4];
    for y in 0..sh {
        let n = (shrink).min(sh0 - y * shrink) as f32;
        for yy in 0..shrink.min(sh0 - y * shrink) {
            let row = (y * shrink + yy) * sw * 4;
            let dst = y * sw * 4;
            for i in 0..sw * 4 {
                small[dst + i] += src[row + i] as f32 / n;
            }
        }
    }
    let sample = |fx: f64, fy: f64| -> [f32; 4] {
        // fx, fy in small-image pixel coordinates (pixel centers at +0.5).
        let x = fx - 0.5;
        let y = fy - 0.5;
        let x0 = x.floor();
        let y0 = y.floor();
        let (tx, ty) = ((x - x0) as f32, (y - y0) as f32);
        let mut acc = [0f32; 4];
        for (dx, dy, wgt) in [(0, 0, (1.0 - tx) * (1.0 - ty)), (1, 0, tx * (1.0 - ty)), (0, 1, (1.0 - tx) * ty), (1, 1, tx * ty)] {
            let xi = x0 as i64 + dx;
            let yi = y0 as i64 + dy;
            if xi < 0 || yi < 0 || xi >= sw as i64 || yi >= sh as i64 || wgt == 0.0 {
                continue;
            }
            let o = (yi as usize * sw + xi as usize) * 4;
            for c in 0..4 {
                acc[c] += small[o + c] * wgt;
            }
        }
        acc
    };
    let a = TILT_DEG.to_radians();
    let (s, c) = (a.sin(), a.cos());
    let dist = PERSPECTIVE;
    let data = out.data_mut();
    const SS: [f64; 3] = [1.0 / 6.0, 0.5, 5.0 / 6.0];
    for v in 0..out_h {
        for u in 0..out_w {
            let mut acc = [0f32; 4];
            for oy in SS {
                for ox in SS {
                    // Destination point relative to the bottom center of the lid, CSS px.
                    let xs = (u as f64 + ox) / scale - LID_SIDE - w / 2.0;
                    let ys = (v as f64 + oy) / scale - LID_SPACE;
                    let den = c * dist + ys * s;
                    if den <= 0.0 {
                        continue;
                    }
                    let yy = ys * dist / den;
                    let f = dist / (dist - yy * s);
                    let xx = xs / f;
                    // Flat lid coordinates, then source pixels.
                    let lx = xx + w / 2.0;
                    let ly = yy + h;
                    let px = (lx - frame.x) * fs;
                    let py = (ly - frame.y) * fs / shrink as f64;
                    let p = sample(px, py);
                    for k in 0..4 {
                        acc[k] += p[k];
                    }
                }
            }
            let o = ((v * out_w + u) * 4) as usize;
            let n = (SS.len() * SS.len()) as f32;
            let al = (acc[3] / n).round().clamp(0.0, 255.0);
            for k in 0..3 {
                data[o + k] = (acc[k] / n).round().clamp(0.0, al) as u8;
            }
            data[o + 3] = al as u8;
        }
    }
    let frame = Frame { x: -LID_SIDE, y: -LID_SPACE, w: out_w as f64 / scale, h: out_h as f64 / scale, px_w: out_w, px_h: out_h };
    (out, frame)
}

/// The projected lid of a finish, cached per finish, size and scale. Its frame is relative to the
/// deck's top-left corner.
pub fn lid_art(finish: &str, w: f64, h: f64, scale: f64) -> Arc<Art> {
    let key = (finish.to_string(), w.to_bits(), h.to_bits(), scale.to_bits(), "lid");
    cached(&key, || {
        let (under, rib, over) = flat_lid(finish, w, h);
        let (svg, frame) = under.finish(scale);
        let mut flat = rasterize_svg(&svg).unwrap_or_else(|| Pixmap::new(frame.px_w, frame.px_h).expect("pixmap"));
        let low = (scale / 4.0).max(0.25);
        let (rsvg, rframe) = rib.finish(low);
        let p = tiny_skia::PixmapPaint { quality: tiny_skia::FilterQuality::Bicubic, ..Default::default() };
        if let Some(r) = rasterize_svg(&rsvg) {
            let sx = (rframe.w * scale) / r.width() as f64 * (frame.px_w as f64 / (frame.w * scale));
            let sy = (rframe.h * scale) / r.height() as f64 * (frame.px_h as f64 / (frame.h * scale));
            flat.draw_pixmap(0, 0, r.as_ref(), &p, tiny_skia::Transform::from_scale(sx as f32, sy as f32), None);
        }
        let (osvg, _) = over.finish(scale);
        if let Some(o) = rasterize_svg(&osvg) {
            flat.draw_pixmap(0, 0, o.as_ref(), &tiny_skia::PixmapPaint::default(), tiny_skia::Transform::identity(), None);
        }
        let (pm, f) = project(&flat, frame, w, h, scale);
        Art::new(pm, f)
    })
}
