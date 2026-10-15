# MacKeys SDK

MacKeys draws interactive Mac keyboards and Force Touch trackpads. It is an SDK for the
"Mac Keyboard" design canvas (https://claude.ai/artifact/RZj22gfociKSiJjCKbQBBa).

Each SDK gives you the same devices, finishes, layouts, backlight and click sounds:

| SDK | Path | Platform |
| --- | --- | --- |
| `@mackeys/core` | [packages/core](packages/core) | TypeScript engine (no UI) |
| `@mackeys/react` | [packages/react](packages/react) | React 18+ |
| `@mackeys/svelte` | [packages/svelte](packages/svelte) | Svelte 5 |
| `MacKeys` | [swift](swift) | Swift 6, SwiftUI, macOS 14+ |
| `mackeys-core`, `mackeys-gpui` | [rust](rust) | Rust, GPUI |

## What you get

- Devices: MacBook Pro 14/16, MacBook Air 13/15, MacBook Neo, and the Magic Keyboard with Touch ID
  for iMac. Each device comes as the keyboard deck, the full top case with its trackpad, or the
  trackpad alone.
- 17 finishes: Space Black, Silver, Midnight, Starlight, Sky Blue, Blush, Citrus, Indigo, and the
  seven iMac colors.
- 17 layouts: English (US, UK, International), German, French, Spanish, Swedish / Finnish,
  Norwegian, Danish, Italian, Japanese (JIS), Dutch, Swiss, Portuguese, Russian, Korean, and a
  custom ISO or ANSI layout.
- Backlight (Pro and Air): 16 brightness steps, daylight or dark room, light bleed, light color,
  and the idle timeout from System Settings.
- Input: click the keys, or type on the physical keyboard. Caps lock has a working LED. The
  trackpad clicks, and a held click becomes a force click.
- Sound: recorded MacBook key and trackpad clicks (CC0).

## How the SDKs stay the same

The TypeScript engine in `packages/core` is the reference. It resolves every key, legend and icon
to plain numbers. The [spec](spec/SPEC.md) folder holds the data as JSON and golden fixtures. The
Swift and Rust ports load the same data and pass the same fixtures.

```bash
pnpm install
```

```bash
pnpm build
```

```bash
pnpm test
```

```bash
pnpm spec
```

`pnpm spec` writes the data and fixtures again after a change to the engine.

## Quick start

React:

```tsx
import { MacBook } from '@mackeys/react';

<MacBook finish="pro-space-black" layout="en-us" backlight={{ on: true, level: 12 }} />;
```

Svelte:

```svelte
<script>
  import { MacKeyboard } from '@mackeys/svelte';
</script>

<MacKeyboard finish="imac-blue" layout="de" onkeydown={(e) => console.log(e.id)} />
```

Swift and Rust: see [swift/README.md](swift/README.md) and [rust/README.md](rust/README.md).

## Demos

```bash
pnpm --dir examples/react-demo dev
```

```bash
pnpm --dir examples/svelte-demo dev
```

## Sounds

- Keys: recorded for this project on a MacBook with the Norwegian layout. Each key class has a normal
  (soft) press and a hard press, each with its release. The power button (Touch ID) has one press.
  The source files are in `spec/recordings`. `scripts/cut-clicks.py` cuts them into
  `spec/keyboard-clicks.json`. The SPEC "Sound" section tells which key plays which recording.
- Trackpad: a CC0 recording, Freesound #467490, "MacBook Pro trackpad (48/24)" by neilraouf (2019 MacBook
  Pro).

Apple, Mac, MacBook, iMac, Magic Keyboard, Touch ID and Force Touch are trademarks of Apple Inc.
This project is not affiliated with Apple.
