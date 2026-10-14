# MacKeys spec

This spec defines one model of the Mac keyboards and trackpads in the "Mac Keyboard" design canvas
(https://claude.ai/artifact/RZj22gfociKSiJjCKbQBBa). Every SDK in this repo implements it:

| SDK | Path | Renders with |
| --- | --- | --- |
| `@mackeys/core` | `packages/core` | (engine only, canonical) |
| `@mackeys/react` | `packages/react` | React DOM |
| `@mackeys/svelte` | `packages/svelte` | Svelte 5 DOM |
| `MacKeys` | `swift/` | SwiftUI (macOS 14+) |
| `mackeys-core`, `mackeys-gpui` | `rust/` | GPUI |

The canonical implementation is the TypeScript engine in `packages/core/src`. A port translates
`keyboard.ts`, `theme.ts` and `controller.ts` one to one. The original canvas source is in
`spec/reference/` for reference only.

## Files

- `mackeys-data.json`: all static data (models, finishes, layouts, JIS table, glyph paths). Ports load
  this file. They do not copy the tables by hand.
- `fixtures/keyboards.json`: `buildKeyboard(input)` results for 4 models x 18 layouts.
- `fixtures/themes.json`: `keyboardTheme(finish, backlight)` results for 17 finishes x 6 backlight cases.
- `fixtures/topcases.json`: `topCase(finish, buildKeyboard({finish}), {parts, backlight})` results.
- `fixtures/trackpads.json`: `trackpad(finish)` results.
- `keyboard-clicks.json`, `trackpad-clicks.json`: CC0 click recordings (see Sound).

Each fixture entry is `{ "input": {...}, "output": {...} }`. Regenerate with `pnpm spec`.

## Conformance

A port passes when, for every fixture entry:

1. Numbers match within `1e-6`.
2. Strings (ids, labels, legend text, SVG paths) match exactly.
3. Colors match within 1 unit per channel. Colors are `#rrggbbaa`; alpha is `round(a * 255)`.
4. Arrays have the same length and order. `null` fields stay `null`.

Path numbers use one format: round to 4 decimals, then drop trailing zeros and a trailing dot
(`fmt` in `util.ts`). `-0` prints as `0`.

Characters are Unicode code points. Split strings by code point, never by UTF-16 unit or byte.

## Ids

- Finish ids: `pro-space-black`, `pro-silver`, `air-midnight`, `air-starlight`, `air-sky-blue`,
  `air-silver`, `neo-silver`, `neo-blush`, `neo-citrus`, `neo-indigo`, `imac-silver`, `imac-blue`,
  `imac-purple`, `imac-pink`, `imac-orange`, `imac-yellow`, `imac-green`. A finish name
  (`MacBook Pro · Space Black`) is accepted too. An unknown id falls back to `pro-space-black`.
- Layout ids: `en-us`, `en-gb`, `de`, `fr`, `es`, `sv-fi`, `no`, `da`, `it`, `ja`, `nl`, `en-intl`,
  `ch`, `pt`, `ru`, `ko`, `custom`. An unknown id falls back to `en-us`.
- Model ids: `pro` (MacBook Pro 14/16), `air` (MacBook Air 13/15), `neo` (MacBook Neo),
  `mk` (Magic Keyboard with Touch ID for iMac).
- Key ids are W3C `KeyboardEvent.code` values (`KeyA`, `Digit1`, `ShiftLeft`, `IntlBackslash` ...),
  plus `Fn` and `TouchID`. A key with no code gets `k<index>`.

## Coordinates

All sizes are CSS px at scale 1. 1 key pitch = 19.0 mm = 64 px; 1 row = 62.3 px.
Key `x`, `y` are relative to the keyboard origin. Legend, icon, LED, home bar and Touch ID positions
are relative to the key's top-left corner. A renderer may scale the whole drawing uniformly.

## Rendering contract

Draw back to front. The web renderers in `packages/react` and `packages/svelte` are the visual
reference; `MACKEYS_CSS` in `packages/core/src/dom.ts` holds the exact CSS.

### Top case (`TopCaseGeometry`)

1. Side: a rounded rect `width x height`, offset 10 px down, filled with the vertical `side`
   gradient, with `sideShadows`.
2. Deck: a rounded rect at (0, 0) with the vertical `deck` gradient and `deckShadows`.
   `radius` lists top-left, top-right, bottom-right, bottom-left.
3. Grain: optional fractal noise at opacity `grain`, overlay blend. A port may skip it.
4. Full only: hinge bar (black, `#000` to `#0b0b0c`) and two barrels, the trackpad, the front notch
   (`notch.fill` below the front edge) and its scoop (a 6 px fade to black at `scoopOpacity`).
5. Grilles: a dot grid (`pitch` px, dot radius `dotRadius`, color `dot`), centered in each rect.
6. Dim: a black rect over the deck at opacity `dim` (dark room on backlit models).
7. Well: a rounded rect (`radius` 12), fill `well.fill`, shadows `well.shadows`.
   The keyboard origin is `keyboard.x`, `keyboard.y` (inside the well, after `well.pad`).

### Key caps (`KeyCap` + `KeyboardTheme`)

- Face: rounded rect (`radius`), radial gradient centered at the bottom middle, radius 125% of the
  width and 110% of the height, from `face1` (center) to `face0` (edge).
- Inner 1 px outline in `outline`; a 1.8 px inner highlight along the top in `highlight`.
- Outer shadows: `capShadows` (CSS box-shadow semantics; spread 0).
- Pressed: move down 0.45 px, scale 0.986 around the center, multiply brightness by
  `pressedBrightness`, and drop the top highlight. Press in 26 ms, release in 95 ms.
- ISO and JIS return (`iso` not null): draw `iso.path` (viewBox `0 0 w h`) with the same face gradient
  and a 1 px `outline` stroke, `iso.highlight` as a 0.8 px `highlight` stroke, and a drop shadow
  (0, 1, blur 1) of `rgba(0,0,0,.4)` (dark keys) or `rgba(0,0,0,.14)` (light keys). No box face.
- Legends: font SF Pro Text regular (system font), size `size`, letter spacing `tracking` em, color
  `legend`, glow `legendGlow` (text shadows, offset 0). The line box is `size` high and its top is at
  `top`. `align: center` centers across the key width; `left`/`right` put the text `inset` px from
  that edge.
- Icon: map `viewBox` into the icon rect with uniform scale, centered. Fill `fill` with the legend
  color. Stroke `stroke` with the legend color, width `strokeWidth` in viewBox units, round caps and
  joins. Glow `iconGlow`.
- Caps lock LED: a circle (`capsLed.d`), color `capsLedOff`, or `capsLedOn` with `capsLedGlow` when
  caps lock is on.
- Home bar (F and J): a rect with corner radius 1 in `homeBar`.
- Touch ID: a circle of diameter `touchId.d` at the key center. Styles by `theme.touchId`:
  - `dark`: conic ring `#5a5a5e`, `#48484c`, `#3a3a3d`, `#444448`, `#3a3a3d`; inner disc `#1b1b1d`
    inset 0.7 px.
  - `light`: ring `#c4c4c8`; inner disc `#eeeef0` inset 1.1 px with a 0.5 px `rgba(70,70,76,.45)` line.
  - `flush`: one disc in `face1` with a faint inner shadow.
  Multiply its brightness by `touchIdBrightness`.

### Trackpad (`TrackpadGeometry`)

- Side: rounded rect offset `sideDepth` down, `side` gradient, `sideShadows`.
- Surface: rounded rect (`radius`), `surface` gradient, `shadows`, grain at `grain` (optional).
- Phases: `down` moves the surface 1 px down at brightness 0.97 with an inner shadow
  (0, 1, blur 5, `rgba(0,0,0,.22)`); `force` moves 1.8 px at brightness 0.94 with
  (0, 2, blur 9, `rgba(0,0,0,.32)`).

## Behavior (`controller.ts`)

Keyboard:

- `press(id)`: ignore when down. Play the press sound for the key's `sound` class. Mark down.
  `CapsLock` toggles caps. Clear idle. Restart the idle timer.
- `release(id)`: ignore when up. Play the release sound. Mark up.
- Physical key down: unknown codes are ignored. Prevent the default action for every known key except
  `Tab` and command or control chords. `CapsLock` taps (press, then release after 110 ms) on both
  down and up, because macOS reports one event per toggle. Auto-repeat is ignored.
- Physical key up: `MetaLeft` or `MetaRight` up releases every key (macOS sends no key up for keys
  typed while command is held).
- Focus loss releases every key (one release sound).
- Idle: after `idleOffMs` without a press, `idle` becomes true and the backlight goes off.
  Delays: never, 5 s, 10 s, 30 s, 1 min, 5 min.

Trackpad: `press` plays the press click and enters `down`; after 500 ms held it plays the force click
and enters `force`; `release` plays the release click and enters `up`. A host with real pressure input
(macOS Force Touch) calls `force()` itself at pressure stage 2.

## Sound

Clip files hold mono 16-bit little-endian PCM in base64, at sample rate `sr`.

- Keyboard (`sr` 24000): `press` (6 takes), `release` (6), `space` (1). Pick a random take, never the
  same index twice in a row. Rate `0.985 + rand * 0.03`. Gain `0.85 * (0.85 + rand * 0.15)`.
  Space bar presses use `space`; all releases use `release`.
- Trackpad (`sr` 48000): `press` (3), `release` (2), `force` (1). Rate
  `(force ? 0.9 : 1) * (0.99 + rand * 0.02)`. Gain `force ? 0.85 : 0.75`. Filter: high shelf at
  2 kHz, -14 dB, then low-pass at 5 kHz, Q 0.5.

Sources (CC0): Freesound #853602 "Typing on Laptop Keyboard #2" by justamudkip (2021 14-inch MacBook
Pro); Freesound #467490 "MacBook Pro trackpad (48/24)" by neilraouf (2019 MacBook Pro).
