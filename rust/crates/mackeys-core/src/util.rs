//! Number formatting, colors, shadows and gradients. Port of `util.ts`.
use serde::{Deserialize, Serialize};

/// JavaScript `Math.round`: rounds half toward positive infinity.
pub fn js_round(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let f = x.floor();
    if x - f >= 0.5 {
        f + 1.0
    } else {
        f
    }
}

/// Formats a number for path strings: at most 4 decimals, no trailing zeros. `-0` prints as `0`.
pub fn fmt(n: f64) -> String {
    let r = js_round(n * 10000.0) / 10000.0;
    if r == 0.0 || r.is_nan() {
        return "0".to_string();
    }
    let mut s = format!("{:.4}", r);
    while s.ends_with('0') {
        s.pop();
    }
    if s.ends_with('.') {
        s.pop();
    }
    s
}

/// Formats a number the way JavaScript's `String(n)` does for the values this crate prints
/// (integers print without a decimal point).
pub fn js_num(n: f64) -> String {
    if n == n.trunc() && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

/// A color as `#rrggbbaa`. Every color the core returns uses this form.
pub type Color = String;

/// A color with channels 0 to 255 and alpha 0 to 1.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub struct Rgba {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

impl Rgba {
    /// Channels as 0..1 floats: `[r, g, b, a]`.
    pub fn to_unit(self) -> [f32; 4] {
        [
            (self.r / 255.0) as f32,
            (self.g / 255.0) as f32,
            (self.b / 255.0) as f32,
            self.a as f32,
        ]
    }

    /// Packs the color as `0xrrggbbaa`.
    pub fn to_u32(self) -> u32 {
        let c = |v: f64| js_round(v).clamp(0.0, 255.0) as u32;
        (c(self.r) << 24) | (c(self.g) << 16) | (c(self.b) << 8) | c(self.a * 255.0)
    }
}

fn h2(v: f64) -> String {
    let v = if v.is_nan() { 0.0 } else { js_round(v).clamp(0.0, 255.0) };
    format!("{:02x}", v as u32)
}

/// Builds a `#rrggbbaa` color. Alpha is 0 to 1.
pub fn rgba(r: f64, g: f64, b: f64, a: f64) -> Color {
    format!("#{}{}{}{}", h2(r), h2(g), h2(b), h2(a * 255.0))
}

/// JavaScript `parseFloat`: parses the longest valid number prefix. Returns NaN when there is none.
pub fn parse_float(s: &str) -> f64 {
    let s = s.trim_start();
    let b = s.as_bytes();
    let mut i = 0;
    if i < b.len() && (b[i] == b'+' || b[i] == b'-') {
        i += 1;
    }
    let mut digits = false;
    while i < b.len() && b[i].is_ascii_digit() {
        i += 1;
        digits = true;
    }
    if i < b.len() && b[i] == b'.' {
        i += 1;
        while i < b.len() && b[i].is_ascii_digit() {
            i += 1;
            digits = true;
        }
    }
    if !digits {
        return f64::NAN;
    }
    if i < b.len() && (b[i] == b'e' || b[i] == b'E') {
        let mut j = i + 1;
        if j < b.len() && (b[j] == b'+' || b[j] == b'-') {
            j += 1;
        }
        let st = j;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        if j > st {
            i = j;
        }
    }
    let mut t = s[..i].to_string();
    if t.ends_with('.') {
        t.pop();
    }
    if t.starts_with('.') || t.starts_with("-.") || t.starts_with("+.") {
        t = t.replacen('.', "0.", 1);
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

fn hex_pair(h: &str, i: usize) -> f64 {
    match h.get(i..i + 2) {
        Some(p) => u8::from_str_radix(p, 16).map(|v| v as f64).unwrap_or(f64::NAN),
        None => f64::NAN,
    }
}

/// Error for a CSS color this crate cannot read.
#[derive(Debug, Clone, PartialEq)]
pub struct ColorError(pub String);

impl std::fmt::Display for ColorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Unsupported color: {}", self.0)
    }
}
impl std::error::Error for ColorError {}

/// Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` and `transparent`.
pub fn parse_color(css: &str) -> Result<Rgba, ColorError> {
    let s = css.trim().to_lowercase();
    if s == "transparent" {
        return Ok(Rgba { r: 0.0, g: 0.0, b: 0.0, a: 0.0 });
    }
    if let Some(h) = s.strip_prefix('#') {
        let h: String = if h.chars().count() == 3 {
            h.chars().flat_map(|c| [c, c]).collect()
        } else {
            h.to_string()
        };
        let a = if h.len() >= 8 { hex_pair(&h, 6) / 255.0 } else { 1.0 };
        return Ok(Rgba { r: hex_pair(&h, 0), g: hex_pair(&h, 2), b: hex_pair(&h, 4), a });
    }
    let inner = s
        .strip_prefix("rgba(")
        .or_else(|| s.strip_prefix("rgb("))
        .and_then(|r| r.strip_suffix(')'))
        .filter(|r| !r.contains(')'));
    if let Some(inner) = inner {
        let p: Vec<f64> = inner.split(',').map(parse_float).collect();
        let g = |i: usize| p.get(i).copied().unwrap_or(f64::NAN);
        return Ok(Rgba { r: g(0), g: g(1), b: g(2), a: if p.len() > 3 { p[3] } else { 1.0 } });
    }
    Err(ColorError(css.to_string()))
}

/// Parses a color, with transparent black for an unsupported string. Use it on core output colors.
pub fn to_rgba(c: &str) -> Rgba {
    parse_color(c).unwrap_or(Rgba { r: 0.0, g: 0.0, b: 0.0, a: 0.0 })
}

/// Normalizes any supported CSS color to `#rrggbbaa`. Unsupported input gives transparent black.
pub fn color(css: &str) -> Color {
    let c = to_rgba(css);
    rgba(c.r, c.g, c.b, c.a)
}

/// Converts a `#rrggbbaa` color to a CSS color string.
pub fn css_color(c: &str) -> String {
    let p = to_rgba(c);
    if p.a >= 1.0 {
        return format!("#{}", c.get(1..7).unwrap_or("000000"));
    }
    let a = js_round(p.a * 1000.0) / 1000.0;
    format!("rgba({},{},{},{})", js_num(p.r), js_num(p.g), js_num(p.b), js_num(a))
}

/// A CSS box shadow.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Shadow {
    pub x: f64,
    pub y: f64,
    pub blur: f64,
    pub spread: f64,
    pub color: Color,
    pub inset: bool,
}

pub fn shadow(x: f64, y: f64, blur: f64, spread: f64, c: &str, inset: bool) -> Shadow {
    Shadow { x, y, blur, spread, color: color(c), inset }
}

/// One stop of a gradient. `at` is 0 to 1.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GradientStop {
    pub color: Color,
    pub at: f64,
}

/// A vertical (top to bottom) linear gradient.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Gradient {
    pub stops: Vec<GradientStop>,
}

pub fn grad2(a: &[String; 2]) -> Gradient {
    Gradient {
        stops: vec![
            GradientStop { color: color(&a[0]), at: 0.0 },
            GradientStop { color: color(&a[1]), at: 1.0 },
        ],
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fmt_matches_js() {
        assert_eq!(fmt(0.0), "0");
        assert_eq!(fmt(-0.00001), "0");
        assert_eq!(fmt(1.5), "1.5");
        assert_eq!(fmt(12.30004), "12.3");
        assert_eq!(fmt(-3.25), "-3.25");
        assert_eq!(fmt(56.123456), "56.1235");
        assert_eq!(fmt(7.0), "7");
    }

    #[test]
    fn colors() {
        assert_eq!(color("rgba(0,0,0,.55)"), "#0000008c");
        assert_eq!(color("#fff"), "#ffffffff");
        assert_eq!(color("transparent"), "#00000000");
        assert_eq!(css_color("#0000008c"), "rgba(0,0,0,0.549)");
        assert_eq!(to_rgba("#ff000080").to_u32(), 0xff000080);
    }
}
