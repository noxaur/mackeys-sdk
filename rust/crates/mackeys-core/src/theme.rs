//! Colors and lighting for key caps, the keyboard well and the top case, including the backlight
//! model. Port of `theme.ts`.
use crate::data::{get_finish, model as model_spec, ModelId};
use crate::keyboard::KeyboardGeometry;
use crate::util::{color, grad2, js_round, parse_color, rgba, shadow, Color, Gradient, GradientStop, Shadow};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Room {
    #[default]
    Daylight,
    Dark,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct BacklightOptions {
    /// The backlight switch. Only MacBook Pro and Air have a backlight. Default false.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub on: Option<bool>,
    /// Brightness in sixteenths, 0 to 16. Default 12.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<f64>,
    /// Daylight lowers the eye's exposure, so the same light reads weaker. Default daylight.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub room: Option<Room>,
    /// How much light spills out around each cap, 0 to 1. Default 0.5.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bleed: Option<f64>,
    /// Light color. Default `#f2f5ff`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// True while the idle timer has switched the light off.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idle: Option<bool>,
}

impl BacklightOptions {
    /// A lit backlight at `level` (0 to 16) in `room`.
    pub fn lit(level: f64, room: Room) -> Self {
        BacklightOptions { on: Some(true), level: Some(level), room: Some(room), ..Default::default() }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextGlow {
    pub blur: f64,
    pub color: Color,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TouchIdStyle {
    Dark,
    Light,
    Flush,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardTheme {
    /// Key cap face: a radial gradient (125% x 110% at bottom center) from `face1` at the center to
    /// `face0` at the edge.
    pub face0: Color,
    pub face1: Color,
    /// 1 px inner outline of every cap.
    pub outline: Color,
    /// 1.8 px inner highlight along the top edge of every cap.
    pub highlight: Color,
    /// Outer shadows of every cap.
    pub cap_shadows: Vec<Shadow>,
    pub legend: Color,
    pub legend_glow: Vec<TextGlow>,
    pub icon_glow: Vec<TextGlow>,
    /// Brightness factor for a pressed key.
    pub pressed_brightness: f64,
    pub caps_led_off: Color,
    pub caps_led_on: Color,
    pub caps_led_glow: Vec<TextGlow>,
    pub home_bar: Color,
    pub touch_id: TouchIdStyle,
    pub touch_id_brightness: f64,
    /// Lit backlight level after the room's exposure, 0 to 1.
    pub glow: f64,
}

const DEFAULT_GLOW: &str = "#f2f5ff";

fn light_rgb(c: Option<&str>) -> [f64; 3] {
    let hx = c.unwrap_or(DEFAULT_GLOW);
    match parse_color(hx) {
        Ok(p) => [p.r, p.g, p.b],
        Err(_) => {
            let mut h: String = hx.replace('#', "");
            while h.chars().count() < 6 {
                h.push('f');
            }
            let h: String = h.chars().take(6).collect();
            let mut out = [0.0; 3];
            for (k, i) in [0usize, 2, 4].iter().enumerate() {
                let part: String = h.chars().skip(*i).take(2).collect();
                out[k] = parse_hex_prefix(&part);
            }
            out
        }
    }
}

/// JavaScript `parseInt(s, 16) || 0`.
fn parse_hex_prefix(s: &str) -> f64 {
    let digits: String = s.chars().take_while(|c| c.is_ascii_hexdigit()).collect();
    u32::from_str_radix(&digits, 16).map(|v| v as f64).unwrap_or(0.0)
}

fn finite(v: Option<f64>) -> Option<f64> {
    v.filter(|x| x.is_finite())
}

/// Backlight level after the room's exposure, 0 to 1. Zero on models with no backlight.
pub fn backlight_glow(finish: &str, bl: &BacklightOptions) -> f64 {
    let f = get_finish(finish);
    let backlit = f.model == ModelId::Pro || f.model == ModelId::Air;
    let on = backlit && bl.on.unwrap_or(false) && !bl.idle.unwrap_or(false);
    let raw = finite(bl.level).unwrap_or(12.0);
    let step = js_round(raw).clamp(0.0, 16.0);
    let g = if on { step / 16.0 } else { 0.0 };
    let e = if bl.room == Some(Room::Dark) { 1.0 } else { 0.42 };
    g * e
}

fn clamp01(v: Option<f64>, d: f64) -> f64 {
    finite(v).unwrap_or(d).clamp(0.0, 1.0)
}

fn add_light(lc: &[f64; 3], base: [f64; 3], k: f64) -> Color {
    let c = |i: usize| (js_round(base[i] + lc[i] * k)).min(255.0);
    rgba(c(0), c(1), c(2), 1.0)
}

fn darken(hex: &str, k: f64) -> Color {
    let p = parse_color(hex).unwrap_or(crate::util::Rgba { r: 0.0, g: 0.0, b: 0.0, a: 1.0 });
    rgba(js_round(p.r * k), js_round(p.g * k), js_round(p.b * k), 1.0)
}

fn glow(blur: f64, c: &str) -> TextGlow {
    TextGlow { blur, color: color(c) }
}

/// The key cap theme of a finish under a backlight setting.
pub fn keyboard_theme(finish: &str, bl: &BacklightOptions) -> KeyboardTheme {
    let f = get_finish(finish);
    let light_keys = f.model == ModelId::Neo || f.model == ModelId::Mk;
    let backlit = !light_keys;
    let dark = bl.room == Some(Room::Dark);
    let e = backlight_glow(finish, bl);
    let bleed = clamp01(bl.bleed, 0.5);
    let lc = light_rgb(bl.color.as_deref());
    let glow_a = |a: f64| rgba(lc[0], lc[1], lc[2], a.max(0.0));

    let mut t = if light_keys {
        let kf = f.kf.as_deref().unwrap_or("#f6f7f9");
        let kl = f.kl.as_deref().unwrap_or("#4a4a4c");
        KeyboardTheme {
            face0: color(kf),
            face1: darken(kf, 0.965),
            outline: color("rgba(0,0,0,.8)"),
            highlight: color("rgba(255,255,255,.5)"),
            cap_shadows: vec![shadow(0.0, 1.0, 1.5, 0.0, "rgba(0,0,0,.14)", false)],
            legend: color(kl),
            legend_glow: vec![],
            icon_glow: vec![],
            pressed_brightness: 0.93,
            caps_led_off: color("rgba(0,0,0,.36)"),
            caps_led_on: color("#3ddc5c"),
            caps_led_glow: vec![],
            home_bar: color(kl),
            touch_id: if f.model == ModelId::Neo { TouchIdStyle::Flush } else { TouchIdStyle::Light },
            touch_id_brightness: 1.0,
            glow: 0.0,
        }
    } else {
        KeyboardTheme {
            face0: color("#1c1c1e"),
            face1: color("#2e2e30"),
            outline: color("#050506"),
            highlight: color("rgba(255,255,255,.15)"),
            cap_shadows: vec![shadow(0.0, 1.0, 1.5, 0.0, "rgba(0,0,0,.5)", false)],
            legend: color("#dcdcdf"),
            legend_glow: vec![],
            icon_glow: vec![],
            pressed_brightness: 0.84,
            caps_led_off: color("#8e8e93"),
            caps_led_on: color("#3ddc5c"),
            caps_led_glow: vec![],
            home_bar: color("rgba(222,222,226,.55)"),
            touch_id: TouchIdStyle::Dark,
            touch_id_brightness: 1.0,
            glow: e,
        }
    };
    t.caps_led_glow = vec![glow(2.0, "rgba(61,220,92,.9)"), glow(6.0, "rgba(61,220,92,.45)")];
    if backlit && dark {
        t.face0 = color("#0b0b0c");
        t.face1 = color("#141416");
        t.highlight = color("rgba(255,255,255,.03)");
        t.caps_led_off = color("#2c2c2e");
        t.home_bar = color("rgba(60,60,64,.6)");
        t.touch_id_brightness = 0.32;
    }
    if backlit && e > 0.0 {
        // Legends: the light shining through the cut-out print, added to what the room already shows.
        t.legend = add_light(&lc, if dark { [40.0, 40.0, 43.0] } else { [220.0, 220.0, 223.0] }, e.powf(0.6));
        t.legend_glow = vec![
            TextGlow { blur: 0.6, color: glow_a(0.9 * e) },
            TextGlow { blur: 2.0, color: glow_a(0.55 * e) },
            TextGlow { blur: 5.0, color: glow_a(0.25 * e) },
        ];
        t.icon_glow = vec![TextGlow { blur: 0.6, color: glow_a(0.85 * e) }, TextGlow { blur: 2.5, color: glow_a(0.4 * e) }];
        // Light spilling out around each cap: a bright rim at the edge and a softer pool in the gap.
        t.cap_shadows = vec![
            shadow(0.0, 0.0, 1.0 + 1.5 * bleed, 0.0, &glow_a(0.95 * e * bleed), false),
            shadow(0.0, 0.0, 3.0 + 5.0 * bleed, 0.0, &glow_a(0.45 * e * bleed), false),
            shadow(0.0, 1.0, 1.5, 0.0, "rgba(0,0,0,.6)", false),
        ];
        t.face1 = add_light(&lc, if dark { [20.0, 20.0, 22.0] } else { [46.0, 46.0, 48.0] }, 0.05 * e * bleed);
    }
    t
}

// ---- Top case ----------------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Parts {
    /// The whole MacBook top case with trackpad, hinge and front notch.
    Full,
    /// The keyboard deck only.
    #[default]
    Keyboard,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TopCaseOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parts: Option<Parts>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backlight: Option<BacklightOptions>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Well {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub radius: f64,
    pub pad: f64,
    pub fill: Color,
    pub shadows: Vec<Shadow>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Grille {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub dot: Color,
    pub pitch: f64,
    pub dot_radius: f64,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoundedRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub radius: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Hinge {
    pub x: f64,
    pub w: f64,
    pub h: f64,
    pub barrel_w: f64,
    pub barrel: Gradient,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Notch {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub fill: Gradient,
    pub scoop_opacity: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopCaseGeometry {
    pub model: ModelId,
    pub full: bool,
    pub width: f64,
    pub height: f64,
    /// Corner radii: top-left, top-right, bottom-right, bottom-left.
    pub radius: [f64; 4],
    pub deck: Gradient,
    pub deck_shadows: Vec<Shadow>,
    /// The base under the deck, offset 10 px down: the visible side wall.
    pub side: Gradient,
    pub side_shadows: Vec<Shadow>,
    /// Opacity of the aluminium grain overlay.
    pub grain: f64,
    /// Black overlay on the deck in a dark room.
    pub dim: f64,
    pub well: Well,
    /// Origin of the keyboard inside the top case.
    pub keyboard: Point,
    pub grilles: Vec<Grille>,
    pub trackpad: Option<RoundedRect>,
    pub hinge: Option<Hinge>,
    /// The finger notch at the front edge.
    pub notch: Option<Notch>,
    /// Page background behind the device, as on the canvas.
    pub page_background: Color,
}

fn stop(c: &str, at: f64) -> GradientStop {
    GradientStop { color: color(c), at }
}

/// The top case around a keyboard.
pub fn top_case(finish: &str, kb: &KeyboardGeometry, opts: &TopCaseOptions) -> TopCaseGeometry {
    let f = get_finish(finish);
    let m = model_spec(f.model);
    let full = opts.parts == Some(Parts::Full) && f.model != ModelId::Mk;
    let default_bl = BacklightOptions::default();
    let bl = opts.backlight.as_ref().unwrap_or(&default_bl);
    let backlit = f.model == ModelId::Pro || f.model == ModelId::Air;
    let dark = bl.room == Some(Room::Dark);
    let e = backlight_glow(finish, bl);
    let bleed = clamp01(bl.bleed, 0.5);
    let lc = light_rgb(bl.color.as_deref());
    let well_glow = if backlit && e > 0.0 { 0.07 * e * bleed } else { 0.0 };
    let is_pro = f.model == ModelId::Pro;
    let pad = m.wellPad;
    let w = m.W;
    let kb_x = (w - kb.width) / 2.0;
    let well_h = kb.height + 2.0 * pad;
    let h = if full || f.model == ModelId::Mk { m.H } else { m.kbY * 2.0 + kb.height };
    let r = if full || f.model == ModelId::Mk { m.radius } else { [22.0; 4] };
    let edge = f.edge.as_str();
    let well_fill = if is_pro {
        add_light(&lc, if dark { [6.0, 6.0, 7.0] } else { [18.0, 20.0, 22.0] }, well_glow)
    } else if f.model == ModelId::Air && well_glow > 0.0 {
        rgba(lc[0], lc[1], lc[2], well_glow)
    } else {
        color("transparent")
    };
    let well_shadows = if f.model == ModelId::Mk {
        vec![]
    } else if is_pro {
        vec![
            shadow(0.0, 0.0, 0.0, 1.0, "#000", true),
            shadow(0.0, 1.0, 3.0, 0.0, "rgba(0,0,0,.8)", true),
            shadow(0.0, 0.0, 0.0, 1.0, edge, false),
        ]
    } else {
        vec![
            shadow(0.0, 1.5, 2.5, 0.0, if f.dark { "rgba(0,0,0,.45)" } else { "rgba(0,0,0,.16)" }, true),
            shadow(0.0, 0.0, 0.0, 1.0, if f.dark { "rgba(0,0,0,.28)" } else { "rgba(0,0,0,.07)" }, true),
            shadow(0.0, -1.0, 0.0, 0.0, edge, true),
            shadow(0.0, 1.0, 0.0, 0.0, edge, false),
            shadow(0.0, -1.0, 0.0, 0.0, if f.dark { "rgba(0,0,0,.18)" } else { "rgba(0,0,0,.05)" }, false),
        ]
    };
    let lid = &f.lid;
    let grille = |x: f64| Grille { x, y: m.kbY + 7.0, w: 45.0, h: well_h - 28.0, dot: color(&f.dot), pitch: 3.3, dot_radius: 0.75 };
    TopCaseGeometry {
        model: f.model,
        full,
        width: w,
        height: h,
        radius: r,
        deck: grad2(&f.deck),
        deck_shadows: vec![
            shadow(0.0, 0.0, 0.0, 1.0, edge, true),
            shadow(0.0, -1.0, 1.0, 0.0, if f.dark { "rgba(0,0,0,.35)" } else { "rgba(0,0,0,.06)" }, true),
        ],
        side: grad2(&f.side),
        side_shadows: vec![
            shadow(0.0, 1.0, 1.0, 0.0, "rgba(0,0,0,.22)", false),
            shadow(0.0, 12.0, 24.0, 0.0, "rgba(0,0,0,.10)", false),
            shadow(0.0, 40.0, 70.0, -26.0, "rgba(0,0,0,.40)", false),
        ],
        grain: if is_pro && f.dark { 0.25 } else { 0.14 },
        dim: if backlit && dark { 0.8 } else { 0.0 },
        well: Well {
            x: kb_x - pad,
            y: m.kbY - pad,
            w: kb.width + 2.0 * pad,
            h: well_h,
            radius: 12.0,
            pad,
            fill: well_fill,
            shadows: well_shadows,
        },
        keyboard: Point { x: kb_x, y: m.kbY },
        grilles: if m.grille { vec![grille(5.0), grille(w - 5.0 - 45.0)] } else { vec![] },
        trackpad: if full { Some(RoundedRect { x: (w - m.padW) / 2.0, y: m.padY, w: m.padW, h: m.padH, radius: 9.0 }) } else { None },
        hinge: if full {
            Some(Hinge {
                x: m.hingeX,
                w: w - 2.0 * m.hingeX,
                h: 14.0,
                barrel_w: 52.0,
                barrel: Gradient {
                    stops: vec![stop(&lid[1], 0.0), stop(&lid[2], 0.7), stop(if f.dark { "#141315" } else { &f.side[1] }, 1.0)],
                },
            })
        } else {
            None
        },
        notch: if full {
            Some(Notch {
                x: w / 2.0 - 88.0,
                y: h,
                w: 176.0,
                h: 10.0,
                fill: Gradient { stops: vec![stop(&lid[2], 0.0), stop(&lid[1], 0.6), stop(&lid[0], 1.0)] },
                scoop_opacity: if f.dark { 0.35 } else { 0.1 },
            })
        } else {
            None
        },
        page_background: color(if backlit && dark { "#060607" } else { "#f2f2f2" }),
    }
}

// ---- Trackpad ----------------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrackpadGeometry {
    pub width: f64,
    pub height: f64,
    pub radius: f64,
    pub surface: Gradient,
    pub side: Gradient,
    /// Depth of the visible side under the glass.
    pub side_depth: f64,
    pub shadows: Vec<Shadow>,
    pub side_shadows: Vec<Shadow>,
    pub grain: f64,
    pub label: String,
}

/// The standalone Force Touch trackpad of a MacBook finish (Magic Keyboard finishes fall back to Space
/// Black).
pub fn trackpad(finish: &str) -> TrackpadGeometry {
    let mut f = get_finish(finish);
    if f.model == ModelId::Mk {
        f = get_finish("pro-space-black");
    }
    let (w, h) = match f.model {
        ModelId::Neo => (390.5, 243.5),
        ModelId::Pro => (437.0, 272.7),
        _ => (432.5, 270.1),
    };
    TrackpadGeometry {
        width: w,
        height: h,
        radius: 10.0,
        surface: grad2(&f.pad),
        side: grad2(&f.side),
        side_depth: 6.0,
        shadows: trackpad_shadows(&f.id),
        side_shadows: vec![
            shadow(0.0, 1.0, 1.0, 0.0, "rgba(0,0,0,.2)", false),
            shadow(0.0, 10.0, 20.0, 0.0, "rgba(0,0,0,.10)", false),
            shadow(0.0, 30.0, 50.0, -18.0, "rgba(0,0,0,.38)", false),
        ],
        grain: if f.model == ModelId::Pro && f.dark { 0.25 } else { 0.14 },
        label: format!("{} Force Touch trackpad. Click, or press and hold for a force click.", f.name),
    }
}

/// Shadows of the built-in trackpad inside a MacBook top case (same as the standalone one).
pub fn trackpad_shadows(finish: &str) -> Vec<Shadow> {
    let f = get_finish(finish);
    vec![
        shadow(0.0, 0.0, 0.0, 1.0, &f.edge, false),
        shadow(0.0, 0.0, 0.0, 1.0, if f.dark { "rgba(0,0,0,.55)" } else { "rgba(0,0,0,.13)" }, true),
        shadow(0.0, 2.0, 0.0, 0.0, &f.edge, true),
    ]
}
