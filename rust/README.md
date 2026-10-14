# MacKeys for Rust and GPUI

Interactive Mac keyboards and Force Touch trackpads for [GPUI](https://gpui.rs): MacBook Pro, Air, Neo and the
iMac Magic Keyboard, in 17 finishes and 17 layouts, with backlight and recorded click sounds.

The workspace has two crates:

| Crate | Purpose | Dependencies |
| --- | --- | --- |
| `mackeys-core` | The engine. A one-to-one port of the TypeScript engine in `packages/core/src`. It passes every fixture in `spec/fixtures`. | `serde`, `serde_json` |
| `mackeys-gpui` | GPUI views: `MacKeyboard`, `MacBook` (with the open lid), `MacTrackpad`. | `gpui` 0.2.2, `resvg` 0.45, `tiny-skia`, `rustybuzz`, `fontdb`, `rodio` 0.21 (feature `sound`); on macOS `objc2`, `objc2-app-kit`, `block2` |

## Install

The crates are not on crates.io yet. Use a path or git dependency:

```toml
[dependencies]
mackeys-gpui = { path = "../mackeys-sdk/rust/crates/mackeys-gpui" }
# Engine only, no UI:
mackeys-core = { path = "../mackeys-sdk/rust/crates/mackeys-core" }
```

Requirements:

- Rust 1.88 or later.
- macOS for GPUI. The Command Line Tools are enough. The crate turns on GPUI's `runtime_shaders` feature, so
  the Metal shader compiler of a full Xcode install is not necessary.

Run the showcase:

```sh
cd rust
cargo run -p mackeys-gpui --example showcase
cargo run -p mackeys-gpui --example showcase -- air-midnight de dark
```

Showcase controls:

| Input | Action |
| --- | --- |
| Click a key, or type | Press and release keys |
| Click or hold a trackpad | Click; hold 500 ms for a force click |
| control-F, control-shift-F | Next or previous finish |
| control-L, control-shift-L | Next or previous layout |
| control-B | Backlight on or off |
| control-up, control-down | Backlight level |
| control-R | Daylight or dark room |
| control-S | Sound on or off |
| control-D | Lid on or off |
| command-Q | Quit |

The toolbar buttons do the same.

## Use the GPUI components

1. Create a view with `cx.new`.
2. Focus the view to receive physical key input. A click on the view also focuses it.
3. Optional: register `MacKeysAssets` as the asset source. Only the `render` module's plain `div`
   builders need it (they load generated SVG glyphs). The views draw raster art and do not need it.

The views make their images on GPUI's background executor. The first frame after a change of finish,
layout, backlight or scale shows the previous images (or nothing) until the new images are ready.
In a release build this takes about 0.4 s for a keyboard and 1.3 s for a MacBook with its lid.

```rust
use gpui::{prelude::*, px, size, Application, Bounds, WindowBounds, WindowOptions};
use mackeys_gpui::{Backlight, MacBook, MacKeysAssets, Room};

fn main() {
    Application::new().with_assets(MacKeysAssets::new()).run(|cx| {
        let bounds = Bounds::centered(None, size(px(900.), px(700.)), cx);
        let options = WindowOptions { window_bounds: Some(WindowBounds::Windowed(bounds)), ..Default::default() };
        cx.open_window(options, |window, cx| {
            cx.new(|cx| {
                MacBook::new(window, cx)
                    .finish("pro-silver")
                    .layout("en-gb")
                    .backlight(Backlight::lit(12.0, Room::Dark))
                    .sound(true)
                    .scale(0.8)
            })
        })
        .unwrap();
    });
}
```

If your app has its own assets, wrap them: `MacKeysAssets::with_fallback(MyAssets)`. Paths that start
with `mackeys/` go to MacKeys; all other paths go to your source.

Listen to key and trackpad events:

```rust
use mackeys_gpui::{KeyEvent, TrackpadEvent};

let book = cx.new(|cx| MacBook::new(window, cx));
cx.subscribe(&book, |_, _, e: &KeyEvent, _| println!("{:?} {}", e.kind, e.id)).detach();
cx.subscribe(&book, |_, _, e: &TrackpadEvent, _| println!("{:?}", e.kind)).detach();
```

Change options at run time:

```rust
book.update(cx, |b, cx| {
    b.set_finish("air-starlight", cx);
    b.set_layout("fr", cx);
    b.set_backlight(Backlight { on: true, level: 8.0, idle_off: mackeys_gpui::idle_delay("10s"), ..Default::default() }, cx);
});
```

### GPUI API

`MacKeyboard` (keyboard deck) and `MacBook` (full top case) have the same API:

| Builder (in `cx.new`) | Setter (at run time) | Notes |
| --- | --- | --- |
| `finish(id)` | `set_finish(id, cx)` | A finish id or name. Unknown ids give `pro-space-black`. |
| `layout(id)` | `set_layout(id, cx)` | A layout id, or `custom`. Unknown ids give `en-us`. |
| `custom_layout(patch)` | `set_custom_layout(patch, cx)` | `CustomLayoutPatch` (`kind`, `num`, `q`, `a`, `x`, `z`). It selects `custom`. |
| `backlight(Backlight)` | `set_backlight(Backlight, cx)` | `on`, `level` 0 to 16, `room`, `bleed` 0 to 1, `color`, `idle_off`. |
| `sound(bool)` | `set_sound(bool, cx)` | Click sounds. Default on. |
| `scale(f32)` | `set_scale(f32, cx)` | Uniform scale. 1 = 64 px per key pitch. |
| `show_lid(bool)` | `set_show_lid(bool, cx)` | `MacBook` only: the open lid. Default on. It needs 200 px above and 120 px left and right of the deck (at scale 1). Magic Keyboard finishes have no lid. |

Other methods: `press(id, cx)`, `release(id, cx)`, `tap(id, cx)`, `state()`, `key_press_amount(id)`,
`geometry()`, `top_case()`, `trackpad_phase()`, `backlight_settings()`, `sound_enabled()`, `lid_shown()`,
`native_input()`, `page_background()`, `focus_handle()`, `size()`, `deck_origin()`.
Events: `KeyEvent`, `TrackpadEvent`.

`MacTrackpad`: `finish`, `sound`, `scale`, `force_delay` (builders); `set_finish`, `set_sound`, `set_scale`;
`press_with_pressure`, `force`, `release` (for hosts with real pressure input); `phase()`, `geometry()`,
`size()`. Event: `TrackpadEvent`.

Other public items:

| Module | Contents |
| --- | --- |
| `scene` | `DeviceScene`, `trackpad_layers`, `key_layers`, `Layer`, `compose` (draws layers offscreen), `Tween`, the transition times. |
| `art` | The SVG documents of every part (`key_face`, `key_content`, `top_case`, `pad_surface`, `pad_side`), with CSS box shadows. |
| `raster` | Rasterization with `resvg`, the image cache, `top_case_art`, `pad_art`. |
| `lid` | `lid_model`, `flat_lid`, `project` (the CSS perspective), `lid_art`. |
| `text` | Legend shaping with SF Pro (`shape`, `TextStyle`). |
| `grain` | The `feTurbulence` fractal noise and the overlay blend. |
| `css` | A parser for CSS gradients, colors and box shadows. |
| `keycodes`, `native` | The macOS key code table and the native event monitor. |
| `sound` | `ClickSound` (the shared player), `ClipBank`, `render_voice`, `mix_into`. |
| `keymap` | `code_for_key` (the GPUI keystroke fallback). |
| `render`, `paint`, `assets` | Plain GPUI `div` builders of the old vector renderer (`key_cap`, `top_case_layers`, `pad_surface`) and `MacKeysAssets`. |

## Use the engine (`mackeys-core`)

```rust
use mackeys_core::*;

let kb = build_keyboard(&KeyboardOptions::new("air-midnight", "de"));
let theme = keyboard_theme(&kb.finish, &BacklightOptions::lit(12.0, Room::Dark));
let case = top_case(&kb.finish, &kb, &TopCaseOptions { parts: Some(Parts::Full), backlight: None });
let pad = trackpad("neo-indigo");
let device = mac_device(&MacDeviceOptions::default());
```

| Item | Port of |
| --- | --- |
| `build_keyboard(&KeyboardOptions) -> KeyboardGeometry` | `buildKeyboard` |
| `keyboard_theme(finish, &BacklightOptions) -> KeyboardTheme`, `backlight_glow` | `keyboardTheme`, `backlightGlow` |
| `top_case(finish, &KeyboardGeometry, &TopCaseOptions) -> TopCaseGeometry` | `topCase` |
| `trackpad(finish) -> TrackpadGeometry`, `trackpad_shadows` | `trackpad`, `trackpadShadows` |
| `mac_device(&MacDeviceOptions) -> MacDevice` | `macDevice` |
| `KeyboardController`, `TrackpadController`, `SoundSink`, `IDLE_DELAYS`, `idle_delay` | `controller.ts` |
| `fmt`, `rgba`, `parse_color`, `color`, `css_color`, `to_rgba`, `Rgba` | `util.ts` |
| `data()`, `get_finish`, `get_layout`, `finish_ids`, `layout_ids`, `parse_token` | `data.ts`, `keyboard.ts` |
| `decode_clip`, `base64_decode`, `keyboard_clips`, `trackpad_clips`, `VoicePicker`, `filter_trackpad_clip`, `Biquad` | `audio.ts` |

All output structs derive `Serialize, Deserialize, Clone, Debug, PartialEq` with camelCase field names, so
their JSON is the same as the TypeScript output. Colors are `#rrggbbaa` strings. Use `to_rgba` or
`Rgba::to_unit` to get channels.

### Controllers and time

The controllers own no threads and no timers. They use explicit time:

1. Call the `*_at(.., now)` methods, or the plain methods (they use `Instant::now()`).
2. Read `next_deadline()`.
3. Call `tick(now)` at or after that deadline. This releases caps lock taps, sets the idle state and starts
   force clicks.
4. Read the events with `take_events()`. `revision()` increments on each state change.

The GPUI views do steps 2 and 3 with a GPUI timer task.

### Data files

`spec/mackeys-data.json` and the two click files are embedded at build time. `build.rs` copies them from
`../../../spec/` into `OUT_DIR`, and the code uses `include_str!`. A published crate has no `spec/` folder:
run `scripts/vendor-data.sh` before `cargo publish`. The script copies the files into
`crates/mackeys-core/data/`, which `build.rs` uses when `spec/` is not there.

## Tests

```sh
cd rust
cargo build --workspace --all-targets
cargo test --workspace
```

`crates/mackeys-core/tests/conformance.rs` checks every entry of `keyboards.json` (72), `themes.json` (102),
`topcases.json` (68) and `trackpads.json` (17) against the SPEC "Conformance" rules: numbers within 1e-6,
strings exact, colors within 1 unit per channel, same array lengths, `null` stays `null`, and no missing or
extra fields. It also tests the keyboard and trackpad controllers.

`crates/mackeys-gpui/tests/views.rs` opens the views in a GPUI test window (`#[gpui::test]`). It clicks
a key and checks the pressed state, the press transition and the `KeyEvent`s; it sends keystrokes,
modifier and caps lock changes; it clicks the trackpad and forces it. `tests/sound.rs` decodes the
clips, renders voices with the SPEC rate and gain, mixes them into a buffer and checks the level (no
audio device needed).

Compare the GPUI art with the web reference screenshots:

```sh
cargo run --release -p mackeys-gpui --example compare
```

It draws the eight configurations of `spec/reference/screens` offscreen with the same layers the views
draw, writes `target/compare/<name>.png` and `target/compare/<name>-side.png` (reference left), and
prints the mean channel difference. `DIFF=1` also writes a difference image. `CROP=x,y,w,h` writes the
same crop of both images.

## Rendering notes and limits

The views draw raster images, not GPUI `div` styles. Each part is an SVG document that follows
`MACKEYS_CSS` and the SPEC "Rendering contract". `resvg` rasterizes it at the view scale times the
window's scale factor, and GPUI draws it with `img()`. The images are cached.

| Part | How it is drawn |
| --- | --- |
| Key face | The radial gradient (125 % x 110 % at the bottom middle), the 1 px outline and the 1.8 px highlight as inset shadows, and `capShadows` with Gaussian blur. One image per size, theme and state. |
| ISO and JIS return | The `iso` path with the radial gradient, the outline and highlight strokes, and the drop shadow (0, 1, blur 1). |
| Legends | Shaped with `rustybuzz` from `/System/Library/Fonts/SFNS.ttf` (SF Pro): weight 400, letter spacing `tracking`, kerning, and the optical size from the size in device pixels (as Chrome on macOS). Hangul, kana and kanji come from the first system font that has them (Apple SD Gothic Neo, Hiragino Sans ...). The glow is a blurred copy under the text. Baselines snap to device pixels. |
| Icons | The glyph paths in the legend color, with the `iconGlow` blur. |
| Caps lock LED, home bar, Touch ID | As in the CSS. The `dark` Touch ID ring is a conic gradient of 120 wedges. |
| Shadows | CSS box shadows: outer shadows are clipped to the outside of the box; inset shadows are a blurred frame clipped to the box. Large boxes are done in bands along their edges. Soft shadows (blur 12 px or more) are rasterized at 0.5 pixels per px and scaled up. |
| Gradients | Every stop of the core gradients (3-stop hinge barrels, notch). |
| Grain | The SVG `feTurbulence` fractal noise (seed 0, two octaves, frequency 0.95 on the deck and 1.1 on a standalone trackpad), made gray in linear RGB, blended with `overlay` at the `grain` opacity. |
| Lid | A port of the web `Lid`: shell, bezel, wallpaper (the CSS `wall` layers are parsed), the four ribbons with their blur, vignette, menu bar, widgets, dock, glass, glimmer, notch and camera. It is drawn flat, then projected with `perspective(4200px) rotateX(-80deg)` about its bottom center (3 x 3 samples per pixel, after a 4 x vertical box filter; the blurred ribbons are rasterized at a quarter of the resolution). One image per finish, size and scale. |
| Key boxes | Snap to device pixels, as browsers do. |

Animation: a pressed key moves down 0.45 px, scales to 0.986 and fades to the pressed image
(brightness `pressedBrightness`, no highlight). It goes in over 26 ms and out over 95 ms with
`cubic-bezier(.2, .75, .3, 1)`. The trackpad moves 1 px (down) or 1.8 px (force) and fades to the darker
image with the inner shadow, in 35 ms and out in 140 ms. The views request animation frames only while a
transition runs.

Physical keys and Force Touch (macOS): each view adds an `NSEvent` local monitor for its window
(key down, key up, flags changed and pressure). It does not consume events.

- Keys: the monitor maps `keyCode` with the macOS virtual key code table (`keycodes.rs`): left and right
  modifiers, F-keys, the ISO section key (swapped on ISO keyboards, as Chromium does), and the JIS keys
  (`IntlYen`, `IntlRo`, `Lang1`, `Lang2`). Keys go to the controller only while the view has focus.
  Caps lock gives one tap per toggle.
- Pressure: at stage 2, while the pointer holds the trackpad, the view starts the force click at once
  and plays `NSHapticFeedbackManager` generic feedback. The 500 ms timer stays as the fallback (a
  mouse, or a trackpad without Force Touch).
- On other platforms, and in GPUI test windows, the views use GPUI keystrokes: `keymap::code_for_key`
  looks for a key of the drawn layout whose legend shows the typed character, then uses the US ANSI
  map. Modifiers have no side there, so they light the left key.

Remaining differences from the web reference (see `target/compare/*-side.png`; mean channel
difference 0.5 to 1.5 of 255):

- Glyph edges: resvg and Core Text rasterize text differently, so letter edges differ by a fraction of
  a pixel. The lid text has no `antialiased` smoothing in the web CSS, so macOS draws it a little heavier;
  a thin stroke imitates that.
- A pressed key is a scaled copy of the pressed image. Chrome draws the transformed key from vectors,
  so its 1 px outline is a little sharper.
- The grain uses the same algorithm, but its contrast and phase differ a little from Chrome's GPU
  filter.
- The legend font file is `/System/Library/Fonts/SFNS.ttf` (then `HelveticaNeue.ttc`). Without them (not
  macOS), legends are not drawn.
- The first frame after a change waits for the background images (see above).
- Sound: `rodio` plays the clips with the SPEC's random take, rate and gain (the clip is resampled
  for the rate). The trackpad filter (high shelf 2 kHz -14 dB, then low-pass 5 kHz Q 0.5) is a pair of RBJ
  biquads applied once when the clips load. When no audio device exists, the player does nothing.
  Build without sound with `--no-default-features`.

## GPUI version

- `gpui = "0.2.2"` from crates.io, with the `runtime_shaders` feature.
- Tested on macOS 27 with Rust 1.99 and the Command Line Tools only.
- If a later GPUI release changes the API, pin 0.2.2, or use Zed's git repository at a fixed `rev`.

## Sound attribution

The click sounds are CC0 recordings from Freesound:

- Keyboard: Freesound #853602, "Typing on Laptop Keyboard #2" by justamudkip (2021 14-inch MacBook Pro).
- Trackpad: Freesound #467490, "MacBook Pro trackpad (48/24)" by neilraouf (2019 MacBook Pro).

## License

MIT, as the rest of this repository.
