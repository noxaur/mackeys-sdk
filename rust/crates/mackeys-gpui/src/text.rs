//! Text as vector paths, so legends can carry letter spacing and a glow filter inside the generated
//! key art.
//!
//! The primary font is the macOS system font (`/System/Library/Fonts/SFNS.ttf`, SF Pro). It is a
//! variable font: this module sets the `wght` axis from the CSS weight and the `opsz` axis from the
//! font size, as Chrome and Core Text do. Characters that SF Pro does not have (Hangul, kana, kanji)
//! come from the first system font that has them, in the order of [`FALLBACK_FAMILIES`]. Text is
//! shaped with `rustybuzz` (kerning, ligatures) and the glyph outlines become one SVG path.
//!
//! When no font file is found (for example, on Linux without SF Pro), [`shape`] returns an empty path
//! with an estimated width; nothing panics.
use rustybuzz::ttf_parser::{GlyphId, OutlineBuilder, Tag};
use std::collections::HashMap;
use std::fmt::Write as _;
use std::sync::{Arc, Mutex, OnceLock};

/// Font files tried for the primary font, in order.
pub const PRIMARY_FONTS: &[&str] = &["/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/HelveticaNeue.ttc"];

/// Families searched for characters the primary font does not have.
pub const FALLBACK_FAMILIES: &[&str] = &[
    "Apple SD Gothic Neo",
    "Hiragino Sans",
    "Hiragino Kaku Gothic ProN",
    "PingFang SC",
    "Helvetica Neue",
    "Apple Symbols",
    "Arial Unicode MS",
];

/// Text style: size in px, CSS weight (400 regular), letter spacing in em, and the optical size
/// (the `opsz` axis and the `trak` table) in points.
///
/// Chrome on macOS sets the optical size from the size in device pixels (2 x the CSS size on a
/// Retina screen), so the references use that; [`TextStyle::new`] does the same for scale 2.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TextStyle {
    pub size: f32,
    pub weight: f32,
    pub tracking: f32,
    pub optical: f32,
}

impl TextStyle {
    pub fn new(size: f32) -> Self {
        TextStyle { size, weight: 400.0, tracking: 0.0, optical: size * 2.0 }
    }

    /// The style at `size` px with letter spacing `tracking` em, for `scale` device pixels per px.
    pub fn at(size: f32, tracking: f32, scale: f32) -> Self {
        TextStyle { size, weight: 400.0, tracking, optical: size * scale }
    }
}

/// Shaped text: one SVG path with the baseline at y = 0 and the pen starting at x = 0.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Shaped {
    pub path: String,
    /// The advance width, including letter spacing after each character (as CSS does).
    pub width: f32,
}

#[derive(Clone)]
struct FontFile {
    data: Arc<Vec<u8>>,
    index: u32,
}

struct Fonts {
    primary: Option<FontFile>,
    /// Line metrics of the primary font, per em: ascent, descent (positive).
    ascent: f32,
    descent: f32,
    db: Option<fontdb::Database>,
    fallback: HashMap<char, Option<FontFile>>,
    files: HashMap<(String, u32), FontFile>,
}

fn fonts() -> &'static Mutex<Fonts> {
    static F: OnceLock<Mutex<Fonts>> = OnceLock::new();
    F.get_or_init(|| {
        let mut primary = None;
        let (mut ascent, mut descent) = (0.95, 0.24);
        for p in PRIMARY_FONTS {
            if let Ok(data) = std::fs::read(p) {
                if let Ok(face) = rustybuzz::ttf_parser::Face::parse(&data, 0) {
                    let upm = face.units_per_em() as f32;
                    ascent = face.ascender() as f32 / upm;
                    descent = -(face.descender() as f32) / upm;
                    primary = Some(FontFile { data: Arc::new(data), index: 0 });
                    break;
                }
            }
        }
        Mutex::new(Fonts { primary, ascent, descent, db: None, fallback: HashMap::new(), files: HashMap::new() })
    })
}

/// True when the primary (system) font file was found.
pub fn has_system_font() -> bool {
    fonts().lock().map(|f| f.primary.is_some()).unwrap_or(false)
}

/// The primary font's ascent and descent per em (hhea). A CSS line box of height `size` with
/// `line-height: 1` puts the baseline at `top + size * baseline_offset()`.
pub fn line_metrics() -> (f32, f32) {
    fonts().lock().map(|f| (f.ascent, f.descent)).unwrap_or((0.95, 0.24))
}

/// The baseline offset in a `line-height: 1` box, per em: half-leading plus ascent.
pub fn baseline_offset() -> f32 {
    let (a, d) = line_metrics();
    (1.0 - (a + d)) / 2.0 + a
}

fn has_glyph(f: &FontFile, c: char) -> bool {
    rustybuzz::ttf_parser::Face::parse(&f.data, f.index).map(|face| face.glyph_index(c).is_some()).unwrap_or(false)
}

impl Fonts {
    fn font_for(&mut self, c: char) -> Option<FontFile> {
        if let Some(p) = &self.primary {
            if c.is_whitespace() || has_glyph(p, c) {
                return Some(p.clone());
            }
        }
        if let Some(f) = self.fallback.get(&c) {
            return f.clone();
        }
        if self.db.is_none() {
            let mut db = fontdb::Database::new();
            db.load_system_fonts();
            self.db = Some(db);
        }
        let db = self.db.as_ref()?;
        let mut found = None;
        let mut candidates: Vec<fontdb::ID> = vec![];
        for fam in FALLBACK_FAMILIES {
            for face in db.faces() {
                if face.families.iter().any(|(n, _)| n == fam) && face.weight.0 == 400 && face.style == fontdb::Style::Normal {
                    candidates.push(face.id);
                }
            }
            for face in db.faces() {
                if face.families.iter().any(|(n, _)| n == fam) {
                    candidates.push(face.id);
                }
            }
        }
        candidates.extend(db.faces().map(|f| f.id));
        for id in candidates {
            let Some((src, index)) = db.face_source(id) else { continue };
            let path = match &src {
                fontdb::Source::File(p) => p.to_string_lossy().to_string(),
                fontdb::Source::SharedFile(p, _) => p.to_string_lossy().to_string(),
                _ => continue,
            };
            let key = (path.clone(), index);
            let file = if let Some(f) = self.files.get(&key) {
                f.clone()
            } else {
                let Ok(data) = std::fs::read(&path) else { continue };
                let f = FontFile { data: Arc::new(data), index };
                self.files.insert(key, f.clone());
                f
            };
            if has_glyph(&file, c) {
                found = Some(file);
                break;
            }
        }
        self.fallback.insert(c, found.clone());
        found
    }
}

struct PathSink<'a> {
    out: &'a mut String,
    x: f32,
    y: f32,
    k: f32,
}

impl PathSink<'_> {
    fn p(&mut self, x: f32, y: f32) {
        let _ = write!(self.out, "{} {} ", r3(self.x + x * self.k), r3(self.y - y * self.k));
    }
}

fn r3(v: f32) -> f32 {
    (v * 1000.0).round() / 1000.0
}

impl OutlineBuilder for PathSink<'_> {
    fn move_to(&mut self, x: f32, y: f32) {
        self.out.push('M');
        self.p(x, y);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.out.push('L');
        self.p(x, y);
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.out.push('Q');
        self.p(x1, y1);
        self.p(x, y);
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.out.push('C');
        self.p(x1, y1);
        self.p(x2, y2);
        self.p(x, y);
    }
    fn close(&mut self) {
        self.out.push('Z');
    }
}

/// Splits text into runs of one font each.
fn runs(f: &mut Fonts, text: &str) -> Vec<(Option<FontFile>, String)> {
    let mut out: Vec<(Option<FontFile>, String)> = vec![];
    for c in text.chars() {
        let font = f.font_for(c);
        let same = match (out.last(), &font) {
            (Some((Some(a), _)), Some(b)) => Arc::ptr_eq(&a.data, &b.data) && a.index == b.index,
            (Some((None, _)), None) => true,
            _ => false,
        };
        if same {
            out.last_mut().unwrap().1.push(c);
        } else {
            out.push((font, c.to_string()));
        }
    }
    out
}

/// Text, size, weight, tracking and optical size bits.
type ShapeKey = (String, u32, u32, i32, u32);

fn shape_cache() -> &'static Mutex<HashMap<ShapeKey, Shaped>> {
    static C: OnceLock<Mutex<HashMap<ShapeKey, Shaped>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Shapes `text` and returns its outline as one SVG path (baseline at y = 0).
pub fn shape(text: &str, style: TextStyle) -> Shaped {
    let key = (text.to_string(), style.size.to_bits(), style.weight.to_bits(), (style.tracking * 10000.0).round() as i32, style.optical.to_bits());
    if let Some(s) = shape_cache().lock().ok().and_then(|c| c.get(&key).cloned()) {
        return s;
    }
    let s = shape_uncached(text, style);
    if let Ok(mut c) = shape_cache().lock() {
        c.insert(key, s.clone());
    }
    s
}

fn shape_uncached(text: &str, style: TextStyle) -> Shaped {
    let Ok(mut f) = fonts().lock() else { return Shaped::default() };
    let spacing = style.tracking * style.size;
    let mut out = String::new();
    let mut pen = 0.0f32;
    for (font, run) in runs(&mut f, text) {
        let Some(font) = font else {
            pen += run.chars().count() as f32 * (style.size * 0.55 + spacing);
            continue;
        };
        let Some(mut face) = rustybuzz::Face::from_slice(&font.data, font.index) else { continue };
        let axes: Vec<_> = face.variation_axes().into_iter().collect();
        let mut vars = vec![];
        for a in &axes {
            if a.tag == Tag::from_bytes(b"wght") {
                vars.push(rustybuzz::Variation { tag: a.tag, value: style.weight.clamp(a.min_value, a.max_value) });
            } else if a.tag == Tag::from_bytes(b"opsz") {
                vars.push(rustybuzz::Variation { tag: a.tag, value: style.optical.clamp(a.min_value, a.max_value) });
            }
        }
        if !vars.is_empty() {
            face.set_variations(&vars);
        }
        face.set_points_per_em(Some(style.optical));
        let k = style.size / face.units_per_em() as f32;
        let mut buf = rustybuzz::UnicodeBuffer::new();
        buf.push_str(&run);
        let glyphs = rustybuzz::shape(&face, &[], buf);
        let infos = glyphs.glyph_infos();
        let pos = glyphs.glyph_positions();
        for (i, (gi, gp)) in infos.iter().zip(pos).enumerate() {
            let mut sink = PathSink { out: &mut out, x: pen + gp.x_offset as f32 * k, y: -(gp.y_offset as f32) * k, k };
            let _ = face.outline_glyph(GlyphId(gi.glyph_id as u16), &mut sink);
            pen += gp.x_advance as f32 * k;
            // Letter spacing goes after each cluster (character), as in CSS.
            let next_cluster = infos.get(i + 1).map(|n| n.cluster);
            if next_cluster != Some(gi.cluster) {
                pen += spacing;
            }
        }
    }
    Shaped { path: out, width: pen }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shapes_text() {
        let s = shape("esc", TextStyle::new(14.0));
        assert!(s.width > 10.0 && s.width < 40.0, "width {}", s.width);
        if has_system_font() {
            assert!(s.path.starts_with('M'), "path {:?}", &s.path[..s.path.len().min(80)]);
            let t = shape("esc", TextStyle { tracking: 0.1, ..TextStyle::new(14.0) });
            assert!((t.width - s.width - 3.0 * 1.4).abs() < 0.01);
            let ko = shape("한", TextStyle::new(14.0));
            assert!(!ko.path.is_empty());
        }
        let (a, d) = line_metrics();
        assert!(a > 0.5 && d > 0.1);
    }
}
