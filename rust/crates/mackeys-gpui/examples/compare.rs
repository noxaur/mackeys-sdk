//! Renders the eight reference configurations offscreen (the same layers the GPUI views draw) to
//! `target/compare/<name>.png`, and puts each next to its web reference in `<name>-side.png`.
//!
//! ```sh
//! cargo run --release -p mackeys-gpui --example compare
//! ```
use mackeys_core::*;
use mackeys_gpui::scene::{compose, trackpad_layers, DeviceScene};
use std::path::PathBuf;
use std::time::Instant;

struct Case {
    name: &'static str,
    finish: &'static str,
    layout: &'static str,
    part: &'static str,
    backlight: BacklightOptions,
    press: &'static [&'static str],
}

fn main() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let refs = root.join("spec/reference/screens");
    let out = root.join("rust/target/compare");
    std::fs::create_dir_all(&out).unwrap();
    let off = BacklightOptions::default();
    let cases = [
        Case { name: "macbook-pro-space-black-us", finish: "pro-space-black", layout: "en-us", part: "macbook", backlight: off.clone(), press: &[] },
        Case { name: "macbook-air-starlight-de", finish: "air-starlight", layout: "de", part: "macbook", backlight: off.clone(), press: &[] },
        Case { name: "macbook-neo-blush-ja", finish: "neo-blush", layout: "ja", part: "macbook", backlight: off.clone(), press: &[] },
        Case {
            name: "keyboard-pro-space-black-dark-lit-pressed",
            finish: "pro-space-black",
            layout: "en-us",
            part: "keyboard",
            backlight: BacklightOptions { on: Some(true), level: Some(16.0), room: Some(Room::Dark), ..Default::default() },
            press: &["KeyA", "ShiftLeft"],
        },
        Case {
            name: "keyboard-air-midnight-lit-ko",
            finish: "air-midnight",
            layout: "ko",
            part: "keyboard",
            backlight: BacklightOptions { on: Some(true), level: Some(12.0), ..Default::default() },
            press: &[],
        },
        Case { name: "keyboard-imac-blue-ru", finish: "imac-blue", layout: "ru", part: "keyboard", backlight: off.clone(), press: &[] },
        Case { name: "keyboard-imac-green-fr", finish: "imac-green", layout: "fr", part: "keyboard", backlight: off.clone(), press: &[] },
        Case { name: "trackpad-pro-silver", finish: "pro-silver", layout: "en-us", part: "trackpad", backlight: off.clone(), press: &[] },
    ];
    let only: Vec<String> = std::env::args().skip(1).collect();
    let scale = 2.0;
    for c in cases {
        if !only.is_empty() && !only.iter().any(|o| c.name.contains(o.as_str())) {
            continue;
        }
        let t0 = Instant::now();
        let reference = tiny_skia::Pixmap::load_png(refs.join(format!("{}.png", c.name))).expect("reference png");
        let (w, h) = (reference.width() as f64 / scale, reference.height() as f64 / scale);
        let kb = build_keyboard(&KeyboardOptions::new(c.finish, c.layout));
        let (layers, bg) = if c.part == "trackpad" {
            let tp = trackpad(c.finish);
            let tc = top_case(c.finish, &kb, &TopCaseOptions::default());
            (trackpad_layers(&tp, 0.0, scale), tc.page_background)
        } else {
            let parts = if c.part == "macbook" { Parts::Full } else { Parts::Keyboard };
            let tc = top_case(c.finish, &kb, &TopCaseOptions { parts: Some(parts), backlight: Some(c.backlight.clone()) });
            let theme = keyboard_theme(c.finish, &c.backlight);
            let pad = grad2(&get_finish(c.finish).pad);
            let shadows = trackpad_shadows(c.finish);
            let scene = DeviceScene {
                kb: &kb,
                tc: &tc,
                theme: &theme,
                caps: false,
                pad_surface: &pad,
                pad_shadows: &shadows,
                pad_depth: 0.0,
                lid: c.part == "macbook" && tc.full,
                scale,
            };
            let press = c.press;
            (scene.layers(|k| if press.contains(&k.id.as_str()) { 1.0 } else { 0.0 }), tc.page_background.clone())
        };
        let ours = compose(&layers, w, h, scale, &bg, 16.0, 16.0);
        ours.save_png(out.join(format!("{}.png", c.name))).unwrap();
        // Side by side: reference left, ours right.
        let mut side = tiny_skia::Pixmap::new(reference.width() * 2 + 20, reference.height()).unwrap();
        side.fill(tiny_skia::Color::from_rgba8(255, 0, 255, 255));
        let p = tiny_skia::PixmapPaint::default();
        side.draw_pixmap(0, 0, reference.as_ref(), &p, tiny_skia::Transform::identity(), None);
        side.draw_pixmap(reference.width() as i32 + 20, 0, ours.as_ref(), &p, tiny_skia::Transform::identity(), None);
        side.save_png(out.join(format!("{}-side.png", c.name))).unwrap();
        // Mean absolute difference per channel (0 to 255).
        let (a, b) = (reference.data(), ours.data());
        let n = a.len().min(b.len());
        let diff: f64 = a[..n].iter().zip(&b[..n]).map(|(x, y)| (*x as f64 - *y as f64).abs()).sum::<f64>() / n as f64;
        // DIFF=1: the absolute difference, times 4, as an image.
        if std::env::var("DIFF").is_ok() {
            let mut dimg = tiny_skia::Pixmap::new(reference.width(), reference.height()).unwrap();
            for (i, px) in dimg.data_mut().as_chunks_mut::<4>().0.iter_mut().enumerate() {
                for (c, out) in px.iter_mut().take(3).enumerate() {
                    let v = (a.get(i * 4 + c).copied().unwrap_or(0) as i32 - b.get(i * 4 + c).copied().unwrap_or(0) as i32).abs() * 4;
                    *out = v.min(255) as u8;
                }
                px[3] = 255;
            }
            dimg.save_png(out.join(format!("{}-diff.png", c.name))).unwrap();
        }
        // CROP=x,y,w,h (reference pixels): the reference crop above ours, 1:1.
        if let Ok(crop) = std::env::var("CROP") {
            let v: Vec<i32> = crop.split(',').filter_map(|p| p.trim().parse().ok()).collect();
            if v.len() == 4 {
                let (x, y, cw, ch) = (v[0], v[1], v[2] as u32, v[3] as u32);
                let mut img = tiny_skia::Pixmap::new(cw, ch * 2 + 6).unwrap();
                img.fill(tiny_skia::Color::from_rgba8(255, 0, 255, 255));
                let p = tiny_skia::PixmapPaint::default();
                img.draw_pixmap(-x, -y, reference.as_ref(), &p, tiny_skia::Transform::identity(), None);
                let mut lower = tiny_skia::Pixmap::new(cw, ch).unwrap();
                lower.draw_pixmap(-x, -y, ours.as_ref(), &p, tiny_skia::Transform::identity(), None);
                img.draw_pixmap(0, ch as i32 + 6, lower.as_ref(), &p, tiny_skia::Transform::identity(), None);
                img.save_png(out.join(format!("{}-crop.png", c.name))).unwrap();
            }
        }
        println!("diff {diff:.2}");
        println!("{} ({} layers, {:.0} ms)", out.join(format!("{}-side.png", c.name)).display(), layers.len(), t0.elapsed().as_secs_f64() * 1000.0);
    }
}
