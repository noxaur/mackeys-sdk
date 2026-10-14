# @mackeys/svelte

Interactive Mac keyboards and Force Touch trackpads for Svelte 5.

```bash
npm install @mackeys/svelte
```

## Components

```svelte
<script lang="ts">
  import { MacBook, MacKeyboard, MacTrackpad, type KeyEvent } from '@mackeys/svelte';
  let last = $state('');
</script>

<!-- A whole MacBook: lid, keyboard and trackpad. -->
<MacBook finish="air-starlight" layout="fr" scale={0.6} />

<!-- A keyboard on its deck. Every key press on the page shows on it. -->
<MacKeyboard
  finish="pro-space-black"
  layout="en-us"
  capture="window"
  backlight={{ on: true, level: 12, room: 'dark', idleOff: '30s' }}
  onkeydown={(e: KeyEvent) => (last = e.id)}
/>

<!-- A trackpad. Hold it for 500 ms for a force click. -->
<MacTrackpad finish="neo-indigo" onforceclick={() => console.log('force')} />
```

The props are the same as in `@mackeys/react`, with lower-case event names: `onkeydown`,
`onkeyup`, `onpress`, `onforceclick`, `onrelease`. Use `class` and `style` for the outer element.

| Prop | Default | Use |
| --- | --- | --- |
| `finish` | `pro-space-black` | Device and color. |
| `layout` | `en-us` | Key legends, or `custom` with the `custom` prop. |
| `backlight` | off | `on`, `level` (0-16), `room`, `bleed`, `color`, `idleOff`. |
| `sound` | `true` | Recorded clicks, `false`, or your own `SoundSink`. |
| `capture` | `focus` | `focus`, `window` or `none`. |
| `highlight` | | Key ids to show as pressed. |
| `scale` | `1` | Uniform scale. |
| `view` | `top-down` | `angled` tilts the device back. |
| `lid` (MacBook) | `true` | Show the open lid. |

## Build your own

`Keys`, `keyboardState` and `trackpadState` give you the parts. The package re-exports all of
`@mackeys/core`.
