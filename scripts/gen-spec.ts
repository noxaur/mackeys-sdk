// Writes the language-neutral spec: static data for native ports and golden fixtures that every port must match.
// Run: pnpm spec
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARROW_GLYPHS,
  BacklightOptions,
  DEFAULT_CUSTOM_LAYOUT,
  FINISHES,
  FKEY_GLYPHS,
  GLOBE_GLYPH,
  ICON_GLYPHS,
  JIS,
  KeyboardOptions,
  LAYOUTS,
  MODELS,
  MOD_GLYPHS,
  buildKeyboard,
  keyboardTheme,
  topCase,
  trackpad
} from '../packages/core/src/index';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = join(root, 'spec');
mkdirSync(join(spec, 'fixtures'), { recursive: true });
const write = (p: string, v: unknown, indent = 1) => writeFileSync(join(spec, p), JSON.stringify(v, null, indent) + '\n');

write('mackeys-data.json', {
  version: 1,
  unit: 64,
  rowPitch: 62.3,
  models: MODELS,
  finishes: FINISHES,
  layouts: LAYOUTS,
  defaultCustomLayout: DEFAULT_CUSTOM_LAYOUT,
  jis: JIS,
  glyphs: { fkeys: FKEY_GLYPHS, mods: MOD_GLYPHS, icons: ICON_GLYPHS, globe: GLOBE_GLYPH, arrows: ARROW_GLYPHS }
});

// One finish per model is enough for geometry: key geometry depends only on the model and the layout.
const MODEL_FINISHES = ['pro-space-black', 'air-midnight', 'neo-silver', 'imac-blue'];
const CUSTOM: { name: string; opts: KeyboardOptions }[] = [
  { name: 'custom-iso-default', opts: { layout: 'custom' } },
  { name: 'custom-ansi-short', opts: { layout: 'custom', custom: { kind: 'ANSI', num: '1 2 3', q: 'Q|@ W¦Ж ab', a: 'A', x: '', z: 'Z X' } } }
];
const keyboards: Record<string, unknown> = {};
for (const finish of MODEL_FINISHES) {
  for (const l of LAYOUTS) keyboards[finish + '/' + l.id] = { input: { finish, layout: l.id }, output: buildKeyboard({ finish, layout: l.id }) };
  for (const c of CUSTOM) keyboards[finish + '/' + c.name] = { input: { finish, ...c.opts }, output: buildKeyboard({ finish, ...c.opts }) };
}
write('fixtures/keyboards.json', keyboards, 0);

const BACKLIGHTS: { name: string; bl: BacklightOptions }[] = [
  { name: 'off', bl: {} },
  { name: 'on', bl: { on: true } },
  { name: 'dark-room-off', bl: { room: 'dark' } },
  { name: 'dark-room-full-warm', bl: { on: true, room: 'dark', level: 16, bleed: 1, color: '#fff4e3' } },
  { name: 'idle', bl: { on: true, idle: true } },
  { name: 'low-no-bleed', bl: { on: true, level: 3, bleed: 0, color: '#ffffff' } }
];
const themes: Record<string, unknown> = {};
const topcases: Record<string, unknown> = {};
for (const f of FINISHES) {
  for (const b of BACKLIGHTS) themes[f.id + '/' + b.name] = { input: { finish: f.id, backlight: b.bl }, output: keyboardTheme(f.id, b.bl) };
  const kb = buildKeyboard({ finish: f.id });
  for (const parts of ['full', 'keyboard'] as const)
    for (const b of [BACKLIGHTS[0], BACKLIGHTS[3]])
      topcases[f.id + '/' + parts + '/' + b.name] = { input: { finish: f.id, parts, backlight: b.bl }, output: topCase(f.id, kb, { parts, backlight: b.bl }) };
}
write('fixtures/themes.json', themes);
write('fixtures/topcases.json', topcases);
write('fixtures/trackpads.json', Object.fromEntries(FINISHES.map((f) => [f.id, { input: { finish: f.id }, output: trackpad(f.id) }])));

copyFileSync(join(spec, 'keyboard-clicks.json'), join(root, 'packages/core/assets/keyboard-clicks.json'));
copyFileSync(join(spec, 'trackpad-clicks.json'), join(root, 'packages/core/assets/trackpad-clicks.json'));
console.log('spec written:', Object.keys(keyboards).length, 'keyboards,', Object.keys(themes).length, 'themes,', Object.keys(topcases).length, 'top cases');
