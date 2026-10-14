//! A small parser for the CSS values the web lid uses: layered `linear-gradient` and
//! `radial-gradient` backgrounds, colors and `box-shadow` lists. It turns them into SVG through
//! [`crate::art::Doc`].
use crate::art::{fill, Doc};
use mackeys_core::{color, Shadow};

/// Splits at commas that are not inside parentheses.
pub fn split_top(s: &str) -> Vec<String> {
    let mut out = vec![];
    let mut depth = 0i32;
    let mut cur = String::new();
    for c in s.chars() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => {
                out.push(cur.trim().to_string());
                cur.clear();
                continue;
            }
            _ => {}
        }
        cur.push(c);
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_string());
    }
    out
}

/// Splits at spaces that are not inside parentheses.
fn tokens(s: &str) -> Vec<String> {
    let mut out = vec![];
    let mut depth = 0i32;
    let mut cur = String::new();
    for c in s.chars() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            ' ' | '\t' | '\n' if depth == 0 => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
                continue;
            }
            _ => {}
        }
        cur.push(c);
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// A CSS color (`#rgb`, `#rrggbb`, `rgb()`, `rgba()`, `transparent`) as `#rrggbbaa`.
pub fn css_color(s: &str) -> Option<String> {
    let s = s.trim();
    if s.starts_with('#') || s.starts_with("rgb") || s == "transparent" {
        mackeys_core::parse_color(s).ok().map(|_| color(s))
    } else {
        None
    }
}

/// A length: `px`, `%` of `basis`, or a bare number (px).
pub fn length(s: &str, basis: f64) -> Option<f64> {
    let s = s.trim();
    if let Some(p) = s.strip_suffix('%') {
        return p.parse::<f64>().ok().map(|v| v / 100.0 * basis);
    }
    if let Some(p) = s.strip_suffix("px") {
        return p.parse().ok();
    }
    if let Some(p) = s.strip_suffix("deg") {
        return p.parse().ok();
    }
    s.parse().ok()
}

/// Color stops with positions resolved (0 to 1), as CSS does: a missing first stop is 0, a missing
/// last stop is 1, missing middle stops are spread evenly, and a stop never goes before the one
/// before it. A stop with two positions becomes two stops.
pub fn stops(list: &[String]) -> Vec<(String, f64)> {
    let mut raw: Vec<(String, Option<f64>)> = vec![];
    for s in list {
        let t = tokens(s);
        let Some(c) = t.first().and_then(|c| css_color(c)) else { continue };
        let ps: Vec<f64> = t[1..].iter().filter_map(|p| length(p, 1.0)).collect();
        if ps.is_empty() {
            raw.push((c.clone(), None));
        }
        for p in ps {
            raw.push((c.clone(), Some(p)));
        }
    }
    let n = raw.len();
    if n == 0 {
        return vec![];
    }
    if raw[0].1.is_none() {
        raw[0].1 = Some(0.0);
    }
    if raw[n - 1].1.is_none() {
        raw[n - 1].1 = Some(1.0);
    }
    let mut i = 0;
    while i < n {
        if raw[i].1.is_none() {
            let start = i - 1;
            let mut end = i;
            while raw[end].1.is_none() {
                end += 1;
            }
            let (a, b) = (raw[start].1.unwrap(), raw[end].1.unwrap());
            for (j, r) in raw.iter_mut().enumerate().take(end).skip(i) {
                r.1 = Some(a + (b - a) * (j - start) as f64 / (end - start) as f64);
            }
            i = end;
        }
        i += 1;
    }
    let mut max: f64 = 0.0;
    raw.into_iter()
        .map(|(c, p)| {
            max = max.max(p.unwrap_or(0.0));
            (c, max)
        })
        .collect()
}

/// Paints a CSS `background` made of gradient layers (and plain colors) over the box `b`
/// (x, y, w, h), clipped to `clip_d` when given. The last layer is painted first, as in CSS.
pub fn background(doc: &mut Doc, css: &str, b: (f64, f64, f64, f64), clip_d: &str) {
    let (x, y, w, h) = b;
    for layer in split_top(css).iter().rev() {
        let paint = if let Some(args) = layer.strip_prefix("linear-gradient(").and_then(|a| a.strip_suffix(')')) {
            let parts = split_top(args);
            let (angle, rest) = match parts.first().and_then(|p| p.strip_suffix("deg")).and_then(|a| a.trim().parse::<f64>().ok()) {
                Some(a) => (a, &parts[1..]),
                None => (180.0, &parts[..]),
            };
            let st = stops(rest);
            format!(r#"fill="url(#{})""#, doc.css_linear(angle, &st, b))
        } else if let Some(args) = layer.strip_prefix("radial-gradient(").and_then(|a| a.strip_suffix(')')) {
            let parts = split_top(args);
            let first = parts.first().cloned().unwrap_or_default();
            let has_config = css_color(tokens(&first).first().map(String::as_str).unwrap_or("")).is_none();
            let (cfg, rest) = if has_config { (first, &parts[1..]) } else { (String::new(), &parts[..]) };
            let (size, at) = match cfg.split_once(" at ") {
                Some((s, a)) => (s.trim().to_string(), a.trim().to_string()),
                None if cfg.trim().starts_with("at ") => (String::new(), cfg.trim()[3..].to_string()),
                None => (cfg.trim().to_string(), String::new()),
            };
            let at_t = tokens(&at);
            let cx = x + at_t.first().and_then(|v| length(v, w)).unwrap_or(w / 2.0);
            let cy = y + at_t.get(1).and_then(|v| length(v, h)).unwrap_or(h / 2.0);
            let st = tokens(&size);
            let dx = (cx - x).abs().max((x + w - cx).abs());
            let dy = (cy - y).abs().max((y + h - cy).abs());
            let (rx, ry) = if st.first().map(String::as_str) == Some("circle") || st.is_empty() && size == "circle" {
                let r = (dx * dx + dy * dy).sqrt();
                (r, r)
            } else if st.len() >= 2 {
                (length(&st[0], w).unwrap_or(w / 2.0), length(&st[1], h).unwrap_or(h / 2.0))
            } else {
                // farthest-corner ellipse: the closest-side ratio scaled by sqrt(2).
                (dx * std::f64::consts::SQRT_2, dy * std::f64::consts::SQRT_2)
            };
            let st = stops(rest);
            format!(r#"fill="url(#{})""#, doc.css_radial(cx, cy, rx, ry, &st))
        } else if let Some(c) = css_color(layer) {
            fill(&c, 1.0)
        } else {
            continue;
        };
        let clip = if clip_d.is_empty() { String::new() } else { format!(r#" clip-path="url(#{})""#, doc.clip(clip_d)) };
        doc.push(&format!(r#"<rect x="{}" y="{}" width="{}" height="{}" {paint}{clip}/>"#, x, y, w, h));
    }
}

/// Parses a CSS `box-shadow` list.
pub fn shadows(css: &str) -> Vec<Shadow> {
    split_top(css)
        .iter()
        .filter_map(|s| {
            let t = tokens(s);
            let inset = t.iter().any(|v| v == "inset");
            let mut nums = vec![];
            let mut c = None;
            for v in t.iter().filter(|v| *v != "inset") {
                if let Some(col) = css_color(v) {
                    c = Some(col);
                } else if let Some(n) = length(v, 1.0) {
                    nums.push(n);
                }
            }
            let c = c?;
            let g = |i: usize| nums.get(i).copied().unwrap_or(0.0);
            Some(Shadow { x: g(0), y: g(1), blur: g(2), spread: g(3), color: c, inset })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stops_and_shadows() {
        let s = stops(&["#000".into(), "#fff 30%".into(), "#f00".into()]);
        assert_eq!(s, vec![("#000000ff".into(), 0.0), ("#ffffffff".into(), 0.3), ("#ff0000ff".into(), 1.0)]);
        let s = stops(&["#ff3b30 0 30%".into(), "#ffffff 30%".into()]);
        assert_eq!(s.len(), 3);
        assert_eq!(s[1].1, 0.3);
        let sh = shadows("inset 0 0 0 1px rgba(255,255,255,.28), 0 4px 12px rgba(0,0,0,.18)");
        assert_eq!(sh.len(), 2);
        assert!(sh[0].inset && sh[0].spread == 1.0);
        assert_eq!((sh[1].y, sh[1].blur), (4.0, 12.0));
        assert_eq!(split_top("a(1, 2), b").len(), 2);
    }
}
