# MacKeys ids

All SDKs use the same ids. TypeScript uses the strings below. Swift uses camelCase enum cases
(`.proSpaceBlack`, `.enUS`, `.svFI`). Rust uses the strings.

## Finish ids (`FinishId`)

The finish selects the device model and its color.

| Id | Name | Model | Backlight | Lid and trackpad |
| --- | --- | --- | --- | --- |
| `pro-space-black` (default) | MacBook Pro · Space Black | `pro` | yes | yes |
| `pro-silver` | MacBook Pro · Silver | `pro` | yes | yes |
| `air-midnight` | MacBook Air · Midnight | `air` | yes | yes |
| `air-starlight` | MacBook Air · Starlight | `air` | yes | yes |
| `air-sky-blue` | MacBook Air · Sky Blue | `air` | yes | yes |
| `air-silver` | MacBook Air · Silver | `air` | yes | yes |
| `neo-silver` | MacBook Neo · Silver | `neo` | no | yes |
| `neo-blush` | MacBook Neo · Blush | `neo` | no | yes |
| `neo-citrus` | MacBook Neo · Citrus | `neo` | no | yes |
| `neo-indigo` | MacBook Neo · Indigo | `neo` | no | yes |
| `imac-silver` | iMac · Silver | `mk` | no | no |
| `imac-blue` | iMac · Blue | `mk` | no | no |
| `imac-purple` | iMac · Purple | `mk` | no | no |
| `imac-pink` | iMac · Pink | `mk` | no | no |
| `imac-orange` | iMac · Orange | `mk` | no | no |
| `imac-yellow` | iMac · Yellow | `mk` | no | no |
| `imac-green` | iMac · Green | `mk` | no | no |

- Model ids: `pro` = MacBook Pro 14/16 (with speaker grilles), `air` = MacBook Air 13/15,
  `neo` = MacBook Neo (light key caps), `mk` = Magic Keyboard with Touch ID for iMac (light key caps).
- The engine also accepts the finish name (`'MacBook Air · Midnight'`).
- An unknown id gives `pro-space-black`.
- `MacTrackpad` with an `imac-*` finish draws the Space Black trackpad.
- In code: `FINISHES` (array of `FinishSpec` with `id`, `name`, `model`, `dark`), `FINISH_IDS`,
  `getFinish(id)`.

## Layout ids (`LayoutId`)

| Id | Name | Type |
| --- | --- | --- |
| `en-us` (default) | English (US) | ANSI |
| `en-gb` | English (UK) | ISO |
| `en-intl` | English (International) | ISO |
| `de` | German | ISO |
| `fr` | French | ISO |
| `es` | Spanish | ISO |
| `sv-fi` | Swedish / Finnish | ISO |
| `no` | Norwegian | ISO |
| `da` | Danish | ISO |
| `it` | Italian | ISO |
| `nl` | Dutch | ISO |
| `ch` | Swiss | ISO |
| `pt` | Portuguese | ISO |
| `ru` | Russian | ISO |
| `ko` | Korean | ANSI |
| `ja` | Japanese | JIS |
| `custom` | Your own legends | ISO or ANSI |

- ISO has a tall return key and one more key beside left shift.
- `en-us` on MacBook Pro and Air shows English word legends (`tab`, `caps lock`, `shift`). The other
  layouts show symbols.
- An unknown id gives `en-us`.
- In code: `LAYOUTS` (array of `LayoutSpec` with `id`, `name`, `iso`), `LAYOUT_IDS`, `getLayout(id)`.

## Key ids

Key ids are W3C `KeyboardEvent.code` values, plus `Fn` and `TouchID`. Use them in `highlight`,
`controller.press(id)` and `KeyEvent.id`.

ANSI (`en-us`, `ko`, ANSI custom), in row order:

```text
Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 TouchID
Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace
Tab KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash
CapsLock KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter
ShiftLeft KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ShiftRight
Fn ControlLeft AltLeft MetaLeft Space MetaRight AltRight ArrowLeft ArrowUp ArrowDown ArrowRight
```

ISO (all other layouts except `ja`) has these differences:

- The key left of `Digit1` is `IntlBackslash`.
- The key right of left shift is `Backquote`.
- `Backslash` is at the end of the caps lock row, before the tall `Enter`.

These ids match what Chrome reports on an ISO Mac keyboard.

JIS (`ja`) adds `IntlYen` (after `Equal`), `IntlRo` (before `ShiftRight`), `Lang2` (英数, left of
space) and `Lang1` (かな, right of space). Control is left of `KeyA`, and caps lock is in the bottom row.
There is no `Backquote` and no `AltRight`.

Modifier names: `MetaLeft` / `MetaRight` = command, `AltLeft` / `AltRight` = option,
`ControlLeft` = control, `Fn` = fn / globe. `TouchID` is the Touch ID (power) key at the top right.

## Custom layout

Set `layout="custom"` and give the rows in `custom` (`Partial<CustomLayout>`). Missing fields come
from `DEFAULT_CUSTOM_LAYOUT` (an ISO layout).

```ts
interface CustomLayout {
  kind: 'ISO' | 'ANSI';
  num: string; // number row, 13 keys
  q: string;   // Q row: 12 keys (ISO) or 13 keys (ANSI, the last is Backslash)
  a: string;   // A row: 12 keys (ISO, the last is Backslash) or 11 keys (ANSI)
  x: string;   // the key beside left shift, 1 key (ISO only)
  z: string;   // Z row, 10 keys
}
```

Rows split keys by spaces. The engine pads or cuts a row to the correct number of keys. Each key
token uses this syntax:

| Token | Result |
| --- | --- |
| `A` | One legend. |
| `!1` | Two legends: shifted (top) `!`, base (bottom) `1`. |
| `@2€` | A third and later characters are the option legend at the bottom right. |
| `E\|€` | `X\|Y` puts `Y` at the bottom right. |
| `Q¦Й` | A four-legend key: left column over right column (`AB¦CD` = A over B, C over D). |
| `·` | An empty slot. |

Characters are Unicode code points, so `ñ` and `ㅂ` are one character each.

```tsx
<MacKeyboard
  layout="custom"
  custom={{ kind: 'ANSI', q: 'Q W F P G J L U Y ; [ ] \\', a: 'A R S T D H N E I O \'', z: 'Z X C V B K M , . /' }}
/>
```
