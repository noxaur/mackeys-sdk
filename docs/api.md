# MacKeys TypeScript API

This page lists the public API of `@mackeys/react`, `@mackeys/svelte` and `@mackeys/core`.
`@mackeys/react` and `@mackeys/svelte` re-export everything in `@mackeys/core`. Import all names
from the one package that you installed.

For Swift and Rust, see [swift/README.md](../swift/README.md) and [rust/README.md](../rust/README.md).
They use the same ids, options and field names.

## Components (React and Svelte)

### `MacKeyboard`

A keyboard on its deck, without a trackpad or lid.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `finish` | `FinishId` | `'pro-space-black'` | Device model and color. See [ids.md](ids.md). |
| `layout` | `LayoutId \| 'custom'` | `'en-us'` | Key legends. |
| `custom` | `Partial<CustomLayout>` | | Rows of a custom layout. Use with `layout="custom"`. |
| `backlight` | `Backlight` | off | See [Backlight](#backlight). |
| `sound` | `boolean \| SoundSink` | `true` | `true` = recorded clicks, `false` = silent, or your own sink. |
| `capture` | `'focus' \| 'window' \| 'none'` | `'focus'` | Source of physical key presses. `focus`: only while a key of this keyboard has focus. `window`: every key press on the page. `none`: no physical keys (pointer clicks still work). |
| `highlight` | `readonly string[]` | | Key ids to show as pressed, for example `['MetaLeft', 'KeyC']`. It does not fire events or play sounds. |
| `scale` | `number` | `1` | Uniform scale. At 1, one key pitch is 64 px. The outer element has the scaled size. |
| `view` | `'top-down' \| 'angled'` | `'top-down'` | `angled` tilts the device back with a CSS perspective. |
| `onKeyDown` / `onkeydown` | `(e: KeyEvent) => void` | | A key goes down (pointer, physical key or API). |
| `onKeyUp` / `onkeyup` | `(e: KeyEvent) => void` | | A key goes up. |
| `className` / `class` | `string` | | Class of the outer element. |
| `style` | React: `CSSProperties`. Svelte: `string`. | | Style of the outer element. |

### `MacBook`

The full MacBook top case: keyboard, Force Touch trackpad, hinge, front notch and, by default, the
open lid. It takes all `MacKeyboard` props and these:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `lid` | `boolean` | `true` | Show the open lid with its screen. The lid adds 200 px above and 120 px on each side (at scale 1). |
| `forceDelayMs` | `number` | `500` | Hold time before a trackpad click becomes a force click. |
| `onPress` / `onpress` | `() => void` | | The trackpad is clicked. |
| `onForceClick` / `onforceclick` | `() => void` | | The held click becomes a force click. |
| `onRelease` / `onrelease` | `() => void` | | The trackpad is released. |

With an `imac-*` finish, `MacBook` draws only the Magic Keyboard (no lid, no trackpad).

### `MacTrackpad`

A standalone Force Touch trackpad. It is a `<button>`, so Space and Enter also click it.

| Prop | Type | Default |
| --- | --- | --- |
| `finish` | `FinishId` | `'pro-space-black'` |
| `sound` | `boolean \| SoundSink` | `true` |
| `forceDelayMs` | `number` | `500` |
| `scale` | `number` | `1` |
| `onPress`, `onForceClick`, `onRelease` (Svelte: `onpress`, `onforceclick`, `onrelease`) | `() => void` | |
| `className` / `class`, `style` | | |

### Backlight

```ts
interface Backlight {
  on?: boolean;      // The switch. Only MacBook Pro and Air finishes have a backlight. Default false.
  level?: number;    // Brightness in sixteenths, 0 to 16. Default 12.
  room?: 'daylight' | 'dark'; // Default 'daylight'. 'dark' dims the deck and makes the light read stronger.
  bleed?: number;    // Light that spills out around each cap, 0 to 1. Default 0.5.
  color?: string;    // CSS color of the light. Default '#f2f5ff'.
  idleOff?: 'never' | '5s' | '10s' | '30s' | '1m' | '5m' | number | null; // Turn the light off after no key presses (ms for a number).
}
```

`Backlight` is the component type. The engine type `BacklightOptions` has the same fields without
`idleOff`, plus `idle?: boolean` (true while the idle timer has turned the light off).

### Accessibility

Each key is a `<button>` with `aria-label` (the key name) and `data-key` (the key id). Caps lock has
`aria-pressed`. The keyboard is a `role="group"` with a label. The lid and decorations are
`aria-hidden`.

## React extras

```ts
import { stageColor, useKeyboardController, useTrackpadController, Keys } from '@mackeys/react';
```

- `stageColor(finish, backlight?) => string`: the CSS page color of the original canvas behind a
  device (near black in a dark room).
- `useKeyboardController({ keys, sound?, idleOff?, onKeyDown?, onKeyUp? }) => [KeyboardController, KeyboardState]`:
  one controller for the life of the component. The state updates on every change.
- `useTrackpadController({ sound?, forceDelayMs?, onPress?, onForceClick?, onRelease? }) => [TrackpadController, TrackpadPhase]`.
- `Keys` props: `geometry`, `theme`, `state`, `controller`, `highlight?`, `label?`, `focusKeys?` (default `true`).
  It draws only the key caps, without the deck.
- Types: `MacKeyboardProps`, `MacBookProps`, `MacTrackpadProps`, `Backlight`, `KeysProps`, `SoundProp`, `IdleOff`.

Build your own keyboard from the parts:

```tsx
import { useEffect } from 'react';
import { Keys, buildKeyboard, injectStyles, keyboardTheme, useKeyboardController } from '@mackeys/react';

const geometry = buildKeyboard({ finish: 'imac-pink', layout: 'ja' });

export function BareKeys() {
  useEffect(() => injectStyles(), []); // Keys alone does not add the stylesheet.
  const [controller, state] = useKeyboardController({ keys: geometry.keys });
  return <Keys geometry={geometry} theme={keyboardTheme('imac-pink')} state={state} controller={controller} />;
}
```

## Svelte extras

```ts
import { Keys, keyboardState, trackpadState, windowKeys, resolveSound, idleMs } from '@mackeys/svelte';
```

- `keyboardState(controller) => { value: KeyboardState }`: runes state for a `KeyboardController`.
  Call it in a component script. It disposes the controller when the component is destroyed.
- `trackpadState(controller) => { value: TrackpadPhase }`.
- `windowKeys(() => enabled, controller)`: sends every page key press to the controller while `enabled` is true.
- `resolveSound(sound) => SoundSink | null`, `idleMs(idleOff) => number | null`.
- `Keys` props: `geometry`, `theme`, `kbState` (not `state`), `controller`, `highlight?`, `label?`, `focusKeys?`.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Keys, KeyboardController, buildKeyboard, injectStyles, keyboardState, keyboardTheme, resolveSound } from '@mackeys/svelte';

  const geometry = buildKeyboard({ finish: 'imac-pink', layout: 'ja' });
  const controller = new KeyboardController({ keys: geometry.keys, sound: resolveSound(true) });
  const kb = keyboardState(controller);
  onMount(() => injectStyles());
</script>

<Keys {geometry} theme={keyboardTheme('imac-pink')} kbState={kb.value} {controller} />
```

## Events and state

```ts
interface KeyEvent {
  type: 'press' | 'release';
  id: string;          // KeyboardEvent.code: 'KeyA', 'ShiftLeft', 'Fn', 'TouchID' ...
  label: string;       // Accessible key name, for example 'A' or 'right shift'.
  sound: KeySound;     // 'key' | 'mod' | 'tab' | 'caps' | 'wide' | 'enter' | 'space' | 'arrow' | 'power'
  source: 'pointer' | 'keyboard' | 'api';
}

interface KeyboardState {
  down: ReadonlySet<string>; // Ids of the keys that are down.
  caps: boolean;             // Caps lock LED.
  idle: boolean;             // True while the idle timer has turned the backlight off.
}

type TrackpadPhase = 'up' | 'down' | 'force';
interface TrackpadEvent { type: 'press' | 'force' | 'release'; source: 'pointer' | 'keyboard' | 'api' }
```

## Controllers (`@mackeys/core`)

The controllers are framework-free state machines. The components create them for you. Create them
yourself for a custom renderer or to drive keys from code.

### `KeyboardController`

```ts
new KeyboardController({ keys?: KeyCap[], sound?: SoundSink | null, idleOffMs?: number | null, tapMs?: number /* 110 */ })
```

| Member | Description |
| --- | --- |
| `press(id, source?)` / `release(id, source?)` | Press or release one key. A second press of a down key does nothing. |
| `tap(id, source?)` | Press, then release after `tapMs`. |
| `releaseAll(source?)` | Release every key that is down. |
| `setCaps(on)` | Set the caps lock LED. A press of `CapsLock` also toggles it. |
| `handleKeyDown(e)` | Send a `KeyboardEvent` (or `{ code, repeat?, metaKey?, ctrlKey? }`). Returns `true` when you should call `e.preventDefault()`. It returns `false` for Tab, command or control chords, and unknown keys. |
| `handleKeyUp(e)` | Send a key up. The release of command releases all keys, because macOS sends no key up for keys typed with command held. |
| `subscribe(fn)` | Listen to `KeyboardState` changes. Returns an unsubscribe function. |
| `onKey(fn)` | Listen to `KeyEvent`s. Returns an unsubscribe function. |
| `getState()`, `isDown(id)`, `has(id)` | Read the state. |
| `setKeys(keys)`, `setIdleOff(ms)` | Change the keys or the idle delay. |
| `sound` | The `SoundSink`, or `null`. You can set it at any time. |
| `dispose()` | Clear timers and listeners. |

### `TrackpadController`

```ts
new TrackpadController({ sound?: SoundSink | null, forceDelayMs?: number /* 500 */ })
```

`press(source?, timedForce = true)`, `force(source?)`, `release(source?)`, `getPhase()`,
`subscribe(fn)`, `onEvent(fn)`, `dispose()`. Set `timedForce` to `false` when you have real pressure
input and call `force()` yourself.

## Sound

```ts
interface SoundSink {
  key(kind: KeySound, up: boolean): void;
  trackpad(kind: 'press' | 'release' | 'force'): void;
}
```

- `sharedClickSound()`: the one `ClickSound` that all components on the page use.
- `new ClickSound({ volume?: number /* 1 */, hardness?: number /* 0.2 */, context?: AudioContext })`:
  plays the recorded clicks with Web Audio. `hardness` is the chance of a hard press. Set
  `enabled = false` to mute it. The `AudioContext` starts on the first sound.
- To change the volume of all components: `sharedClickSound().volume = 0.5`.
- To use your own sounds, give an object that implements `SoundSink` to the `sound` prop.

## Engine functions (`@mackeys/core`)

| Function | Returns |
| --- | --- |
| `buildKeyboard({ finish?, layout?, custom? })` | `KeyboardGeometry`: `finish`, `layout`, `model`, `lightKeys`, `backlit`, `width`, `height`, `keys: KeyCap[]`. |
| `keyboardTheme(finish, backlight?)` | `KeyboardTheme`: key face gradient, outline, highlight, shadows, legend color and glow, caps LED colors, `glow`. |
| `topCase(finish, keyboard, { parts?: 'full' \| 'keyboard', backlight? })` | `TopCaseGeometry`: size, radius, deck and side gradients, well, keyboard origin, grilles, trackpad, hinge, notch, `pageBackground`. |
| `trackpad(finish)` | `TrackpadGeometry` of a standalone trackpad. |
| `trackpadShadows(finish)` | `Shadow[]` of the built-in trackpad. |
| `macDevice({ finish?, layout?, custom?, parts?, backlight? })` | `{ keyboard, theme, topCase }`. |
| `backlightGlow(finish, backlight?)` | The lit level after the room exposure, 0 to 1 (0 on models with no backlight). |
| `getFinish(id)`, `getLayout(id)` | `FinishSpec`, `LayoutSpec` (with fallback). |

`KeyCap` has `id`, `label`, `kind`, `row`, `x`, `y`, `w`, `h`, `radius`, `sound`, `legends`,
`icon`, `iso`, `homeBar`, `capsLed` and `touchId`. Key `x` and `y` are relative to the keyboard
origin. Legend, icon and LED positions are relative to the key. All sizes are px at scale 1.

Colors in the engine output are `#rrggbbaa` strings. Use `cssColor(c)` to get a CSS color.

### Data

`FINISHES`, `FINISH_IDS`, `LAYOUTS`, `LAYOUT_IDS`, `MODELS`, `DEFAULT_CUSTOM_LAYOUT`, `IDLE_DELAYS`,
`KEY_SOUNDS`, `UNIT` (64), `ROW_PITCH` (62.3).

### DOM helpers

For a custom DOM renderer: `MACKEYS_CSS`, `injectStyles(doc?)`, `themeVars(theme, lightKeys)`,
`keyStyle(key)`, `legendStyle(legend)`, `iconStyle(icon)`, `rectStyle(rect)`, `touchIdStyle(d)`,
`topCaseStyles(topCase)`, `trackpadStyles(trackpad)`, `lidModel(finish, height)`, `gradientCss`,
`shadowsCss`, `radiusCss`, `styleString(map)`, `reactStyle(map)`. Each style helper returns a
`Record<string, string>` of CSS properties. The React and Svelte components are the reference for
how to use them. The draw order and rules are in [spec/SPEC.md](../spec/SPEC.md).
