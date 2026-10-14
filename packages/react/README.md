# @mackeys/react

Interactive Mac keyboards and Force Touch trackpads for React 18+.

```bash
npm install @mackeys/react
```

## Components

```tsx
import { MacBook, MacKeyboard, MacTrackpad } from '@mackeys/react';

// A whole MacBook: lid, keyboard and trackpad.
<MacBook finish="air-midnight" layout="en-gb" view="angled" scale={0.6} />

// A keyboard on its deck. Every key press on the page shows on it.
<MacKeyboard
  finish="pro-space-black"
  layout="en-us"
  capture="window"
  backlight={{ on: true, level: 12, room: 'dark', bleed: 0.5, color: '#f2f5ff', idleOff: '30s' }}
  onKeyDown={(e) => console.log(e.id, e.label)}
/>

// A trackpad. Hold it for 500 ms for a force click.
<MacTrackpad finish="neo-citrus" onForceClick={() => console.log('force')} />
```

The components add one stylesheet (`#mackeys-css`) to the document on mount.

### Shared props

| Prop | Type | Default | Use |
| --- | --- | --- | --- |
| `finish` | `FinishId` | `pro-space-black` | Device and color. `imac-*` finishes are Magic Keyboards. |
| `layout` | `LayoutId \| 'custom'` | `en-us` | Key legends. |
| `custom` | `Partial<CustomLayout>` | | Rows of a custom layout (with `layout="custom"`). |
| `backlight` | `Backlight` | off | `on`, `level` (0-16), `room` (`daylight`, `dark`), `bleed` (0-1), `color`, `idleOff`. |
| `sound` | `boolean \| SoundSink` | `true` | Recorded clicks, silence, or your own sound sink. |
| `capture` | `'focus' \| 'window' \| 'none'` | `focus` | Source of physical key presses. |
| `highlight` | `string[]` | | Key ids to show as pressed, for example `['MetaLeft', 'KeyC']`. |
| `scale` | `number` | `1` | Uniform scale. At 1, one key is 64 px. |
| `view` | `'top-down' \| 'angled'` | `top-down` | Tilt the device back. |
| `onKeyDown`, `onKeyUp` | `(e: KeyEvent) => void` | | `e.id` is the `KeyboardEvent.code` (`KeyA`, `ShiftLeft`, `Fn`, `TouchID`). |

`MacBook` also takes `lid` (default `true`), `forceDelayMs`, `onPress`, `onForceClick` and
`onRelease`.

## Build your own

The hooks and the `Keys` component give you the parts:

```tsx
import { Keys, useKeyboardController, buildKeyboard, keyboardTheme } from '@mackeys/react';

const geometry = buildKeyboard({ finish: 'imac-pink', layout: 'ja' });
const [controller, state] = useKeyboardController({ keys: geometry.keys });
<Keys geometry={geometry} theme={keyboardTheme('imac-pink')} state={state} controller={controller} />;
```

The package re-exports all of `@mackeys/core`.
