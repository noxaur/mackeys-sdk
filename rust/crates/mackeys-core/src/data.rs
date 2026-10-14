//! Static data for every Mac keyboard and trackpad, loaded from `spec/mackeys-data.json`.
//! Port of `data.ts`.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::OnceLock;

/// The raw spec file, embedded at build time (see `build.rs`).
pub const DATA_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/mackeys-data.json"));

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ModelId {
    Pro,
    Air,
    Neo,
    Mk,
}

impl ModelId {
    pub fn as_str(self) -> &'static str {
        match self {
            ModelId::Pro => "pro",
            ModelId::Air => "air",
            ModelId::Neo => "neo",
            ModelId::Mk => "mk",
        }
    }
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ModelSpec {
    /// Top case width and depth in px.
    pub W: f64,
    pub H: f64,
    /// Distance from the top edge to the first key row.
    pub kbY: f64,
    /// Padding of the recessed keyboard well around the keys.
    pub wellPad: f64,
    pub padW: f64,
    pub padY: f64,
    pub padH: f64,
    pub hingeX: f64,
    /// Speaker grilles left and right of the keyboard.
    pub grille: bool,
    /// Corner radii: top-left, top-right, bottom-right, bottom-left.
    pub radius: [f64; 4],
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Models {
    pub pro: ModelSpec,
    pub air: ModelSpec,
    pub neo: ModelSpec,
    pub mk: ModelSpec,
}

impl Models {
    pub fn get(&self, m: ModelId) -> &ModelSpec {
        match m {
            ModelId::Pro => &self.pro,
            ModelId::Air => &self.air,
            ModelId::Neo => &self.neo,
            ModelId::Mk => &self.mk,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FinishSpec {
    pub id: String,
    pub name: String,
    pub model: ModelId,
    pub dark: bool,
    pub deck: [String; 2],
    pub pad: [String; 2],
    pub side: [String; 2],
    pub lid: [String; 3],
    pub edge: String,
    /// Speaker grille dot color.
    pub dot: String,
    /// Light key caps (Neo and Magic Keyboard): face and legend colors.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kf: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kl: Option<String>,
    /// Lid screen wallpaper, as a CSS background (web renderers only).
    pub wall: String,
    /// `[ribbon A, highlight, ribbon B, dark ink (1) or light ink (0), ribbon C?]`.
    pub ribbon: Vec<Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutSpec {
    pub id: String,
    pub name: String,
    /// ISO: tall return key and an extra key beside left shift.
    pub iso: bool,
    /// English word legends on MacBook Pro and Air.
    pub en: bool,
    #[serde(default)]
    pub jis: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caps: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub num: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub a: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub z: Option<String>,
}

/// A user-defined layout. Rows use the legend syntax of [`LayoutSpec`].
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomLayout {
    /// `ISO` or `ANSI`.
    pub kind: String,
    pub num: String,
    pub q: String,
    pub a: String,
    /// The key beside left shift (ISO only).
    pub x: String,
    pub z: String,
}

/// A partial custom layout: `None` fields take the default.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CustomLayoutPatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub num: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub a: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub z: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Glyph {
    /// Accessible name of the key's function.
    pub name: String,
    /// Drawn size in px.
    pub w: f64,
    pub h: f64,
    pub view_box: [f64; 4],
    /// Path drawn with a stroke (round caps and joins).
    pub stroke: String,
    /// Path drawn filled.
    pub fill: String,
    pub stroke_width: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draw_w: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draw_h: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ModGlyphs {
    pub ctrl: Glyph,
    pub opt: Glyph,
    pub cmd: Glyph,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct IconGlyphs {
    pub tab: Glyph,
    pub caps: Glyph,
    pub shift: Glyph,
    pub del: Glyph,
    pub ret: Glyph,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ArrowGlyphs {
    pub up: Glyph,
    pub down: Glyph,
    pub left: Glyph,
    pub right: Glyph,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Glyphs {
    pub fkeys: Vec<Glyph>,
    pub mods: ModGlyphs,
    pub icons: IconGlyphs,
    pub globe: Glyph,
    pub arrows: ArrowGlyphs,
}

/// Japanese JIS rows: `[shifted, base, kana, small kana, width in units]`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Jis {
    pub num: Vec<Vec<Value>>,
    pub q_letters: Vec<Vec<Value>>,
    pub q_symbols: Vec<Vec<Value>>,
    pub a_letters: Vec<Vec<Value>>,
    pub a_symbols: Vec<Vec<Value>>,
    pub z_letters: Vec<Vec<Value>>,
    pub z_symbols: Vec<Vec<Value>>,
}

/// The whole spec data file.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Data {
    pub version: u32,
    pub unit: f64,
    pub row_pitch: f64,
    pub models: Models,
    pub finishes: Vec<FinishSpec>,
    pub layouts: Vec<LayoutSpec>,
    pub default_custom_layout: CustomLayout,
    pub jis: Jis,
    pub glyphs: Glyphs,
}

/// The parsed spec data. Parsed once on first use.
pub fn data() -> &'static Data {
    static D: OnceLock<Data> = OnceLock::new();
    D.get_or_init(|| serde_json::from_str(DATA_JSON).expect("mackeys-data.json is valid"))
}

/// Every finish id, in canvas order.
pub fn finish_ids() -> Vec<&'static str> {
    data().finishes.iter().map(|f| f.id.as_str()).collect()
}

/// Every built-in layout id, in canvas order (without `custom`).
pub fn layout_ids() -> Vec<&'static str> {
    data().layouts.iter().map(|l| l.id.as_str()).collect()
}

/// Finds a finish by id or name. Unknown ids fall back to `pro-space-black`.
pub fn get_finish(id: &str) -> &'static FinishSpec {
    let d = data();
    d.finishes.iter().find(|f| f.id == id || f.name == id).unwrap_or(&d.finishes[0])
}

/// Finds a layout by id or name. Unknown ids fall back to `en-us`.
pub fn get_layout(id: &str) -> &'static LayoutSpec {
    let d = data();
    d.layouts.iter().find(|l| l.id == id || l.name == id).unwrap_or(&d.layouts[0])
}

/// The model spec of a model id.
pub fn model(m: ModelId) -> &'static ModelSpec {
    data().models.get(m)
}
