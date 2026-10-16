import { KeyboardGeometry, LayoutId } from '@mackeys/react';

/** "Hello, nice to meet you" in the language of each layout. Korean is written as jamo, one key per character. */
export const PHRASE: Record<LayoutId | 'custom', string> = {
  'en-us': 'hello, nice to meet you',
  'en-gb': 'hello, lovely to meet you',
  de: 'hallo, schön dich kennenzulernen',
  fr: 'bonjour, ravi de te rencontrer',
  es: 'hola, encantado de conocerte',
  'sv-fi': 'hej, trevligt att träffas',
  no: 'hei, hyggelig å møte deg',
  da: 'hej, rart at møde dig',
  it: 'ciao, piacere di conoscerti',
  ja: 'こんにちは、はしめまして',
  nl: 'hallo, leuk je te ontmoeten',
  'en-intl': 'hello, nice to meet you',
  ch: 'grüezi, freut mi sehr',
  pt: 'olá, muito prazer',
  ru: 'привет, рад знакомству',
  ko: 'ㅇㅏㄴㄴㅕㅇㅎㅏㅅㅔㅇㅛ, ㅂㅏㄴㄱㅏㅂㅅㅡㅂㄴㅣㄷㅏ',
  custom: 'hello, nice to meet you'
};

/** The phrase as people read it, where it is not the same as the keys typed. */
export const PHRASE_SHOWN: Partial<Record<LayoutId | 'custom', string>> = { ja: 'こんにちは、はじめまして', ko: '안녕하세요, 반갑습니다' };

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
    // Word legends like "esc" or "tab" are names, not letters.
    for (const l of legends) if ([...l.text].length === 1) put(strip(l.text), k.id);
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
