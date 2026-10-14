//! Element builders for key caps, the top case and the trackpad surface. They only draw; the views in
//! `device.rs` and `trackpad.rs` add the interaction.
use crate::assets::{glyph_svg, grille_svg};
use crate::paint::*;
use gpui::{canvas, div, point, prelude::*, px, svg, BoxShadow, Div, PathBuilder, SharedString};
use mackeys_core::{Align, Gradient, KeyCap, KeyboardTheme, Shadow, TopCaseGeometry, TouchIdStyle, TrackpadPhase};

/// The system font (SF Pro on macOS).
pub const FONT: &str = ".SystemUIFont";

/// Draws one key cap at its keyboard position. The caller adds an id and listeners.
pub fn key_cap(k: &KeyCap, t: &KeyboardTheme, pressed: bool, caps: bool, light_keys: bool, s: f32) -> Div {
    let b = if pressed { t.pressed_brightness } else { 1.0 };
    let dy = if pressed { 0.45 } else { 0.0 };
    // Scale 0.986 around the center while pressed.
    let shrink = if pressed { 0.007 } else { 0.0 };
    let (x, y, w, h) = (k.x + k.w * shrink, k.y + dy + k.h * shrink, k.w * (1.0 - 2.0 * shrink), k.h * (1.0 - 2.0 * shrink));
    let r = k.radius;
    let mut el = div().absolute().left(spx(x, s)).top(spx(y, s)).w(spx(w, s)).h(spx(h, s)).cursor_pointer();
    let f0 = hsla(&t.face0, b);
    let f1 = hsla(&t.face1, b);

    if let Some(iso) = &k.iso {
        let cmds = parse_path(&iso.path);
        let hl = parse_path(&iso.highlight);
        let outline = hsla(&t.outline, 1.0);
        let highlight = hsla(&t.highlight, 1.0);
        let shadow_c = hsla(if light_keys { "#00000024" } else { "#00000066" }, 1.0);
        el = el.child(
            canvas(
                |_, _, _| (),
                move |bounds, _, window, _| {
                    let o = bounds.origin;
                    if let Some(p) = build_path(&cmds, PathBuilder::fill(), point(o.x, o.y + px(s)), s) {
                        window.paint_path(p, shadow_c);
                    }
                    if let Some(p) = build_path(&cmds, PathBuilder::fill(), o, s) {
                        window.paint_path(p, vgrad(f0, f1));
                    }
                    if let Some(p) = build_path(&cmds, PathBuilder::stroke(px(s)), o, s) {
                        window.paint_path(p, outline);
                    }
                    if !pressed {
                        if let Some(p) = build_path(&hl, PathBuilder::stroke(px(0.8 * s)), o, s) {
                            window.paint_path(p, highlight);
                        }
                    }
                },
            )
            .absolute()
            .left(px(0.))
            .top(px(0.))
            .size_full(),
        );
    } else {
        let overlay = || div().absolute().left(px(0.)).top(px(0.)).size_full().rounded(spx(r, s));
        el = el.rounded(spx(r, s)).bg(vgrad(f0, f1)).shadow(outer_shadows(&t.cap_shadows, s));
        if !pressed {
            el = el.child(overlay().border_t(spx(1.8, s)).border_color(hsla(&t.highlight, 1.0)));
        }
        el = el.child(overlay().border(spx(1.0, s)).border_color(hsla(&t.outline, 1.0)));
    }

    let legend_c = hsla(&t.legend, b);
    for l in &k.legends {
        let line = div()
            .absolute()
            .top(spx(l.top, s))
            .h(spx(l.size, s))
            .flex()
            .whitespace_nowrap()
            .font_family(FONT)
            .text_size(spx(l.size, s))
            .line_height(spx(l.size, s))
            .text_color(legend_c)
            .child(SharedString::from(l.text.clone()));
        let line = match l.align {
            Align::Center => line.left(px(0.)).w(spx(w, s)).justify_center(),
            Align::Left => line.left(spx(l.inset, s)),
            Align::Right => line.left(px(0.)).w(spx(w - l.inset, s)).justify_end(),
        };
        el = el.child(line);
    }
    if let Some(ic) = &k.icon {
        el = el.child(
            svg()
                .path(glyph_svg(ic))
                .absolute()
                .left(spx(ic.x, s))
                .top(spx(ic.y, s))
                .w(spx(ic.w, s))
                .h(spx(ic.h, s))
                .text_color(legend_c),
        );
    }
    if let Some(led) = &k.caps_led {
        let mut dot = div()
            .absolute()
            .left(spx(led.x, s))
            .top(spx(led.y, s))
            .size(spx(led.d, s))
            .rounded(spx(led.d / 2.0, s))
            .bg(hsla(if caps { &t.caps_led_on } else { &t.caps_led_off }, 1.0));
        if caps {
            dot = dot.shadow(
                t.caps_led_glow
                    .iter()
                    .map(|g| BoxShadow {
                        color: hsla(&g.color, 1.0),
                        offset: point(px(0.), px(0.)),
                        blur_radius: spx(g.blur / 2.0, s),
                        spread_radius: px(0.),
                    })
                    .collect(),
            );
        }
        el = el.child(dot);
    }
    if let Some(hb) = &k.home_bar {
        el = el.child(
            div()
                .absolute()
                .left(spx(hb.x, s))
                .top(spx(hb.y, s))
                .w(spx(hb.w, s))
                .h(spx(hb.h, s))
                .rounded(spx(1.0, s))
                .bg(hsla(&t.home_bar, b)),
        );
    }
    if let Some(tid) = &k.touch_id {
        el = el.child(touch_id(tid.d, w, h, t, s));
    }
    el
}

fn touch_id(d: f64, w: f64, h: f64, t: &KeyboardTheme, s: f32) -> Div {
    let k = t.touch_id_brightness;
    let ring = div().absolute().left(spx(w / 2.0 - d / 2.0, s)).top(spx(h / 2.0 - d / 2.0, s)).size(spx(d, s)).rounded(spx(d / 2.0, s));
    let disc = |inset: f64| {
        div()
            .absolute()
            .left(spx(inset, s))
            .top(spx(inset, s))
            .size(spx(d - 2.0 * inset, s))
            .rounded(spx(d / 2.0 - inset, s))
    };
    let ring_shadow = |spread: f64, c: &str| {
        vec![BoxShadow { color: hsla(c, 1.0), offset: point(px(0.), px(0.)), blur_radius: px(0.), spread_radius: spx(spread, s) }]
    };
    match t.touch_id {
        // A conic ring, approximated by a vertical gradient through its lightest and darkest stops.
        TouchIdStyle::Dark => ring
            .bg(vgrad(hsla("#5a5a5eff", k), hsla("#3a3a3dff", k)))
            .shadow(ring_shadow(0.5, "#000000a6"))
            .child(disc(0.7).bg(hsla("#1b1b1dff", k)).child(disc(0.0).size_full().border_t(spx(0.8, s)).border_color(hsla("#00000073", 1.0)))),
        TouchIdStyle::Light => ring
            .bg(hsla("#c4c4c8ff", k))
            .shadow(ring_shadow(0.6, "#3c3c428c"))
            .child(disc(1.1).bg(hsla("#eeeef0ff", k)).border(spx(0.5, s)).border_color(hsla("#46464c73", 1.0))),
        TouchIdStyle::Flush => ring.bg(hsla(&t.face1, k)).border(spx(0.5, s)).border_color(hsla("#0000001a", 1.0)),
    }
}

/// The trackpad surface at (0, phase offset) inside its slot, `w` x `h`.
pub fn pad_surface(surface: &Gradient, shadows: &[Shadow], radius: f64, w: f64, h: f64, phase: TrackpadPhase, s: f32) -> Div {
    let (dy, br, inner): (f64, f64, Option<(f64, f64, &str)>) = match phase {
        TrackpadPhase::Up => (0.0, 1.0, None),
        TrackpadPhase::Down => (1.0, 0.97, Some((1.0, 5.0, "#00000038"))),
        TrackpadPhase::Force => (1.8, 0.94, Some((2.0, 9.0, "#00000052"))),
    };
    let r4 = [radius; 4];
    let mut el = div()
        .absolute()
        .left(px(0.))
        .top(spx(dy, s))
        .w(spx(w, s))
        .h(spx(h, s))
        .rounded(spx(radius, s))
        .bg(grad_bg(surface, br))
        .shadow(outer_shadows(shadows, s))
        .children(inset_overlays(shadows, w, h, r4, s));
    if let Some((y, blur, c)) = inner {
        let sh = Shadow { x: 0.0, y, blur, spread: 0.0, color: c.to_string(), inset: true };
        el = el.children(inset_overlays(&[sh], w, h, r4, s));
    }
    el
}

/// The top case in two layers: `base` (side, deck, hinge, notch) and `over` (grilles, dim, well). The
/// view draws the built-in trackpad (at `tc.trackpad`) between them and the keys after them.
pub fn top_case_layers(tc: &TopCaseGeometry, s: f32) -> (Vec<Div>, Vec<Div>) {
    let mut base = vec![];
    let mut over = vec![];
    let (w, h) = (tc.width, tc.height);
    // 1. Side, offset 10 px down.
    base.push(corners(div().absolute().left(px(0.)).top(spx(10.0, s)).w(spx(w, s)).h(spx(h, s)), tc.radius, s).bg(grad_bg(&tc.side, 1.0)).shadow(outer_shadows(&tc.side_shadows, s)));
    // 2. Deck. (3. Grain is skipped.)
    base.push(
        corners(div().absolute().left(px(0.)).top(px(0.)).w(spx(w, s)).h(spx(h, s)), tc.radius, s)
            .bg(grad_bg(&tc.deck, 1.0))
            .shadow(outer_shadows(&tc.deck_shadows, s))
            .children(inset_overlays(&tc.deck_shadows, w, h, tc.radius, s)),
    );
    // 4. Hinge and notch (full only).
    if let Some(hg) = &tc.hinge {
        base.push(
            div()
                .absolute()
                .left(spx(hg.x, s))
                .top(px(0.))
                .w(spx(hg.w, s))
                .h(spx(hg.h, s))
                .rounded_b(spx(3.0, s))
                .bg(vgrad(hsla("#000000ff", 1.0), hsla("#0b0b0cff", 1.0))),
        );
        base.extend(gradient_bands(&hg.barrel, hg.x, 0.0, hg.barrel_w, hg.h, [0.0, 0.0, 2.0, 3.0], s));
        base.extend(gradient_bands(&hg.barrel, hg.x + hg.w - hg.barrel_w, 0.0, hg.barrel_w, hg.h, [0.0, 0.0, 3.0, 2.0], s));
    }
    if let Some(n) = &tc.notch {
        base.extend(gradient_bands(&n.fill, n.x, n.y, n.w, n.h, [0.0, 0.0, 5.0, 5.0], s));
        let dark = hsla("#000000ff", 1.0);
        base.push(
            div()
                .absolute()
                .left(spx(n.x, s))
                .top(spx(n.y - 6.0, s))
                .w(spx(n.w, s))
                .h(spx(6.0, s))
                .rounded_t(spx(3.0, s))
                .bg(vgrad(fade(dark, 0.0), fade(dark, n.scoop_opacity as f32))),
        );
    }
    // 5. Grilles.
    for g in &tc.grilles {
        let c = hsla(&g.dot, 1.0);
        if c.a > 0.0 {
            over.push(
                div().absolute().left(spx(g.x, s)).top(spx(g.y, s)).w(spx(g.w, s)).h(spx(g.h, s)).child(
                    svg().path(grille_svg(g.w, g.h, g.pitch, g.dot_radius)).size_full().text_color(c),
                ),
            );
        }
    }
    // 6. Dim.
    if tc.dim > 0.0 {
        over.push(corners(div().absolute().left(px(0.)).top(px(0.)).w(spx(w, s)).h(spx(h, s)), tc.radius, s).bg(fade(hsla("#000000ff", 1.0), tc.dim as f32)));
    }
    // 7. Well.
    let wl = &tc.well;
    over.push(
        div()
            .absolute()
            .left(spx(wl.x, s))
            .top(spx(wl.y, s))
            .w(spx(wl.w, s))
            .h(spx(wl.h, s))
            .rounded(spx(wl.radius, s))
            .bg(hsla(&wl.fill, 1.0))
            .shadow(outer_shadows(&wl.shadows, s))
            .children(inset_overlays(&wl.shadows, wl.w, wl.h, [wl.radius; 4], s)),
    );
    (base, over)
}
