//! The keyboard layout engine. Port of `keyboard.ts`.
//!
//! It turns a finish and a layout into key caps with absolute geometry: every legend, icon, LED and
//! home bar has a resolved position, so a renderer only draws.
use crate::data::{data, get_finish, get_layout, CustomLayoutPatch, Glyph, ModelId};
use crate::util::{fmt, Rect};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::rc::Rc;

/// Key pitch across (19.0 mm) in px.
pub const UNIT: f64 = 64.0;
/// Key pitch down (18.5 mm) in px.
pub const ROW_PITCH: f64 = 62.3;

/// `mb` = MacBook Pro and Air legend metrics, `mk` = MacBook Neo and Magic Keyboard.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LegendStyle {
    Mb,
    Mk,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum KeyKind {
    Char,
    Dual,
    Quad,
    Jis,
    Word,
    Icon,
    Mod,
    Fn,
    Fkey,
    Touchid,
    Space,
    Arrow,
    Kana,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum KeySound {
    Key,
    Wide,
    Space,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Align {
    Left,
    Center,
    Right,
}

/// Which slot the legend came from: t = top, b = bottom, c = bottom right, d = top right.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Slot {
    T,
    B,
    C,
    D,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Legend {
    pub text: String,
    /// Font size in px. The line box is one font size high.
    pub size: f64,
    /// Letter spacing in em.
    pub tracking: f64,
    /// `center` centers across the key. `left` and `right` measure `inset` from that edge.
    pub align: Align,
    pub inset: f64,
    /// Top of the line box, from the top of the key.
    pub top: f64,
    pub slot: Slot,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyIcon {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// The glyph's viewBox, mapped into the rect with uniform scale ("meet").
    pub view_box: [f64; 4],
    pub stroke: String,
    pub fill: String,
    /// Stroke width in viewBox units.
    pub stroke_width: f64,
}

/// The outline of an L-shaped ISO or JIS return key, in key coordinates.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IsoShape {
    pub path: String,
    /// The top highlight line.
    pub highlight: String,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapsLed {
    pub x: f64,
    pub y: f64,
    pub d: f64,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TouchIdSpec {
    pub d: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyCap {
    /// `KeyboardEvent.code` for the key, or `Fn` and `TouchID`.
    pub id: String,
    /// Accessible name.
    pub label: String,
    pub kind: KeyKind,
    pub row: u32,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub radius: f64,
    pub sound: KeySound,
    pub legends: Vec<Legend>,
    pub icon: Option<KeyIcon>,
    pub iso: Option<IsoShape>,
    pub home_bar: Option<Rect>,
    /// The caps lock LED: top-left corner and diameter.
    pub caps_led: Option<CapsLed>,
    pub touch_id: Option<TouchIdSpec>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardGeometry {
    pub finish: String,
    /// A layout id or `custom`.
    pub layout: String,
    pub model: ModelId,
    pub style: LegendStyle,
    /// Light key caps with dark legends (MacBook Neo, Magic Keyboard).
    pub light_keys: bool,
    /// MacBook Pro and Air have a backlight; Neo and Magic Keyboard have none.
    pub backlit: bool,
    pub width: f64,
    pub height: f64,
    pub gap: f64,
    pub cap_height: f64,
    pub keys: Vec<KeyCap>,
}

impl KeyboardGeometry {
    pub fn key(&self, id: &str) -> Option<&KeyCap> {
        self.keys.iter().find(|k| k.id == id)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finish: Option<String>,
    /// A layout id, a layout name, or `custom`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom: Option<CustomLayoutPatch>,
}

impl KeyboardOptions {
    pub fn new(finish: impl Into<String>, layout: impl Into<String>) -> Self {
        KeyboardOptions { finish: Some(finish.into()), layout: Some(layout.into()), custom: None }
    }
}

#[derive(Clone, Copy)]
struct GlobePos {
    left: f64,
    bottom: f64,
}

#[derive(Clone, Copy)]
struct Metrics {
    ws: f64,
    wb: f64,
    dt: f64,
    db: f64,
    fb: f64,
    cx: f64,
    cy: f64,
    fnr: f64,
    sym_top: f64,
    sym_side: f64,
    side: f64,
    ic_b: f64,
    f_icon: f64,
    globe: GlobePos,
}

#[derive(Clone, Copy, PartialEq)]
enum FnStyle {
    Top,
    Pair,
    Globe,
}

#[derive(Clone, Copy)]
struct StyleSpec {
    mb: bool,
    words: bool,
    inner: bool,
    fn_: FnStyle,
    lr_full: bool,
}

fn styles(model: ModelId) -> StyleSpec {
    match model {
        ModelId::Pro => StyleSpec { mb: true, words: true, inner: true, fn_: FnStyle::Top, lr_full: false },
        ModelId::Air => StyleSpec { mb: true, words: true, inner: false, fn_: FnStyle::Pair, lr_full: false },
        ModelId::Neo => StyleSpec { mb: false, words: false, inner: false, fn_: FnStyle::Pair, lr_full: false },
        ModelId::Mk => StyleSpec { mb: false, words: false, inner: false, fn_: FnStyle::Globe, lr_full: true },
    }
}

fn metrics(model: ModelId) -> Metrics {
    let st = styles(model);
    if st.mb {
        return Metrics {
            ws: 9.6,
            wb: 7.15,
            dt: 8.1,
            db: 7.9,
            fb: 8.6,
            cx: 10.8,
            cy: 11.1,
            fnr: 9.3,
            sym_top: 8.7,
            sym_side: 9.3,
            side: 9.6,
            ic_b: 9.0,
            f_icon: 19.6,
            globe: if st.fn_ == FnStyle::Top { GlobePos { left: 10.6, bottom: 8.6 } } else { GlobePos { left: 9.6, bottom: 8.4 } },
        };
    }
    if model == ModelId::Mk {
        return Metrics {
            ws: 10.1,
            wb: 7.9,
            dt: 9.7,
            db: 6.7,
            fb: 8.8,
            cx: 10.0,
            cy: 10.6,
            fnr: 9.6,
            sym_top: 10.3,
            sym_side: 10.0,
            side: 9.8,
            ic_b: 9.2,
            f_icon: 19.3,
            globe: GlobePos { left: 11.0, bottom: 10.5 },
        };
    }
    Metrics {
        ws: 10.9,
        wb: 8.0,
        dt: 9.8,
        db: 7.8,
        fb: 8.5,
        cx: 11.0,
        cy: 11.0,
        fnr: 9.7,
        sym_top: 10.3,
        sym_side: 11.0,
        side: 11.0,
        ic_b: 9.6,
        f_icon: 20.6,
        globe: GlobePos { left: 11.0, bottom: 9.6 },
    }
}

/// Splits a string into Unicode scalar values (JavaScript code points).
fn chars(s: &str) -> Vec<String> {
    s.chars().map(|c| c.to_string()).collect()
}

type IconRecipe = Rc<dyn Fn(f64, f64) -> KeyIcon>;

/// One key before placement: legends by slot, CSS-like class tags, and an optional icon recipe.
#[derive(Clone, Default)]
pub struct Proto {
    pub u: Option<f64>,
    pub tags: Vec<&'static str>,
    kind: Option<KeyKind>,
    pub t: Option<String>,
    pub b: Option<String>,
    pub c: Option<String>,
    pub d: Option<String>,
    pub label: String,
    pub code: Option<String>,
    pub home: bool,
    pub touch_id: bool,
    icon: Option<IconRecipe>,
}

impl Proto {
    pub fn kind(&self) -> KeyKind {
        self.kind.unwrap_or(KeyKind::Char)
    }
    fn slot(&self, s: Slot) -> &str {
        let v = match s {
            Slot::T => &self.t,
            Slot::B => &self.b,
            Slot::C => &self.c,
            Slot::D => &self.d,
        };
        v.as_deref().unwrap_or("")
    }
}

fn icon_from(g: &Glyph, x: f64, y: f64, w: f64, h: f64) -> KeyIcon {
    KeyIcon { x, y, w, h, view_box: g.view_box, stroke: g.stroke.clone(), fill: g.fill.clone(), stroke_width: g.stroke_width }
}

fn is_letter(s: &str) -> bool {
    s.chars().any(|c| c.is_alphabetic() && !is_non_letter_alphabetic(c))
}

/// `char::is_alphabetic` also covers `Nl` (letter numbers) and `Other_Alphabetic` marks; `\p{L}` does not.
/// Exclude the common ranges of those so the test matches `\p{L}` for keyboard legends.
fn is_non_letter_alphabetic(c: char) -> bool {
    let u = c as u32;
    // Roman numerals and other letter numbers (Nl).
    (0x2160..=0x2188).contains(&u) || (0x3021..=0x3029).contains(&u) || (0x3038..=0x303A).contains(&u) || u == 0x3007
        // Combining marks that are Other_Alphabetic (Mn/Mc), common blocks.
        || (0x0300..=0x036F).contains(&u)
        || (0x0591..=0x05C7).contains(&u)
        || (0x0610..=0x061A).contains(&u)
        || (0x064B..=0x065F).contains(&u)
        || (0x0900..=0x0903).contains(&u)
        || (0x093A..=0x094F).contains(&u)
        || u == 0x24B6 || (0x24B6..=0x24E9).contains(&u)
}

/// Parses one legend token. See [`crate::data::LayoutSpec`] for the syntax.
pub fn parse_token(s: &str) -> Proto {
    let cs = chars(s);
    let sep = cs.iter().position(|c| c == "¦");
    if let Some(sep) = sep.filter(|&i| i > 0) {
        let dot = |ch: &String| if ch == "·" { String::new() } else { ch.clone() };
        let lc: Vec<String> = cs[..sep].iter().map(dot).collect();
        let rc: Vec<String> = cs[sep + 1..].iter().map(dot).collect();
        let tl = lc.first().cloned().unwrap_or_default();
        let bl = if lc.len() > 1 { lc[1].clone() } else { String::new() };
        let tr = if rc.len() > 1 { rc[0].clone() } else { String::new() };
        let br = if rc.len() > 1 { rc[1].clone() } else { rc.first().cloned().unwrap_or_default() };
        let big = is_letter(&format!("{tl}{bl}{tr}{br}"));
        let four = [tl.clone(), bl.clone(), tr.clone(), br.clone()];
        let lat = four
            .iter()
            .find(|ch| ch.len() == 1 && ch.as_bytes()[0].is_ascii_uppercase())
            .cloned()
            .unwrap_or_default();
        let label = four.iter().filter(|x| !x.is_empty()).cloned().collect::<Vec<_>>().join(" ");
        return Proto {
            tags: if big { vec!["quad", "qbig"] } else { vec!["quad"] },
            kind: Some(KeyKind::Quad),
            t: Some(tl),
            b: Some(bl),
            d: Some(tr),
            c: Some(br),
            label,
            home: lat == "F" || lat == "J",
            ..Default::default()
        };
    }
    if cs.len() == 1 || cs.get(1).map(|c| c == "|").unwrap_or(false) {
        let first = cs.first().cloned().unwrap_or_default();
        return Proto {
            tags: vec!["char"],
            kind: Some(KeyKind::Char),
            t: Some(first.clone()),
            c: Some(cs.iter().skip(2).cloned().collect()),
            label: if first.is_empty() { "blank".into() } else { first },
            home: s == "F" || s == "J",
            ..Default::default()
        };
    }
    let c0 = cs.first().cloned();
    let c1 = cs.get(1).cloned();
    let brk = matches!(c0.as_deref(), Some("{") | Some("}") | Some("|"));
    Proto {
        tags: if brk { vec!["dual", "brk"] } else { vec!["dual"] },
        kind: Some(KeyKind::Dual),
        label: format!("{} {}", c1.as_deref().unwrap_or("undefined"), c0.as_deref().unwrap_or("undefined")),
        t: c0,
        b: c1,
        c: Some(cs.iter().skip(2).cloned().collect()),
        ..Default::default()
    }
}

fn fit(s: &str, n: usize) -> String {
    let mut a: Vec<&str> = s.split_whitespace().collect();
    while a.len() < n {
        a.push("·");
    }
    a.truncate(n);
    a.join(" ")
}

struct ResolvedLayout {
    id: String,
    custom: bool,
    iso: bool,
    en: bool,
    jis: bool,
    caps: Option<String>,
    num: Option<String>,
    q: Option<String>,
    a: Option<String>,
    x: Option<String>,
    z: Option<String>,
}

fn resolve_layout(layout: &str, custom: Option<&CustomLayoutPatch>) -> ResolvedLayout {
    if layout == "custom" || layout == "Custom" {
        let d = &data().default_custom_layout;
        let p = custom.cloned().unwrap_or_default();
        let kind = p.kind.unwrap_or_else(|| d.kind.clone());
        let iso = kind != "ANSI";
        let num = p.num.unwrap_or_else(|| d.num.clone());
        let q = p.q.unwrap_or_else(|| d.q.clone());
        let a = p.a.unwrap_or_else(|| d.a.clone());
        let x = p.x.unwrap_or_else(|| d.x.clone());
        let z = p.z.unwrap_or_else(|| d.z.clone());
        return ResolvedLayout {
            id: "en-us".into(),
            custom: true,
            iso,
            en: false,
            jis: false,
            caps: None,
            num: Some(fit(&num, 13)),
            q: Some(fit(&q, if iso { 12 } else { 13 })),
            a: Some(fit(&a, if iso { 12 } else { 11 })),
            x: Some(fit(&x, 1)),
            z: Some(fit(&z, 10)),
        };
    }
    let l = get_layout(layout);
    ResolvedLayout {
        id: l.id.clone(),
        custom: false,
        iso: l.iso,
        en: l.en,
        jis: l.jis,
        caps: l.caps.clone(),
        num: l.num.clone(),
        q: l.q.clone(),
        a: l.a.clone(),
        x: l.x.clone(),
        z: l.z.clone(),
    }
}

fn vstr(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        _ => String::new(),
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Side {
    L,
    R,
}

#[derive(Clone, Copy)]
enum IconName {
    Tab,
    Caps,
    Shift,
    Del,
    Ret,
}

fn icon_glyph(n: IconName) -> &'static Glyph {
    let g = &data().glyphs.icons;
    match n {
        IconName::Tab => &g.tab,
        IconName::Caps => &g.caps,
        IconName::Shift => &g.shift,
        IconName::Del => &g.del,
        IconName::Ret => &g.ret,
    }
}

#[derive(Clone, Copy)]
enum ModName {
    Ctrl,
    Opt,
    Cmd,
}

/// Builds the full key geometry for one finish and layout.
pub fn build_keyboard(opts: &KeyboardOptions) -> KeyboardGeometry {
    let f = get_finish(opts.finish.as_deref().unwrap_or("pro-space-black"));
    let l = resolve_layout(opts.layout.as_deref().unwrap_or("en-us"), opts.custom.as_ref());
    let model = f.model;
    let st = styles(model);
    let lm = metrics(model);
    let style = if st.mb { LegendStyle::Mb } else { LegendStyle::Mk };
    let mb = style == LegendStyle::Mb;
    let light_keys = model == ModelId::Neo || model == ModelId::Mk;
    let glyphs = &data().glyphs;

    let u_ = UNIT;
    let v_ = ROW_PITCH;
    let g_ = if st.mb { 7.0 } else if model == ModelId::Mk { 8.6 } else { 7.3 };
    let kh = if st.mb { 55.4 } else if model == ModelId::Mk { 53.8 } else { 55.2 };
    let kw = |u: f64| u * u_ - g_;
    let mut keys: Vec<KeyCap> = Vec::new();
    let en = l.en && st.words;

    // Legend placement: the cascade of the canvas's CSS, resolved to numbers.
    let place = |tags: &[&str], slot: Slot, text: &str, _w: f64, h: f64| -> Option<Legend> {
        if text.is_empty() {
            return None;
        }
        let has = |t: &str| tags.contains(&t);
        let l0 = |size: f64, align: Align, inset: f64, top: f64, tracking: f64| Legend {
            text: text.to_string(),
            size,
            tracking,
            align,
            inset,
            top,
            slot,
        };
        let bottom = |size: f64, align: Align, inset: f64, b: f64, tracking: f64| l0(size, align, inset, h - b - size, tracking);
        let r = match slot {
            Slot::T => {
                if has("jisL") {
                    l0(16.0, Align::Left, 10.0, h / 2.0 - 10.0, 0.0)
                } else if has("jis") {
                    l0(10.5, Align::Center, 0.0, 7.0, 0.0)
                } else if has("quad") {
                    l0(if has("qbig") { 15.0 } else { 12.0 }, Align::Left, 9.0, 8.0, 0.0)
                } else if has("fnt") {
                    l0(12.2, Align::Right, 9.2, 7.25, 0.0)
                } else if has("brk") {
                    l0(if mb { 15.5 } else { 13.6 }, Align::Center, 0.0, if mb { 7.5 } else { 8.4 }, 0.0)
                } else if has("dual") {
                    l0(if mb { 14.4 } else { 12.6 }, Align::Center, 0.0, lm.dt, 0.0)
                } else if has("char") {
                    l0(if mb { 18.4 } else { 17.6 }, Align::Center, 0.0, if mb { 18.7 } else { 18.8 }, 0.0)
                } else {
                    l0(12.0, Align::Left, 0.0, 0.0, 0.0)
                }
            }
            Slot::B => {
                if has("jis") {
                    l0(16.0, Align::Left, 10.0, h / 2.0 - 8.0, 0.0)
                } else if has("quad") {
                    bottom(if has("qbig") { 15.0 } else { 13.5 }, Align::Left, 9.0, 8.0, 0.0)
                } else if has("cent") {
                    l0(12.5, Align::Center, 0.0, h / 2.0 - 6.5, 0.0)
                } else if has("fkey") {
                    bottom(if mb { 7.6 } else { 7.5 }, Align::Center, 0.0, lm.fb, 0.02)
                } else if has("wl") || has("wr") || has("fnb") {
                    let size = if mb { 12.2 } else { 11.2 };
                    let tr = if mb { 0.005 } else { 0.02 };
                    if has("fnb") {
                        bottom(size, Align::Right, lm.fnr, lm.wb, tr)
                    } else {
                        bottom(size, if has("wl") { Align::Left } else { Align::Right }, lm.ws, lm.wb, tr)
                    }
                } else if has("brk") {
                    bottom(if mb { 16.0 } else { 14.6 }, Align::Center, 0.0, if mb { 8.4 } else { 7.4 }, 0.0)
                } else if has("dual") {
                    bottom(if mb { 17.8 } else { 17.6 }, Align::Center, 0.0, lm.db, 0.0)
                } else {
                    l0(12.0, Align::Left, 0.0, 0.0, 0.0)
                }
            }
            Slot::C => {
                if has("jis") {
                    bottom(10.5, Align::Center, 0.0, 7.0, 0.0)
                } else if has("quad") {
                    bottom(if has("qbig") { 15.0 } else { 13.5 }, Align::Right, 9.0, 8.0, 0.0)
                } else if has("dual") {
                    bottom(10.5, Align::Right, 9.0, 11.0, 0.0)
                } else {
                    bottom(10.5, Align::Right, 9.0, 9.0, 0.0)
                }
            }
            Slot::D => {
                if has("jis") {
                    l0(9.5, Align::Right, 9.0, h / 2.0 - 5.0, 0.0)
                } else {
                    l0(if has("qbig") { 15.0 } else { 12.0 }, Align::Right, 9.0, 8.0, 0.0)
                }
            }
        };
        Some(r)
    };

    let add = |keys: &mut Vec<KeyCap>, p: &Proto, x: f64, y: f64, w: f64, h: f64, row: u32| -> usize {
        let tags = &p.tags;
        let legends: Vec<Legend> = [Slot::T, Slot::B, Slot::C, Slot::D]
            .iter()
            .filter_map(|&s| place(tags, s, p.slot(s), w, h))
            .collect();
        let mut home_bar = None;
        if p.home {
            home_bar = Some(if tags.contains(&"jis") {
                Rect { x: w * 0.55 - 3.0, y: h / 2.0 - 1.0, w: 6.0, h: 1.6 }
            } else if tags.contains(&"quad") {
                Rect { x: w / 2.0 - 4.5, y: h / 2.0 - 1.0, w: 9.0, h: 1.6 }
            } else {
                Rect { x: w / 2.0 - 5.4, y: 43.3, w: 10.8, h: 1.6 }
            });
        }
        let caps_led = if tags.contains(&"caps") {
            Some(CapsLed { x: lm.cx, y: if tags.contains(&"capsj") { h / 2.0 - 1.9 } else { lm.cy }, d: 3.8 })
        } else {
            None
        };
        let id = match &p.code {
            Some(c) if !c.is_empty() => c.clone(),
            _ => {
                if p.touch_id {
                    "TouchID".to_string()
                } else {
                    format!("k{}", keys.len())
                }
            }
        };
        let kind = p.kind();
        keys.push(KeyCap {
            id,
            label: p.label.clone(),
            kind,
            row,
            x,
            y,
            w,
            h,
            radius: if kind == KeyKind::Arrow { 4.0 } else { 5.0 },
            sound: if tags.contains(&"space") {
                KeySound::Space
            } else if w > 1.4 * u_ {
                KeySound::Wide
            } else {
                KeySound::Key
            },
            legends,
            icon: p.icon.as_ref().map(|f| f(w, h)),
            iso: None,
            home_bar,
            caps_led,
            touch_id: if p.touch_id {
                Some(TouchIdSpec { d: if model == ModelId::Neo { 34.4 } else if light_keys { 33.2 } else { 33.3 } })
            } else {
                None
            },
        });
        keys.len() - 1
    };

    let row = |keys: &mut Vec<KeyCap>, r: u32, items: Vec<Proto>, codes: &[&str]| -> f64 {
        let mut x = 0.0;
        for (i, it) in items.into_iter().enumerate() {
            let u = it.u.unwrap_or(1.0);
            let code = match codes.get(i) {
                Some(c) if !c.is_empty() => c.to_string(),
                _ => it.code.clone().unwrap_or_default(),
            };
            let p = Proto { code: Some(code), ..it };
            add(keys, &p, x, r as f64 * v_, kw(u), kh, r);
            x += u * u_;
        }
        x
    };

    let icon_at = |name: IconName, side: Side, top: Option<f64>| -> IconRecipe {
        Rc::new(move |w: f64, h: f64| {
            let g = icon_glyph(name);
            let x = if side == Side::L { lm.side } else { w - lm.side - g.w };
            let y = top.unwrap_or(h - lm.ic_b - g.h);
            icon_from(g, x, y, g.w, g.h)
        })
    };
    let word = |u: f64, side: Side, en_word: &str, ic: IconName, label: &str, extra: &[&'static str]| -> Proto {
        if en {
            let mut tags = vec![if side == Side::L { "wl" } else { "wr" }];
            tags.extend_from_slice(extra);
            return Proto { u: Some(u), tags, kind: Some(KeyKind::Word), b: Some(en_word.into()), label: label.into(), ..Default::default() };
        }
        if let (IconName::Caps, Some(caps)) = (ic, &l.caps) {
            let mut tags = vec!["wl"];
            tags.extend_from_slice(extra);
            return Proto { u: Some(u), tags, kind: Some(KeyKind::Word), b: Some(caps.clone()), label: label.into(), ..Default::default() };
        }
        Proto { u: Some(u), tags: extra.to_vec(), kind: Some(KeyKind::Icon), label: label.into(), icon: Some(icon_at(ic, side, None)), ..Default::default() }
    };
    let mod_key = |kind: ModName, side: Side, word: &str, label: &str, u: f64| -> Proto {
        let sym_right = (side == Side::L) == st.inner;
        Proto {
            u: Some(u),
            tags: vec![if sym_right { "wr" } else { "wl" }],
            kind: Some(KeyKind::Mod),
            b: Some(word.into()),
            label: label.into(),
            icon: Some(Rc::new(move |w: f64, _h: f64| {
                let m = &data().glyphs.mods;
                let g = match kind {
                    ModName::Ctrl => &m.ctrl,
                    ModName::Opt => &m.opt,
                    ModName::Cmd => &m.cmd,
                };
                icon_from(g, if sym_right { w - lm.sym_side - g.w } else { lm.sym_side }, lm.sym_top, g.w, g.h)
            })),
            ..Default::default()
        }
    };
    let globe: IconRecipe = Rc::new(move |_w: f64, h: f64| {
        let g = &data().glyphs.globe;
        icon_from(g, lm.globe.left, h - lm.globe.bottom - g.h, g.w, g.h)
    });
    let lshape = |w: f64, h: f64, top_w: f64, bot_w: f64, j: f64| -> IsoShape {
        let e = 0.5;
        let r = 5.0;
        let rr = 5.0;
        let x_t = w - top_w + e;
        let x_b = w - bot_w + e;
        let rt = w - e;
        let tp = e;
        let bt = h - e;
        let n = fmt;
        let rs = "5";
        let mut d = format!(
            "M{} {}H{}A{rs} {rs} 0 0 1 {} {}V{}A{rs} {rs} 0 0 1 {} {}H{}A{rs} {rs} 0 0 1 {} {}",
            n(x_t + r),
            n(tp),
            n(rt - r),
            n(rt),
            n(tp + r),
            n(bt - r),
            n(rt - r),
            n(bt),
            n(x_b + r),
            n(x_b),
            n(bt - r)
        );
        if x_b > x_t {
            d += &format!(
                "V{}A{rs} {rs} 0 0 0 {} {}H{}A{rs} {rs} 0 0 1 {} {}",
                n(j + rr),
                n(x_b - rr),
                n(j),
                n(x_t + r),
                n(x_t),
                n(j - r)
            );
        } else {
            d += &format!(
                "V{}A{rs} {rs} 0 0 1 {} {}H{}A{rs} {rs} 0 0 0 {} {}",
                n(j + r),
                n(x_b + r),
                n(j),
                n(x_t - rr),
                n(x_t),
                n(j - rr)
            );
        }
        d += &format!("V{}A{rs} {rs} 0 0 1 {} {}Z", n(tp + r), n(x_t + r), n(tp));
        IsoShape { path: d, highlight: format!("M{} 1.4H{}", n(x_t + 3.0), n(rt - 3.0)) }
    };
    let let_codes = |s: &str| -> Vec<String> { s.chars().map(|c| format!("Key{c}")).collect() };
    let dig: Vec<String> = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].iter().map(|d| format!("Digit{d}")).collect();
    let toks = |s: &Option<String>| -> Vec<Proto> { s.as_deref().unwrap_or("").split(' ').map(parse_token).collect() };
    fn codes_of(parts: Vec<Vec<String>>) -> Vec<String> {
        parts.into_iter().flatten().collect()
    }
    let sv = |a: &[&str]| -> Vec<String> { a.iter().map(|s| s.to_string()).collect() };

    // Row 0: escape, F1 to F12, Touch ID.
    let mut frow: Vec<Proto> = vec![Proto {
        u: Some(1.5),
        tags: vec!["wl"],
        kind: Some(KeyKind::Word),
        b: Some("esc".into()),
        label: "escape".into(),
        ..Default::default()
    }];
    for (i, g) in glyphs.fkeys.iter().enumerate() {
        let w = g.draw_w.unwrap_or(g.w);
        let h = g.draw_h.unwrap_or(g.h);
        let f_icon = lm.f_icon;
        frow.push(Proto {
            tags: vec!["fkey"],
            kind: Some(KeyKind::Fkey),
            b: Some(format!("F{}", i + 1)),
            label: format!("F{}, {}", i + 1, g.name),
            icon: Some(Rc::new(move |kwid: f64, _h: f64| icon_from(g, kwid / 2.0 - w / 2.0, f_icon - h / 2.0, w, h))),
            ..Default::default()
        });
    }
    frow.push(Proto { tags: vec!["touch"], kind: Some(KeyKind::Touchid), label: "Touch ID".into(), touch_id: true, ..Default::default() });
    let mut fcodes = vec!["Escape".to_string()];
    fcodes.extend((1..=12).map(|n| format!("F{n}")));
    fn r(v: &[String]) -> Vec<&str> {
        v.iter().map(|s| s.as_str()).collect()
    }
    row(&mut keys, 0, frow, &r(&fcodes));

    if l.jis {
        let jis = &data().jis;
        let j_ = |arr: &Vec<Vec<Value>>| -> Vec<Proto> {
            arr.iter()
                .map(|a| {
                    let s0 = vstr(a.first());
                    let s1 = vstr(a.get(1));
                    let s2 = vstr(a.get(2));
                    let u = a.get(4).and_then(|v| v.as_f64()).filter(|&v| v != 0.0).unwrap_or(1.0);
                    Proto {
                        u: Some(u),
                        tags: vec!["jis"],
                        kind: Some(KeyKind::Jis),
                        label: format!("{} {}", if s1.is_empty() { &s0 } else { &s1 }, s2),
                        t: Some(s0),
                        b: Some(s1),
                        c: Some(s2),
                        d: Some(vstr(a.get(3))),
                        ..Default::default()
                    }
                })
                .collect()
        };
        let jl = |arr: &Vec<Vec<Value>>| -> Vec<Proto> {
            arr.iter()
                .map(|a| {
                    let s0 = vstr(a.first());
                    let s1 = vstr(a.get(1));
                    Proto {
                        tags: vec!["jis", "jisL"],
                        kind: Some(KeyKind::Jis),
                        label: format!("{} {}", s0, s1),
                        home: s0 == "F" || s0 == "J",
                        t: Some(s0),
                        c: Some(s1),
                        d: Some(vstr(a.get(2))),
                        ..Default::default()
                    }
                })
                .collect()
        };
        let mut r1 = j_(&jis.num);
        r1.push(word(1.25, Side::R, "delete", IconName::Del, "delete", &[]));
        let c1 = codes_of(vec![dig.clone(), sv(&["Minus", "Equal", "IntlYen", "Backspace"])]);
        row(&mut keys, 1, r1, &r(&c1));

        let mut r2 = vec![word(1.0, Side::L, "tab", IconName::Tab, "tab", &[])];
        r2.extend(jl(&jis.q_letters));
        r2.extend(j_(&jis.q_symbols));
        let c2 = codes_of(vec![sv(&["Tab"]), let_codes("QWERTYUIOP"), sv(&["BracketLeft", "BracketRight"])]);
        row(&mut keys, 2, r2, &r(&c2));

        let ret = word(1.5, Side::R, "return", IconName::Ret, "return", &[]);
        let mut tags = ret.tags.clone();
        tags.push("iso");
        let p = Proto { code: Some("Enter".into()), tags, ..ret };
        let k = add(&mut keys, &p, 13.0 * u_, 2.0 * v_, kw(1.5), kh + v_, 2);
        keys[k].iso = Some(lshape(kw(1.5), kh + v_, kw(1.5), kw(1.25), kh));

        let mut r3 = vec![mod_key(ModName::Ctrl, Side::L, "control", "control", 1.25)];
        r3.extend(jl(&jis.a_letters));
        r3.extend(j_(&jis.a_symbols));
        let c3 = codes_of(vec![sv(&["ControlLeft"]), let_codes("ASDFGHJKL"), sv(&["Semicolon", "Quote", "Backslash"])]);
        row(&mut keys, 3, r3, &r(&c3));

        let mut r4 = vec![word(1.75, Side::L, "shift", IconName::Shift, "shift", &[])];
        r4.extend(jl(&jis.z_letters));
        r4.extend(j_(&jis.z_symbols));
        r4.push(word(1.75, Side::R, "shift", IconName::Shift, "right shift", &[]));
        let c4 = codes_of(vec![
            sv(&["ShiftLeft"]),
            let_codes("ZXCVBNM"),
            sv(&["Comma", "Period", "Slash", "IntlRo", "ShiftRight"]),
        ]);
        row(&mut keys, 4, r4, &r(&c4));
    } else if !l.iso {
        let mut r1 = toks(&l.num);
        r1.push(word(1.5, Side::R, "delete", IconName::Del, "delete", &[]));
        let c1 = codes_of(vec![sv(&["Backquote"]), dig.clone(), sv(&["Minus", "Equal", "Backspace"])]);
        row(&mut keys, 1, r1, &r(&c1));

        let mut r2 = vec![word(1.5, Side::L, "tab", IconName::Tab, "tab", &[])];
        r2.extend(toks(&l.q));
        let c2 = codes_of(vec![sv(&["Tab"]), let_codes("QWERTYUIOP"), sv(&["BracketLeft", "BracketRight", "Backslash"])]);
        row(&mut keys, 2, r2, &r(&c2));

        let mut r3 = vec![word(1.75, Side::L, "caps lock", IconName::Caps, "caps lock", &["caps"])];
        r3.extend(toks(&l.a));
        r3.push(word(1.75, Side::R, "return", IconName::Ret, "return", &[]));
        let c3 = codes_of(vec![sv(&["CapsLock"]), let_codes("ASDFGHJKL"), sv(&["Semicolon", "Quote", "Enter"])]);
        row(&mut keys, 3, r3, &r(&c3));

        let mut r4 = vec![word(2.25, Side::L, "shift", IconName::Shift, "shift", &[])];
        r4.extend(toks(&l.z));
        r4.push(word(2.25, Side::R, "shift", IconName::Shift, "right shift", &[]));
        let c4 = codes_of(vec![sv(&["ShiftLeft"]), let_codes("ZXCVBNM"), sv(&["Comma", "Period", "Slash", "ShiftRight"])]);
        row(&mut keys, 4, r4, &r(&c4));
    } else {
        let mut r1 = toks(&l.num);
        r1.push(word(1.5, Side::R, "delete", IconName::Del, "delete", &[]));
        let c1 = codes_of(vec![sv(&["IntlBackslash"]), dig.clone(), sv(&["Minus", "Equal", "Backspace"])]);
        row(&mut keys, 1, r1, &r(&c1));

        let mut r2 = vec![word(1.25, Side::L, "tab", IconName::Tab, "tab", &[])];
        r2.extend(toks(&l.q));
        let c2 = codes_of(vec![sv(&["Tab"]), let_codes("QWERTYUIOP"), sv(&["BracketLeft", "BracketRight"])]);
        let x = row(&mut keys, 2, r2, &r(&c2));

        let ret = word(1.25, Side::R, "return", IconName::Ret, "return", &[]);
        let mut tags = ret.tags.clone();
        tags.push("iso");
        let p = Proto { code: Some("Enter".into()), tags, ..ret };
        let k = add(&mut keys, &p, x, 2.0 * v_, kw(1.25), kh + v_, 2);
        keys[k].iso = Some(lshape(kw(1.25), kh + v_, kw(1.25), kw(1.0), kh));

        let mut r3 = vec![word(1.5, Side::L, "caps lock", IconName::Caps, "caps lock", &["caps"])];
        r3.extend(toks(&l.a));
        let c3 = codes_of(vec![sv(&["CapsLock"]), let_codes("ASDFGHJKL"), sv(&["Semicolon", "Quote", "Backslash"])]);
        row(&mut keys, 3, r3, &r(&c3));

        let mut r4 = vec![word(1.25, Side::L, "shift", IconName::Shift, "shift", &[])];
        r4.extend(toks(&l.x));
        r4.extend(toks(&l.z));
        r4.push(word(2.25, Side::R, "shift", IconName::Shift, "right shift", &[]));
        let c4 = codes_of(vec![
            sv(&["ShiftLeft", "Backquote"]),
            let_codes("ZXCVBNM"),
            sv(&["Comma", "Period", "Slash", "ShiftRight"]),
        ]);
        row(&mut keys, 4, r4, &r(&c4));
    }

    let fn_key = match st.fn_ {
        FnStyle::Top => Proto {
            tags: vec!["fnt"],
            kind: Some(KeyKind::Fn),
            t: Some("fn".into()),
            label: "fn, globe".into(),
            code: Some("Fn".into()),
            icon: Some(globe.clone()),
            ..Default::default()
        },
        FnStyle::Pair => Proto {
            tags: vec!["fnb"],
            kind: Some(KeyKind::Fn),
            b: Some("fn".into()),
            label: "fn, globe".into(),
            code: Some("Fn".into()),
            icon: Some(globe.clone()),
            ..Default::default()
        },
        FnStyle::Globe => Proto {
            tags: vec![],
            kind: Some(KeyKind::Fn),
            label: "globe".into(),
            code: Some("Fn".into()),
            icon: Some(globe.clone()),
            ..Default::default()
        },
    };
    let ax = if l.jis {
        let caps_icon = icon_at(IconName::Caps, Side::L, Some(21.0));
        let items = vec![
            Proto {
                tags: vec!["caps", "capsj"],
                kind: Some(KeyKind::Icon),
                label: "caps lock".into(),
                icon: Some(Rc::new(move |w: f64, h: f64| KeyIcon { x: 20.0, ..caps_icon(w, h) })),
                ..Default::default()
            },
            mod_key(ModName::Opt, Side::L, "option", "option", 1.0),
            mod_key(ModName::Cmd, Side::L, "command", "command", 1.25),
            Proto { u: Some(1.25), tags: vec!["cent"], kind: Some(KeyKind::Kana), b: Some("英数".into()), label: "eisu".into(), ..Default::default() },
            Proto { u: Some(3.5), tags: vec!["space"], kind: Some(KeyKind::Space), label: "space".into(), ..Default::default() },
            Proto { u: Some(1.25), tags: vec!["cent"], kind: Some(KeyKind::Kana), b: Some("かな".into()), label: "kana".into(), ..Default::default() },
            mod_key(ModName::Cmd, Side::R, "command", "right command", 1.25),
            fn_key,
        ];
        row(&mut keys, 5, items, &["CapsLock", "AltLeft", "MetaLeft", "Lang2", "Space", "Lang1", "MetaRight", "Fn"])
    } else {
        let items = vec![
            fn_key,
            mod_key(ModName::Ctrl, Side::L, "control", "control", 1.0),
            mod_key(ModName::Opt, Side::L, "option", "option", 1.0),
            mod_key(ModName::Cmd, Side::L, "command", "command", 1.25),
            Proto { u: Some(5.0), tags: vec!["space"], kind: Some(KeyKind::Space), label: "space".into(), ..Default::default() },
            mod_key(ModName::Cmd, Side::R, "command", "right command", 1.25),
            mod_key(ModName::Opt, Side::R, "option", "right option", 1.0),
        ];
        row(&mut keys, 5, items, &["Fn", "ControlLeft", "AltLeft", "MetaLeft", "Space", "MetaRight", "AltRight"])
    };

    // Inverted T. Up and down share one cap height with a hairline between them; Magic Keyboard has
    // full-height left and right.
    let ah = (kh - 1.6) / 2.0;
    let y5 = 5.0 * v_;
    let mut arrow = |x: f64, y: f64, h: f64, dir: &str, code: &str| {
        let a = &glyphs.arrows;
        let g = match dir {
            "up" => &a.up,
            "down" => &a.down,
            "left" => &a.left,
            _ => &a.right,
        };
        let p = Proto {
            tags: vec!["arrow"],
            kind: Some(KeyKind::Arrow),
            label: format!("{dir} arrow"),
            code: Some(code.into()),
            icon: Some(Rc::new(move |w: f64, hh: f64| icon_from(g, w / 2.0 - g.w / 2.0, hh / 2.0 - g.h / 2.0, g.w, g.h))),
            ..Default::default()
        };
        add(&mut keys, &p, x, y, kw(1.0), h, 5);
    };
    let lr_y = if st.lr_full { y5 } else { y5 + ah + 1.6 };
    let lr_h = if st.lr_full { kh } else { ah };
    arrow(ax, lr_y, lr_h, "left", "ArrowLeft");
    arrow(ax + u_, y5, ah, "up", "ArrowUp");
    arrow(ax + u_, y5 + ah + 1.6, ah, "down", "ArrowDown");
    arrow(ax + 2.0 * u_, lr_y, lr_h, "right", "ArrowRight");

    KeyboardGeometry {
        finish: f.id.clone(),
        layout: if l.custom { "custom".into() } else { l.id },
        model,
        style,
        light_keys,
        backlit: !light_keys,
        width: 14.5 * u_ - g_,
        height: 5.0 * v_ + kh,
        gap: g_,
        cap_height: kh,
        keys,
    }
}
