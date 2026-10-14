# @mackeys/core

The MacKeys engine: Mac keyboard and trackpad geometry, themes, layouts, controllers and click
sounds. It has no UI dependency. `@mackeys/react` and `@mackeys/svelte` render it.

```bash
npm install @mackeys/core
```

## Geometry

```ts
import { buildKeyboard, keyboardTheme, topCase, trackpad, macDevice } from '@mackeys/core';

const kb = buildKeyboard({ finish: 'pro-space-black', layout: 'de' });
kb.keys[0];
// { id: 'Escape', label: 'escape', x: 0, y: 0, w: 89, h: 55.4, legends: [...], icon: null, ... }

const theme = keyboardTheme('pro-space-black', { on: true, level: 12, room: 'dark' });
const deck = topCase('pro-space-black', kb, { parts: 'full' });
const pad = trackpad('air-sky-blue');
const all = macDevice({ finish: 'neo-blush', layout: 'en-gb', parts: 'full' });
```

Every legend, icon, caps lock LED, home bar and Touch ID button has an absolute position, so a
renderer only draws. See [spec/SPEC.md](../../spec/SPEC.md) for the rendering contract.

## Controllers

```ts
import { KeyboardController, TrackpadController, ClickSound } from '@mackeys/core';

const sound = new ClickSound();
const keys = new KeyboardController({ keys: kb.keys, sound, idleOffMs: 30_000 });
keys.onKey((e) => console.log(e.type, e.id));
window.addEventListener('keydown', (e) => keys.handleKeyDown(e) && e.preventDefault());
window.addEventListener('keyup', (e) => keys.handleKeyUp(e));

const tp = new TrackpadController({ sound });
tp.onEvent((e) => console.log(e.type)); // press, force, release
```

## DOM helpers

`MACKEYS_CSS`, `injectStyles()`, `themeVars()`, `keyStyle()`, `legendStyle()`, `iconStyle()`,
`topCaseStyles()` and `trackpadStyles()` turn the geometry into CSS for any DOM renderer.
