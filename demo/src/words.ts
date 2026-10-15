import { KeyboardGeometry, LayoutId } from '@mackeys/react';

/** "Hello" in the language of each layout. Korean is written as jamo, one key per character. */
export const HELLO: Record<LayoutId | 'custom', string> = {
  'en-us': 'hello',
  'en-gb': 'hello',
  de: 'hallo',
  fr: 'bonjour',
  es: 'hola',
  'sv-fi': 'hej',
  no: 'hei',
  da: 'hej',
  it: 'ciao',
  ja: 'こんにちは',
  nl: 'hallo',
  'en-intl': 'hello',
  ch: 'grüezi',
  pt: 'olá',
  ru: 'привет',
  ko: 'ㅇㅏㄴㄴㅕㅇ',
  custom: 'hello'
};

export const HELLO_SHOWN: Partial<Record<LayoutId | 'custom', string>> = { ko: '안녕', custom: 'hello' };

/** Dvorak on an ANSI deck, as a custom layout. */
export const DVORAK = {
  kind: 'ANSI' as const,
  num: '~` !1 @2 #3 $4 %5 ^6 &7 *8 (9 )0 {[ }]',
  q: '"\' <, >. P Y F G C R L ?/ += |\\',
  a: 'A O E U I D H T N S _-',
  z: ':; Q J K X B M W V Z'
};

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Maps every legend character of a keyboard to its key id. */
export function charMap(g: KeyboardGeometry): Map<string, string> {
  const m = new Map<string, string>();
  const put = (c: string, id: string) => {
    if (!m.has(c)) m.set(c, id);
  };
  for (const k of g.keys) {
    // Base legends first, so a shifted symbol does not shadow a letter.
    const legends = [...k.legends].sort((a, b) => (a.slot === 'b' ? -1 : 0) - (b.slot === 'b' ? -1 : 0));
    for (const l of legends) for (const c of l.text) put(strip(c), k.id);
    if (k.id === 'Space') put(' ', k.id);
  }
  return m;
}

/** Key ids that type `word` on this keyboard. Characters with no key are skipped. */
export function keysFor(g: KeyboardGeometry, word: string): string[] {
  const m = charMap(g);
  const out: string[] = [];
  for (const c of word) {
    const id = m.get(strip(c));
    if (id) out.push(id);
  }
  return out;
}
