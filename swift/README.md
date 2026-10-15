# MacKeys for Swift

MacKeys draws interactive Mac keyboards and Force Touch trackpads in SwiftUI:
MacBook Pro, MacBook Air, MacBook Neo and the Magic Keyboard with Touch ID for iMac.
It has 17 finishes, 17 layouts, a backlight model and recorded click sounds.

This package is the Swift port of the canonical TypeScript engine in `packages/core`.
The model follows `spec/SPEC.md`. The tests check every entry of the spec fixtures.

| Product | Contents |
| --- | --- |
| `MacKeysCore` | Engine (Foundation only): geometry, themes, top case, trackpad, controllers, SVG path parser, key code table, click clips. |
| `MacKeysUI` | SwiftUI views (`MacKeyboardView`, `MacBookView`, `MacTrackpadView`), pointer and keyboard input, Force Touch pressure, `ClickSound`. |
| `MacKeysDemo` | A demo app with pickers for finish, layout, backlight and view. |

Requirements: macOS 14 or later, Swift 6 (swift-tools-version 6.0).

## Install

Add the package with Swift Package Manager:

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/noxaur/mackeys-sdk.git", from: "0.1.0") // or .package(path: "../mackeys-sdk")
],
targets: [
    .target(name: "MyApp", dependencies: [
        .product(name: "MacKeysUI", package: "MacKeys"),
        .product(name: "MacKeysCore", package: "MacKeys")
    ])
]
```

`Package.swift` is in the repository root. The sources are in `swift/`. Run the demo from the repository root:

```sh
swift run MacKeysDemo
```

## Usage

### Views

```swift
import SwiftUI
import MacKeysUI
import MacKeysCore

struct ContentView: View {
    var body: some View {
        VStack {
            // The full MacBook: open lid with its screen, keyboard, grilles, hinge, built-in trackpad, front notch.
            MacBookView(finish: .proSpaceBlack, layout: .enUS, sizing: .fitWidth)

            // The top case only, without the lid.
            MacBookView(finish: .airStarlight, layout: .de, sizing: .fitWidth, showLid: false)

            // The keyboard deck only, with the backlight on in a dark room.
            MacKeyboardView(finish: .airMidnight, layout: .de,
                            backlight: BacklightOptions(on: true, level: 12, room: .dark),
                            sizing: .scale(0.75))

            // The standalone Force Touch trackpad.
            MacTrackpadView(finish: .proSilver, sizing: .scale(0.5))
        }
    }
}
```

Each view has a fixed size in px at scale 1 (as in the spec). With the lid (the default for MacBook finishes),
`MacBookView` reserves 200 px above the deck and 120 px on each side, as the web `MacBook` does. Use `sizing: .scale(s)` for a fixed
scale, or `sizing: .fitWidth` to scale to the available width.

### Key events

Give a view your own controller to read the state or to receive events:

```swift
let keyboard = KeyboardController()
keyboard.onKey = { e in print(e.type, e.id, e.label) }   // "press KeyA A"

MacBookView(finish: .proSilver, layout: .enGB, controller: keyboard)

// Or use an AsyncStream:
Task {
    for await e in keyboard.events() { print(e) }
}

// Drive keys from code:
keyboard.press("KeyA")
keyboard.release("KeyA")
keyboard.tap("CapsLock")
```

`KeyboardController` and `TrackpadController` are `@MainActor @Observable` classes.
SwiftUI views redraw when `down`, `caps`, `idle` or `phase` change.

### Physical keyboard

With `captureKeyboard: true` (the default), the view presses its keys when you type in its window.
The view maps macOS virtual key codes to `KeyboardEvent.code` ids (`MacKeyCodes`), including ISO
(`IntlBackslash`), JIS (`IntlYen`, `IntlRo`, `Lang1`, `Lang2`) and left and right modifiers.
The view does not take events while a text field has focus. Tab and command or control chords pass
through to the app. When the window loses focus, all keys go up.

### Trackpad

A click enters `down`. The surface moves 1 px down at brightness 0.97 with an inner shadow (1.8 px and 0.94 in
`force`). As in the `.mk-tp` CSS, it eases in 35 ms into `down` or `force` and in 140 ms back to `up`
(cubic-bezier(.2,.8,.3,1)). On Force Touch hardware, a deep press (pressure stage 2) enters `force` and plays
haptic feedback. Without pressure input, a hold of 500 ms enters `force`.

### Sound

`sound: true` (the default) plays the recorded clicks through `ClickSound.shared` (AVAudioEngine).
If audio is not available, the views stay silent. To use a custom sink, set `controller.sound`
to any `SoundSink`. The controller keeps a weak reference, so keep the sink alive yourself.

### Engine only

```swift
import MacKeysCore

let device = macDevice(finish: .proSpaceBlack, layout: .ja, parts: .full)
device.keyboard.keys      // [KeyCap] with legends, icons, LEDs, home bars, Touch ID
device.theme.face1        // "#2e2e30ff"
device.topCase.trackpad   // TrackpadRect?
let color = Color(mk: device.theme.legend)   // MacKeysUI helper
```

## API

`MacKeysCore`

- `buildKeyboard(finish:layout:custom:) -> KeyboardGeometry`
- `keyboardTheme(finish:backlight:) -> KeyboardTheme`
- `backlightGlow(_:_:) -> Double`
- `topCase(finish:keyboard:parts:backlight:) -> TopCaseGeometry`
- `trackpad(finish:) -> TrackpadGeometry`, `trackpadShadows(finish:)`
- `macDevice(finish:layout:custom:parts:backlight:) -> MacDevice`
- Types: `FinishID`, `LayoutID`, `ModelID`, `CustomLayout`, `BacklightOptions`, `Room`, `Parts`, `KeyCap`,
  `Legend`, `KeyIcon`, `IsoShape`, `Shadow`, `Gradient`, `Rect`. All model types are `Codable, Sendable, Equatable`
  and use the same field names as the TypeScript engine.
- `KeyboardController`: `press`, `release`, `tap`, `releaseAll`, `setCaps`, `handleKeyDown(code:isRepeat:metaKey:ctrlKey:)`,
  `handleKeyUp(code:)`, `setIdleOff(_:)`, `onKey`, `addListener`, `events()`, `dispose()`. Idle delays: `IdleDelay`.
- `TrackpadController`: `press(source:timedForce:)`, `force`, `release`, `cancelTimedForce`, `onEvent`, `events()`.
- `SoundSink` protocol, `ClipSet.keyboard`, `ClipSet.trackpad`, `decodeClip(_:)`.
- `SVGPath.parse(_:) -> [PathSegment]` (M L H V A C S Q T Z, absolute and relative; arcs become cubic Béziers).
- `MacKeyCodes.code(for:)`, `MacKeyCodes.modifierIsDown(code:modifierFlags:)`.
- `fmt(_:)`, `color(_:)`, `rgba(...)`, `parseColor(_:)`, `cssColor(_:)`.
- `MacKeysData.shared`: the bundled `mackeys-data.json`.

`MacKeysUI`

- `MacKeyboardView(finish:layout:custom:backlight:sound:captureKeyboard:idleOff:sizing:controller:)`
- `MacBookView(finish:layout:custom:backlight:sound:captureKeyboard:idleOff:sizing:showLid:controller:trackpadController:)`
- `MacTrackpadView(finish:sound:sizing:controller:)`
- `MacKeysSizing` (`.scale(CGFloat)`, `.fitWidth`)
- `ClickSound` (`shared`, `enabled`, `volume`, `hardness`, `close()`)
- `Color(mk:)`, `Gradient.swiftUI`, `svgPath(_:) -> Path`

## Spec files

The package bundles copies of the spec files. After a change in `spec/`, run:

```sh
swift/scripts/sync-spec.sh
```

It copies `mackeys-data.json`, `keyboard-clicks.json` and `trackpad-clicks.json` to
`Sources/MacKeysCore/Resources/`, and `spec/fixtures/*.json` to `Tests/MacKeysCoreTests/Fixtures/`.

## Tests

```sh
swift test
```

- `MacKeysCoreTests`: conformance with all entries of `keyboards.json` (72), `themes.json` (102),
  `topcases.json` (68) and `trackpads.json` (17); controller behavior; SVG path parser; key codes; clips.
- `MacKeysUITests`: renders views with `ImageRenderer` to `swift/.build/snapshots/*.png`, plus path,
  color and sound checks.
- `MacKeysUITests` "Reference comparison": renders the 8 configurations of `spec/reference/screens` at 2x on the
  same page and writes `swift/.build/snapshots/compare/<name>.png` (the Swift render), `<name>-side.png`
  (reference left, Swift right), `<name>-diff.png` (absolute difference x4) and `<name>-crop<N>.png`
  (reference above Swift, native pixels). It prints the mean difference and, per key, the offset of the legend
  ink between the reference and the Swift render. `MACKEYS_REF_FONT="<font name>"` draws the legends in another
  font, for a check of layout apart from glyph shapes.

## Notes

- With Command Line Tools only (no Xcode), the macOS 27 SDK cannot expand the SwiftUI `@State` macro.
  The package therefore declares its view state with `State(initialValue:)` and builds with either toolchain.

## How the views match the web

- Lid: a port of the web `Lid` (shell, bezel, wallpaper, ribbons, vignette, menu bar, widgets, dock, glass,
  glimmer, notch, camera). `CSSBackground` parses the `linear-gradient(<angle>deg, ...)` and
  `radial-gradient(<w>% <h>% at <x>% <y>%, ...)` layers of `finish.wall`. The ribbon groups are blurred with
  Core Image in linear light, as SVG filters blur in linearRGB. The flat lid is projected with
  `projectionEffect` and a `CATransform3D` equal to CSS `perspective(4200px) rotateX(-80deg)` about its bottom
  center.
- Grain: the SVG `feTurbulence` fractal noise (seed 0, 2 octaves, stitched 256 px tile, desaturated in linearRGB),
  made once per frequency and drawn with `.overlay` blend at opacity `grain` on the deck (0.95) and the standalone
  trackpad (1.1).
- Text: legends and lid text use CoreText with the system font and no font smoothing
  (`-webkit-font-smoothing: antialiased`). The baseline follows Blink: ascent and descent rounded to whole px,
  the content area centered in a line box of height = font size, the half leading floored.
- Pixel snapping: key faces are snapped to device pixels as Blink snaps boxes, and key and trackpad layers sit on
  whole device pixels (a layer at a fractional offset is resampled and looks soft).
- Pressed keys: the canvas draws `translateY(.45px) scale(.986)`, `brightness(pressedBrightness)` and the
  fading top highlight itself, so the cap stays sharp. Press 26 ms, release 95 ms. ISO and JIS return keys keep
  their highlight stroke when pressed, as on the web (the web drops the top highlight only for box keys;
  `spec/SPEC.md` says the same).

## Limits

Compared with `spec/reference/screens` (2x, same page, SF Pro in both), the mean absolute difference is 0.6 to
1.5 levels of 255 per channel. The remaining differences:

- Pressed keys: the reference keeps a brighter backlight ring around a pressed key (about 62 against 47 of 255 in
  the dark room). Chrome rasterizes the scaled, filtered key differently; the face, legend and brightness match.
- Text pixels: Chrome snaps the baseline and the small icon boxes to device pixels. Small glyphs can sit up to
  about 0.5 px from the reference.
- The lid is drawn with `projectionEffect`, so hit testing and accessibility ignore it (it is decorative, as
  `aria-hidden` on the web). At large scales the projected lid is resampled from the flat drawing.
- The spec makes the grain optional. The Swift grain is the same noise algorithm, but not the same pixels as
  Chrome's (Chrome evaluates the noise at its own sample positions).

## Sound attribution

- Keyboard: recorded for this project on a MacBook with the Norwegian layout, a soft and a hard press of
  each key class (`spec/recordings`). See the SPEC "Sound" section.
- Trackpad: a CC0 recording, Freesound #467490, "MacBook Pro trackpad (48/24)" by neilraouf (2019 MacBook
  Pro).
