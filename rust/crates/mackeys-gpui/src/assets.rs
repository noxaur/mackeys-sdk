//! An [`AssetSource`] that serves the SVG documents MacKeys generates at run time: key glyphs and
//! speaker grille dot grids. GPUI's `svg()` element loads SVGs through the app's asset source and tints
//! them with `text_color`, so every glyph is one single-color SVG.
use gpui::{AssetSource, Result, SharedString};
use mackeys_core::{fmt, KeyIcon};
use std::borrow::Cow;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex, OnceLock};

/// Every asset path this crate serves starts with this prefix.
pub const ASSET_PREFIX: &str = "mackeys/";

fn registry() -> &'static Mutex<HashMap<String, Arc<[u8]>>> {
    static R: OnceLock<Mutex<HashMap<String, Arc<[u8]>>>> = OnceLock::new();
    R.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register(kind: &str, svg: String) -> SharedString {
    let mut h = DefaultHasher::new();
    svg.hash(&mut h);
    let path = format!("{ASSET_PREFIX}{kind}/{:016x}.svg", h.finish());
    if let Ok(mut r) = registry().lock() {
        r.entry(path.clone()).or_insert_with(|| Arc::from(svg.into_bytes()));
    }
    path.into()
}

/// Looks up a generated SVG by path.
pub fn load_generated(path: &str) -> Option<Arc<[u8]>> {
    registry().lock().ok().and_then(|r| r.get(path).cloned())
}

/// The SVG document of a key icon: the glyph's viewBox mapped into the icon rect ("meet"), the fill
/// path filled and the stroke path stroked with round caps and joins. Returns its asset path.
pub fn glyph_svg(icon: &KeyIcon) -> SharedString {
    let vb = icon.view_box;
    let mut body = String::new();
    if !icon.fill.is_empty() {
        body += &format!(r##"<path d="{}" fill="#000"/>"##, icon.fill);
    }
    if !icon.stroke.is_empty() {
        body += &format!(
            r##"<path d="{}" fill="none" stroke="#000" stroke-width="{}" stroke-linecap="round" stroke-linejoin="round"/>"##,
            icon.stroke,
            fmt(icon.stroke_width)
        );
    }
    let svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="{} {} {} {}" overflow="visible">{}</svg>"#,
        fmt(icon.w),
        fmt(icon.h),
        fmt(vb[0]),
        fmt(vb[1]),
        fmt(vb[2]),
        fmt(vb[3]),
        body
    );
    register("glyph", svg)
}

/// A speaker grille: dots of radius `r` on a `pitch` grid, centered in a `w` x `h` box (as CSS
/// `background-position: center` places the tiles). Returns its asset path.
pub fn grille_svg(w: f64, h: f64, pitch: f64, r: f64) -> SharedString {
    let mut body = String::new();
    let nx = (w / 2.0 / pitch).floor() as i64 + 1;
    let ny = (h / 2.0 / pitch).floor() as i64 + 1;
    for j in -ny..=ny {
        let cy = h / 2.0 + j as f64 * pitch;
        if cy < -r || cy > h + r {
            continue;
        }
        for i in -nx..=nx {
            let cx = w / 2.0 + i as f64 * pitch;
            if cx < -r || cx > w + r {
                continue;
            }
            body += &format!(r#"<circle cx="{}" cy="{}" r="{}"/>"#, fmt(cx), fmt(cy), fmt(r));
        }
    }
    let svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{0}" height="{1}" viewBox="0 0 {0} {1}">{2}</svg>"#,
        fmt(w),
        fmt(h),
        body
    );
    register("grille", svg)
}

/// The asset source to pass to `Application::with_assets`. It serves the generated SVGs and hands
/// every other path to an optional fallback source (your app's own assets).
pub struct MacKeysAssets {
    fallback: Option<Box<dyn AssetSource>>,
}

impl MacKeysAssets {
    pub fn new() -> Self {
        MacKeysAssets { fallback: None }
    }

    /// Serves MacKeys SVGs and forwards every other path to `other`.
    pub fn with_fallback(other: impl AssetSource) -> Self {
        MacKeysAssets { fallback: Some(Box::new(other)) }
    }
}

impl Default for MacKeysAssets {
    fn default() -> Self {
        Self::new()
    }
}

impl AssetSource for MacKeysAssets {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        if path.starts_with(ASSET_PREFIX) {
            return Ok(load_generated(path).map(|b| Cow::Owned(b.to_vec())));
        }
        match &self.fallback {
            Some(f) => f.load(path),
            None => Ok(None),
        }
    }

    fn list(&self, path: &str) -> Result<Vec<SharedString>> {
        let mut out: Vec<SharedString> = match registry().lock() {
            Ok(r) => r.keys().filter(|k| k.starts_with(path)).map(|k| SharedString::from(k.clone())).collect(),
            Err(_) => vec![],
        };
        if let Some(f) = &self.fallback {
            out.extend(f.list(path)?);
        }
        Ok(out)
    }
}
