# @mackeys/elements

Interactive Mac keyboards and Force Touch trackpads as Web Components, and a framework-free DOM
renderer. Use it in plain HTML, or in any framework that renders DOM: Angular, Solid, Lit,
Preact, Qwik, Astro, Ember, htmx.

```bash
npm install @mackeys/elements
```

## Web Components

Import `@mackeys/elements/define` once. It registers `<mac-keyboard>`, `<mac-trackpad>` and
`<mac-book>`.

```html
<script type="module">
  import '@mackeys/elements/define';
</script>

<mac-book finish="air-starlight" layout="fr" scale="0.6"></mac-book>

<mac-keyboard finish="pro-space-black" capture="window" backlight="on" backlight-level="12" room="dark" idle-off="30s"></mac-keyboard>

<mac-trackpad finish="neo-indigo"></mac-trackpad>

<script type="module">
  document.querySelector('mac-keyboard').addEventListener('mk-keydown', (e) => console.log(e.detail.id));
</script>
```

Each element renders into its own shadow root, with its own copy of the stylesheet.

### Attributes

| Attribute | Default | Use |
| --- | --- | --- |
| `finish` | `pro-space-black` | Device and color. |
| `layout` | `en-us` | Key legends. |
| `capture` | `focus` | `focus`, `window` or `none`. |
| `highlight` | | Key ids to show as pressed, separated by spaces: `highlight="MetaLeft KeyC"`. |
| `scale` | `1` | Uniform scale. |
| `view` | `top-down` | `angled` tilts the device back. |
| `sound` | on | `sound="off"` makes the element silent. |
| `backlight` | off | `backlight="on"` turns the light on. |
| `backlight-level`, `room`, `bleed`, `light-color`, `idle-off` | | The other backlight options. |
| `lid` (`mac-book`) | `true` | `lid="false"` hides the lid. |
| `force-delay` | `500` | Hold time for a force click, in ms. |

### Properties

Every attribute is also a property (`forceDelayMs` for `force-delay`). These properties take
objects: `custom` (a custom layout), `backlight` (a `Backlight` object, which wins over the
`backlight-*` attributes), `highlight` (an array), and `sound` (`true`, `false` or your own
`SoundSink`). `keyboard` and `trackpad` give the controllers while the element is in the
document.

### Events

The events bubble and cross the shadow root.

| Event | `detail` |
| --- | --- |
| `mk-keydown`, `mk-keyup` | `KeyEvent` (`id`, `label`, `sound`, `source`) |
| `mk-press`, `mk-forceclick`, `mk-release` | none |

### Frameworks

Angular: add `CUSTOM_ELEMENTS_SCHEMA` to the component, then bind properties and events:

```html
<mac-keyboard [finish]="finish" [backlight]="{ on: true, room: 'dark' }" (mk-keydown)="onKey($event)"></mac-keyboard>
```

Solid: `<mac-keyboard finish={finish()} prop:backlight={backlight()} on:mk-keydown={onKey} />`.

Vue: use `@mackeys/vue`, or tell the compiler that `mac-` tags are custom elements
(`isCustomElement: (tag) => tag.startsWith('mac-')`).

## DOM renderer

Without custom elements, mount a device into any element:

```ts
import { mountMacKeyboard } from '@mackeys/elements';

const view = mountMacKeyboard(document.getElementById('kbd')!, {
  finish: 'imac-blue',
  layout: 'de',
  onKeyDown: (e) => console.log(e.id)
});
view.update({ backlight: { on: true } });
view.keyboard!.tap('CapsLock');
view.destroy();
```

`mountMacTrackpad` and `mountMacBook` work the same way. The options are the props of
`@mackeys/react`. The renderer builds the device once and then changes only classes and styles,
so focus stays on a key. A change to `finish`, `layout`, `custom`, `lid`, `scale` or `view`
builds the device again.

The package re-exports all of `@mackeys/core`.
