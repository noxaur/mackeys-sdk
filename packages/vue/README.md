# @mackeys/vue

Interactive Mac keyboards and Force Touch trackpads for Vue 3.5+.

```bash
npm install @mackeys/vue
```

## Components

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { MacBook, MacKeyboard, MacTrackpad, type KeyEvent } from '@mackeys/vue';
const last = ref('');
</script>

<template>
  <!-- A whole MacBook: lid, keyboard and trackpad. -->
  <MacBook finish="air-starlight" layout="fr" :scale="0.6" />

  <!-- A keyboard on its deck. Every key press on the page shows on it. -->
  <MacKeyboard
    finish="pro-space-black"
    layout="en-us"
    capture="window"
    :backlight="{ on: true, level: 12, room: 'dark', idleOff: '30s' }"
    @keydown="(e: KeyEvent) => (last = e.id)"
  />

  <!-- A trackpad. Hold it for 500 ms for a force click. -->
  <MacTrackpad finish="neo-indigo" @forceclick="() => console.log('force')" />
</template>
```

The components add one stylesheet (`#mackeys-css`) to the document on mount. They render on the
server too.

The props are the same as in `@mackeys/react`. The events are `keydown`, `keyup`, `press`,
`forceclick` and `release`. `class` and `style` go to the outer element.

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
| `forceDelayMs` (MacBook, MacTrackpad) | `500` | Hold time for a force click. |
| `lid` (MacBook) | `true` | Show the open lid. |

## Build your own

`Keys`, `useKeyboardController` and `useTrackpadController` give you the parts:

```ts
import { Keys, useKeyboardController, buildKeyboard, keyboardTheme } from '@mackeys/vue';

const geometry = buildKeyboard({ finish: 'imac-pink', layout: 'ja' });
const { controller, state } = useKeyboardController();
controller.setKeys(geometry.keys);
// h(Keys, { geometry, theme: keyboardTheme('imac-pink'), state: state.value, controller })
```

The package re-exports all of `@mackeys/core`.
