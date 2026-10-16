# Getting started with MacKeys

MacKeys draws interactive Mac keyboards and Force Touch trackpads. This page shows how to install
each SDK and draw your first device. For the full TypeScript API, see [api.md](api.md). For all ids,
see [ids.md](ids.md).

## 1. Pick an SDK

| You build | Install | Notes |
| --- | --- | --- |
| A React 18+ app (Vite, Next.js, Remix) | `@mackeys/react` | Re-exports all of `@mackeys/core`. |
| A Svelte 5 or SvelteKit app | `@mackeys/svelte` | Re-exports all of `@mackeys/core`. Needs Svelte 5 (runes). |
| A custom renderer (canvas, WebGL, Vue, plain DOM, Node) | `@mackeys/core` | Geometry, themes, controllers and sound. No UI. |
| A macOS SwiftUI app | Swift package `MacKeys` | Products `MacKeysUI` and `MacKeysCore`. macOS 14+, Swift 6. |
| A Rust GPUI app | `mackeys-gpui` | macOS only. Rust 1.88+. |
| Rust geometry without UI | `mackeys-core` | Depends only on `serde` and `serde_json`. |

Install only one of the npm packages. `@mackeys/react` and `@mackeys/svelte` already contain the engine.

## 2. React

```bash
npm install @mackeys/react
```

```tsx
import { MacBook, MacKeyboard, MacTrackpad, type KeyEvent } from '@mackeys/react';

export function Demo() {
  return (
    <>
      {/* A whole MacBook: open lid, keyboard and trackpad. */}
      <MacBook finish="pro-space-black" layout="en-us" scale={0.5} />

      {/* A keyboard deck that shows every key press on the page. */}
      <MacKeyboard
        finish="air-midnight"
        layout="de"
        capture="window"
        backlight={{ on: true, level: 12, room: 'dark' }}
        onKeyDown={(e: KeyEvent) => console.log(e.id, e.label)}
        scale={0.6}
      />

      {/* A standalone trackpad. Hold it for 500 ms for a force click. */}
      <MacTrackpad finish="neo-citrus" onForceClick={() => console.log('force')} scale={0.5} />
    </>
  );
}
```

The components add one `<style id="mackeys-css">` element to the document on mount. You do not
import a CSS file.

### Next.js and other SSR frameworks

The components render on the server. Sound and window key capture start only in the browser. In
the Next.js App Router, put the component in a file that starts with `'use client'`, because the
components use hooks.

## 3. Svelte 5

```bash
npm install @mackeys/svelte
```

```svelte
<script lang="ts">
  import { MacBook, MacKeyboard, MacTrackpad, type KeyEvent } from '@mackeys/svelte';
  let last = $state('');
</script>

<MacBook finish="air-starlight" layout="fr" scale={0.5} />

<MacKeyboard
  finish="pro-space-black"
  layout="en-us"
  capture="window"
  backlight={{ on: true, level: 12, room: 'dark', idleOff: '30s' }}
  onkeydown={(e: KeyEvent) => (last = e.id)}
/>

<MacTrackpad finish="neo-indigo" onforceclick={() => console.log('force')} />

<p>Last key: {last}</p>
```

The props are the same as in React. The differences:

- Event props are lower case: `onkeydown`, `onkeyup`, `onpress`, `onforceclick`, `onrelease`.
- Use `class` (not `className`) and a `style` string (not an object).

## 4. Plain TypeScript (`@mackeys/core`)

Use the engine when you draw the device yourself. The engine gives absolute positions for every
key, legend, icon and LED, so a renderer only draws.

```bash
npm install @mackeys/core
```

```ts
import { macDevice, KeyboardController, sharedClickSound } from '@mackeys/core';

const device = macDevice({ finish: 'pro-silver', layout: 'en-gb', parts: 'full', backlight: { on: true, level: 10 } });
device.keyboard.keys; // KeyCap[]: id, x, y, w, h, legends, icon, ...
device.theme;         // KeyboardTheme: colors and shadows
device.topCase;       // TopCaseGeometry: deck, well, trackpad, hinge, grilles

const keys = new KeyboardController({ keys: device.keyboard.keys, sound: sharedClickSound() });
keys.subscribe((state) => draw(state.down, state.caps)); // your draw function
window.addEventListener('keydown', (e) => keys.handleKeyDown(e) && e.preventDefault());
window.addEventListener('keyup', (e) => keys.handleKeyUp(e));
```

To draw with DOM elements, use the helpers `injectStyles()`, `themeVars()`, `keyStyle()`,
`legendStyle()`, `iconStyle()`, `topCaseStyles()` and `trackpadStyles()`. See [api.md](api.md) and
the rendering contract in [spec/SPEC.md](../spec/SPEC.md).

## 5. Swift (SwiftUI, macOS 14+)

Add the package with Swift Package Manager. The package name is `MacKeys`.

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/noxaur/mackeys-sdk.git", from: "0.1.1")
],
targets: [
    .target(name: "MyApp", dependencies: [
        .product(name: "MacKeysUI", package: "MacKeys"),
        .product(name: "MacKeysCore", package: "MacKeys")
    ])
]
```

```swift
import SwiftUI
import MacKeysUI
import MacKeysCore

struct ContentView: View {
    @State private var keyboard = KeyboardController()

    var body: some View {
        VStack {
            MacBookView(finish: .proSpaceBlack, layout: .enUS, sizing: .fitWidth, controller: keyboard)
            MacKeyboardView(finish: .airMidnight, layout: .de,
                            backlight: BacklightOptions(on: true, level: 12, room: .dark),
                            sizing: .scale(0.75))
            MacTrackpadView(finish: .proSilver, sizing: .scale(0.5))
        }
        .onAppear { keyboard.onKey = { e in print(e.type, e.id) } }
    }
}
```

Swift enum cases are camelCase forms of the ids: `.proSpaceBlack` is `pro-space-black`, `.enUS`
is `en-us`. Run the demo app from the repository root with `swift run MacKeysDemo`. See
[swift/README.md](../swift/README.md) for the full API.

## 6. Rust (GPUI, macOS)

```toml
[dependencies]
mackeys-gpui = "0.1"
```

```rust
use gpui::{prelude::*, px, size, Application, Bounds, WindowBounds, WindowOptions};
use mackeys_gpui::{Backlight, KeyEvent, MacBook, MacKeysAssets, Room};

fn main() {
    Application::new().with_assets(MacKeysAssets::new()).run(|cx| {
        let bounds = Bounds::centered(None, size(px(900.), px(700.)), cx);
        let options = WindowOptions { window_bounds: Some(WindowBounds::Windowed(bounds)), ..Default::default() };
        cx.open_window(options, |window, cx| {
            let book = cx.new(|cx| {
                MacBook::new(window, cx)
                    .finish("pro-silver")
                    .layout("en-gb")
                    .backlight(Backlight::lit(12.0, Room::Dark))
                    .scale(0.6)
            });
            cx.subscribe(&book, |_, e: &KeyEvent, _| println!("{:?} {}", e.kind, e.id)).detach();
            book
        })
        .unwrap();
    });
}
```

Focus the view (or click it) to send physical key presses to it. See
[rust/README.md](../rust/README.md) for the full API and the showcase example.

## 7. Common tasks (React and Svelte)

| Task | Code |
| --- | --- |
| Fit the device to a smaller area | `scale={0.5}` |
| Tilt the device back, as on a desk | `view="angled"` |
| Show a shortcut as pressed (no input) | `highlight={['MetaLeft', 'KeyC']}` |
| Show every key press on the page | `capture="window"` |
| Show no physical key presses | `capture="none"` (clicks on keys still work) |
| Turn the backlight on in a dark room | `backlight={{ on: true, level: 16, room: 'dark' }}` |
| Turn the backlight off after 30 s of no input | `backlight={{ on: true, idleOff: '30s' }}` |
| Mute the clicks | `sound={false}` |
| Hide the MacBook lid | `<MacBook lid={false} />` |
| Use the page color of the original canvas | React: `stageColor(finish, backlight)`. Svelte: `cssColor(topCase(finish, buildKeyboard({ finish }), { backlight }).pageBackground)` |
| List finishes or layouts for a picker | `FINISHES` (`id`, `name`) and `LAYOUTS` (`id`, `name`) |
| Make your own legends | `layout="custom"` and `custom={{ kind: 'ANSI', q: 'Q W E R T Y U I O P [ ]' }}` (see [ids.md](ids.md)) |

## 8. Common mistakes

- **No key presses show when I type.** The default `capture` is `focus`. The keyboard gets typing
  only while one of its keys has focus (click a key first). Use `capture="window"` for page-wide input.
- **The backlight does nothing.** Neo and `imac-*` finishes have no backlight. Also, in `room:
  'daylight'` the light is weak. Use `room: 'dark'` to see it clearly.
- **The device is too large.** At scale 1, one key is 64 px. Set `scale`. The outer element has the
  scaled width and height, so layout works with it.
- **The first click is silent.** Browsers start audio only after a user gesture. The sound starts
  after the first click or key press.
- **`MacBook` with an `imac-*` finish shows no lid or trackpad.** This is correct. A Magic Keyboard
  has no lid and no built-in trackpad.
- **Tab and command shortcuts still work in my app.** This is intentional. The controller does not
  call `preventDefault()` for Tab and for command or control chords.
- **TypeScript rejects my finish id.** Use the exact ids from [ids.md](ids.md), for example
  `air-sky-blue` (not `air-skyblue`) and `sv-fi` (not `sv`).
