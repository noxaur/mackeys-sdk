# MacKeys for Rust and GPUI

Interactive Mac keyboards and Force Touch trackpads for [GPUI](https://gpui.rs): MacBook Pro, Air, Neo and the
iMac Magic Keyboard, in 17 finishes and 17 layouts, with backlight and recorded click sounds.

The workspace has two crates:

| Crate | Purpose | Dependencies |
| --- | --- | --- |
| `mackeys-core` | The engine. A one-to-one port of the TypeScript engine in `packages/core/src`. It passes every fixture in `spec/fixtures`. | `serde`, `serde_json` |
| `mackeys-gpui` | GPUI views: `MacKeyboard`, `MacBook`, `MacTrackpad`. | `gpui` 0.2.2, `rodio` 0.21 (feature `sound`) |

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
| command-Q | Quit |

The toolbar buttons do the same.

## Use the GPUI components

1. Register `MacKeysAssets` as the asset source. The components draw key glyphs and speaker grilles as SVG
   documents that they generate at run time. GPUI loads every SVG through the asset source.
2. Create a view with `cx.new`.
3. Focus the view to receive physical key input. A click on the view also focuses it.

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

Other methods: `press(id, cx)`, `release(id, cx)`, `tap(id, cx)`, `state()`, `geometry()`, `top_case()`,
`trackpad_phase()`, `backlight_settings()`, `sound_enabled()`, `page_background()`, `focus_handle()`, `size()`.
Events: `KeyEvent`, `TrackpadEvent`.

`MacTrackpad`: `finish`, `sound`, `scale`, `force_delay` (builders); `set_finish`, `set_sound`, `set_scale`;
`press_with_pressure`, `force`, `release` (for hosts with real pressure input); `phase()`, `geometry()`,
`size()`. Event: `TrackpadEvent`.

Other public items: `MacKeysAssets`, `ClickSound` (the shared click player), `keymap::code_for_key`,
`render::key_cap`, `render::top_case_layers`, `render::pad_surface`, and the `paint` helpers.

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

## Rendering notes and limits

The views follow the SPEC "Rendering contract" with GPUI `div()` elements. GPUI 0.2.2 has some limits, so
some parts are approximations:

- Key face: GPUI has no radial gradient. The face is a vertical linear gradient from `face0` (top) to
  `face1` (bottom).
- Inset shadows: GPUI has no inset box shadows. A spread ring becomes a border. An offset line becomes a top
  or bottom border. A blurred inset shadow becomes a short vertical fade along one edge.
- Gradients with more than two stops (hinge barrels, front notch) are drawn as stacked bands.
- The ISO and JIS return keys are paths (`canvas` + `PathBuilder`). The drop shadow has no blur.
- Not drawn: the aluminium grain, legend and icon glow (GPUI has no text shadow or filter), and letter
  spacing (`tracking`).
- Touch ID: the conic ring of the `dark` style is a vertical gradient.
- Pressed keys move down 0.45 px, shrink by 1.4 %, and get darker. There is no press or release animation.
- The legend font is `.SystemUIFont` (SF Pro on macOS).
- Physical keys: GPUI reports the typed character, not the physical key. `keymap::code_for_key` first looks
  for a key of the drawn layout whose legend shows the character, then uses the US ANSI map. The result is
  correct only when the drawn layout matches the macOS input source. Dead keys are not found. Modifier
  keys have no left or right side in GPUI, so they light the left key.
- Force click: GPUI 0.2.2 has no pressure event, so the force click always comes from the 500 ms timer.
  Hosts with pressure input can call `MacTrackpad::press_with_pressure` and `MacTrackpad::force`.
- Sound: `rodio` plays the clips with the SPEC's random take, rate and gain. The trackpad filter (high shelf
  2 kHz -14 dB, then low-pass 5 kHz Q 0.5) is a pair of RBJ biquads applied once when the clips load. When
  no audio device exists, the player does nothing. Build without sound with `--no-default-features`.

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
