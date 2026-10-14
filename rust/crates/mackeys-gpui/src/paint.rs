//! Drawing helpers: colors, shadows, gradients and SVG path parsing for GPUI.
use gpui::{
    div, linear_color_stop, linear_gradient, point, px, Background, BoxShadow, Div, Hsla, PathBuilder, Pixels, Point,
    Rgba as GRgba, Styled,
};
use mackeys_core::{to_rgba, Gradient, Shadow};

/// Converts a `#rrggbbaa` color to GPUI, with RGB multiplied by `brightness`.
pub fn hsla(c: &str, brightness: f64) -> Hsla {
    let p = to_rgba(c);
    let k = brightness as f32;
    GRgba {
        r: ((p.r / 255.0) as f32 * k).clamp(0.0, 1.0),
        g: ((p.g / 255.0) as f32 * k).clamp(0.0, 1.0),
        b: ((p.b / 255.0) as f32 * k).clamp(0.0, 1.0),
        a: (p.a as f32).clamp(0.0, 1.0),
    }
    .into()
}

/// Multiplies a color's alpha.
pub fn fade(c: Hsla, k: f32) -> Hsla {
    Hsla { a: (c.a * k).clamp(0.0, 1.0), ..c }
}

pub fn spx(v: f64, s: f32) -> Pixels {
    px(v as f32 * s)
}

/// A vertical (top to bottom) two-color background.
pub fn vgrad(top: Hsla, bottom: Hsla) -> Background {
    linear_gradient(180.0, linear_color_stop(top, 0.0), linear_color_stop(bottom, 1.0))
}

/// The first and last stop of a core gradient, as a GPUI background. GPUI gradients have two stops.
pub fn grad_bg(g: &Gradient, brightness: f64) -> Background {
    let first = g.stops.first().map(|s| hsla(&s.color, brightness)).unwrap_or_default();
    let last = g.stops.last().map(|s| hsla(&s.color, brightness)).unwrap_or(first);
    vgrad(first, last)
}

/// Sets per-corner radii: top-left, top-right, bottom-right, bottom-left.
pub fn corners(d: Div, r: [f64; 4], s: f32) -> Div {
    d.rounded_tl(spx(r[0], s)).rounded_tr(spx(r[1], s)).rounded_br(spx(r[2], s)).rounded_bl(spx(r[3], s))
}

/// A gradient with any number of stops as stacked bands (GPUI gradients have two stops). The bands
/// fill `w` x `h` at (`x`, `y`); the first band gets the top radii, the last the bottom radii.
pub fn gradient_bands(g: &Gradient, x: f64, y: f64, w: f64, h: f64, r: [f64; 4], s: f32) -> Vec<Div> {
    let stops = &g.stops;
    if stops.len() <= 2 {
        return vec![corners(div().absolute().left(spx(x, s)).top(spx(y, s)).w(spx(w, s)).h(spx(h, s)), r, s).bg(grad_bg(g, 1.0))];
    }
    let n = stops.len() - 1;
    (0..n)
        .map(|i| {
            let a = &stops[i];
            let b = &stops[i + 1];
            let y0 = y + h * a.at;
            let hh = h * (b.at - a.at);
            let rr = [
                if i == 0 { r[0] } else { 0.0 },
                if i == 0 { r[1] } else { 0.0 },
                if i == n - 1 { r[2] } else { 0.0 },
                if i == n - 1 { r[3] } else { 0.0 },
            ];
            corners(div().absolute().left(spx(x, s)).top(spx(y0, s)).w(spx(w, s)).h(spx(hh, s)), rr, s)
                .bg(vgrad(hsla(&a.color, 1.0), hsla(&b.color, 1.0)))
        })
        .collect()
}

/// The outer (not inset) shadows, as GPUI box shadows. CSS blur is two sigmas; GPUI blur is one.
pub fn outer_shadows(list: &[Shadow], s: f32) -> Vec<BoxShadow> {
    list.iter()
        .filter(|sh| !sh.inset)
        .map(|sh| BoxShadow {
            color: hsla(&sh.color, 1.0),
            offset: point(spx(sh.x, s), spx(sh.y, s)),
            blur_radius: spx(sh.blur / 2.0, s),
            spread_radius: spx(sh.spread, s),
        })
        .collect()
}

/// Approximates inset shadows with bordered overlays of the same shape (GPUI has no inset shadows).
/// A spread-only ring becomes a border; an offset line becomes a top or bottom border; a blurred top
/// shadow becomes a short vertical fade.
pub fn inset_overlays(list: &[Shadow], w: f64, h: f64, r: [f64; 4], s: f32) -> Vec<Div> {
    let base = || corners(div().absolute().left(px(0.)).top(px(0.)).w(spx(w, s)).h(spx(h, s)), r, s);
    // CSS paints the first shadow on top, so add them in reverse.
    list.iter()
        .rev()
        .filter(|sh| sh.inset)
        .filter_map(|sh| {
            let c = hsla(&sh.color, 1.0);
            if c.a <= 0.0 {
                return None;
            }
            let d = if sh.x == 0.0 && sh.y == 0.0 && sh.blur == 0.0 {
                base().border(spx(sh.spread.max(0.5), s)).border_color(c)
            } else if sh.blur == 0.0 && sh.y > 0.0 {
                base().border_t(spx(sh.y + sh.spread.max(0.0), s)).border_color(c)
            } else if sh.blur == 0.0 && sh.y < 0.0 {
                base().border_b(spx(-sh.y + sh.spread.max(0.0), s)).border_color(c)
            } else if sh.y >= 0.0 {
                let depth = (sh.y + sh.blur).max(1.0);
                base().bg(linear_gradient(
                    180.0,
                    linear_color_stop(fade(c, 0.85), 0.0),
                    linear_color_stop(fade(c, 0.0), (depth / h).min(1.0) as f32),
                ))
            } else {
                let depth = (-sh.y + sh.blur).max(1.0);
                base().bg(linear_gradient(
                    0.0,
                    linear_color_stop(fade(c, 0.85), 0.0),
                    linear_color_stop(fade(c, 0.0), (depth / h).min(1.0) as f32),
                ))
            };
            Some(d)
        })
        .collect()
}

/// One SVG path command, in absolute coordinates.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PathCmd {
    Move(f32, f32),
    Line(f32, f32),
    Cubic(f32, f32, f32, f32, f32, f32),
    Arc { rx: f32, ry: f32, rot: f32, large: bool, sweep: bool, x: f32, y: f32 },
    Close,
}

/// Parses the SVG path subset MacKeys uses (M L H V C A Z, absolute and relative).
pub fn parse_path(d: &str) -> Vec<PathCmd> {
    let b = d.as_bytes();
    let mut i = 0;
    let mut out = vec![];
    let (mut cx, mut cy, mut sx, mut sy) = (0f32, 0f32, 0f32, 0f32);
    let mut cmd = b'M';
    let skip = |i: &mut usize| {
        while *i < b.len() && (b[*i] == b' ' || b[*i] == b',' || b[*i] == b'\n' || b[*i] == b'\t') {
            *i += 1;
        }
    };
    let num = |i: &mut usize| -> Option<f32> {
        skip(i);
        let st = *i;
        if *i < b.len() && (b[*i] == b'-' || b[*i] == b'+') {
            *i += 1;
        }
        let mut dot = false;
        while *i < b.len() && (b[*i].is_ascii_digit() || (b[*i] == b'.' && !dot)) {
            if b[*i] == b'.' {
                dot = true;
            }
            *i += 1;
        }
        if *i < b.len() && (b[*i] == b'e' || b[*i] == b'E') {
            *i += 1;
            if *i < b.len() && (b[*i] == b'-' || b[*i] == b'+') {
                *i += 1;
            }
            while *i < b.len() && b[*i].is_ascii_digit() {
                *i += 1;
            }
        }
        std::str::from_utf8(&b[st..*i]).ok()?.parse().ok()
    };
    let flag = |i: &mut usize| -> Option<bool> {
        skip(i);
        let v = *b.get(*i)?;
        *i += 1;
        Some(v == b'1')
    };
    loop {
        skip(&mut i);
        if i >= b.len() {
            break;
        }
        if b[i].is_ascii_alphabetic() {
            cmd = b[i];
            i += 1;
        }
        let rel = cmd.is_ascii_lowercase();
        let (ox, oy) = if rel { (cx, cy) } else { (0.0, 0.0) };
        match cmd.to_ascii_uppercase() {
            b'Z' => {
                out.push(PathCmd::Close);
                cx = sx;
                cy = sy;
                continue;
            }
            b'M' => {
                let (Some(x), Some(y)) = (num(&mut i), num(&mut i)) else { break };
                cx = ox + x;
                cy = oy + y;
                sx = cx;
                sy = cy;
                out.push(PathCmd::Move(cx, cy));
                cmd = if rel { b'l' } else { b'L' };
            }
            b'L' => {
                let (Some(x), Some(y)) = (num(&mut i), num(&mut i)) else { break };
                cx = ox + x;
                cy = oy + y;
                out.push(PathCmd::Line(cx, cy));
            }
            b'H' => {
                let Some(x) = num(&mut i) else { break };
                cx = ox + x;
                out.push(PathCmd::Line(cx, cy));
            }
            b'V' => {
                let Some(y) = num(&mut i) else { break };
                cy = oy + y;
                out.push(PathCmd::Line(cx, cy));
            }
            b'C' => {
                let v: Vec<f32> = (0..6).filter_map(|_| num(&mut i)).collect();
                if v.len() < 6 {
                    break;
                }
                out.push(PathCmd::Cubic(ox + v[0], oy + v[1], ox + v[2], oy + v[3], ox + v[4], oy + v[5]));
                cx = ox + v[4];
                cy = oy + v[5];
            }
            b'A' => {
                let (Some(rx), Some(ry), Some(rot)) = (num(&mut i), num(&mut i), num(&mut i)) else { break };
                let (Some(large), Some(sweep)) = (flag(&mut i), flag(&mut i)) else { break };
                let (Some(x), Some(y)) = (num(&mut i), num(&mut i)) else { break };
                cx = ox + x;
                cy = oy + y;
                out.push(PathCmd::Arc { rx, ry, rot, large, sweep, x: cx, y: cy });
            }
            _ => break,
        }
    }
    out
}

/// Builds a GPUI path from parsed commands, mapped with `scale` and then moved by `origin`.
pub fn build_path(cmds: &[PathCmd], mut builder: PathBuilder, origin: Point<Pixels>, scale: f32) -> Option<gpui::Path<Pixels>> {
    let p = |x: f32, y: f32| point(origin.x + px(x * scale), origin.y + px(y * scale));
    let mut open = false;
    for c in cmds {
        match *c {
            PathCmd::Move(x, y) => {
                if open {
                    builder.close();
                }
                builder.move_to(p(x, y));
                open = true;
            }
            PathCmd::Line(x, y) => builder.line_to(p(x, y)),
            PathCmd::Cubic(a, b, c2, d, x, y) => builder.cubic_bezier_to(p(x, y), p(a, b), p(c2, d)),
            PathCmd::Arc { rx, ry, rot, large, sweep, x, y } => {
                builder.arc_to(point(px(rx * scale), px(ry * scale)), px(rot), large, sweep, p(x, y))
            }
            PathCmd::Close => {
                builder.close();
                open = false;
            }
        }
    }
    builder.build().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_paths() {
        let c = parse_path("M5.5 .5H10A5 5 0 0 1 15 5.5V20Z");
        assert_eq!(c[0], PathCmd::Move(5.5, 0.5));
        assert_eq!(c[1], PathCmd::Line(10.0, 0.5));
        assert_eq!(c[2], PathCmd::Arc { rx: 5.0, ry: 5.0, rot: 0.0, large: false, sweep: true, x: 15.0, y: 5.5 });
        assert_eq!(c[3], PathCmd::Line(15.0, 20.0));
        assert_eq!(c[4], PathCmd::Close);
        let r = parse_path("m1 1h2v-3l1 1z");
        assert_eq!(r[1], PathCmd::Line(3.0, 1.0));
        assert_eq!(r[2], PathCmd::Line(3.0, -2.0));
        assert_eq!(r[3], PathCmd::Line(4.0, -1.0));
    }
}
