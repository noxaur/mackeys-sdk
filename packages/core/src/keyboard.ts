// The keyboard layout engine. It turns a finish and a layout into key caps with absolute geometry:
// every legend, icon, LED and home bar has a resolved position, so a renderer only draws.
import {
  ARROW_GLYPHS,
  CustomLayout,
  DEFAULT_CUSTOM_LAYOUT,
  FKEY_GLYPHS,
  FinishId,
  GLOBE_GLYPH,
  Glyph,
  ICON_GLYPHS,
  JIS,
  LayoutId,
  LayoutSpec,
  MOD_GLYPHS,
  ModelId,
  getFinish,
  getLayout
} from './data';
import { Rect, fmt } from './util';

/** Key pitch across (19.0 mm) and down (18.5 mm) in px. */
export const UNIT = 64;
export const ROW_PITCH = 62.3;

/** `mb` = MacBook Pro and Air legend metrics, `mk` = MacBook Neo and Magic Keyboard. */
export type LegendStyle = 'mb' | 'mk';

export type KeyKind =
  | 'char'
  | 'dual'
  | 'quad'
  | 'jis'
  | 'word'
  | 'icon'
  | 'mod'
  | 'fn'
  | 'fkey'
  | 'touchid'
  | 'space'
  | 'arrow'
  | 'kana';

export type KeySound = 'key' | 'wide' | 'space';

export interface Legend {
  text: string;
  /** Font size in px. The line box is one font size high (line-height 1). */
  size: number;
  /** Letter spacing in em. */
  tracking: number;
  /** `center` centers the text across the key. `left` and `right` measure `inset` from that edge. */
  align: 'left' | 'center' | 'right';
  inset: number;
  /** Top of the line box, from the top of the key. */
  top: number;
  /** Which slot the legend came from: t = top, b = bottom, c = bottom right, d = top right. */
  slot: 't' | 'b' | 'c' | 'd';
}

export interface KeyIcon extends Rect {
  /** The glyph's viewBox, mapped into the rect with uniform scale ("meet"). */
  viewBox: [number, number, number, number];
  stroke: string;
  fill: string;
  /** Stroke width in viewBox units. */
  strokeWidth: number;
}

/** The outline of an L-shaped ISO or JIS return key, in key coordinates. */
export interface IsoShape {
  path: string;
  /** The top highlight line. */
  highlight: string;
}

export interface KeyCap {
  /** `KeyboardEvent.code` for the key, or `Fn` and `TouchID`. */
  id: string;
  /** Accessible name. */
  label: string;
  kind: KeyKind;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  sound: KeySound;
  legends: Legend[];
  icon: KeyIcon | null;
  iso: IsoShape | null;
  homeBar: Rect | null;
  /** The caps lock LED: top-left corner and diameter. */
  capsLed: { x: number; y: number; d: number } | null;
  touchId: { d: number } | null;
}

export interface KeyboardGeometry {
  finish: FinishId;
  layout: LayoutId | 'custom';
  model: ModelId;
  style: LegendStyle;
  /** Light key caps with dark legends (MacBook Neo, Magic Keyboard). */
  lightKeys: boolean;
  /** MacBook Pro and Air have a backlight; Neo and Magic Keyboard have none. */
  backlit: boolean;
  width: number;
  height: number;
  gap: number;
  capHeight: number;
  keys: KeyCap[];
}

export interface KeyboardOptions {
  finish?: FinishId | string;
  layout?: LayoutId | 'custom' | string;
  custom?: Partial<CustomLayout>;
}

interface Metrics {
  ws: number;
  wb: number;
  dt: number;
  db: number;
  fb: number;
  cx: number;
  cy: number;
  fnr: number;
  symTop: number;
  symSide: number;
  side: number;
  icB: number;
  fIcon: number;
  globe: { left: number; bottom: number };
}

interface StyleSpec {
  mb: boolean;
  words: boolean;
  inner: boolean;
  fn: 'top' | 'pair' | 'globe';
  lrFull: boolean;
}

// Legend style per model, from Apple's images: Pro aligns modifier legends toward the space bar and prints
// fn top-right; Air, Neo and Magic Keyboard align them to the outer edge. Neo and Magic Keyboard print icons.
const STYLES: Record<ModelId, StyleSpec> = {
  pro: { mb: true, words: true, inner: true, fn: 'top', lrFull: false },
  air: { mb: true, words: true, inner: false, fn: 'pair', lrFull: false },
  neo: { mb: false, words: false, inner: false, fn: 'pair', lrFull: false },
  mk: { mb: false, words: false, inner: false, fn: 'globe', lrFull: true }
};

function metrics(model: ModelId): Metrics {
  const st = STYLES[model];
  if (st.mb)
    return { ws: 9.6, wb: 7.15, dt: 8.1, db: 7.9, fb: 8.6, cx: 10.8, cy: 11.1, fnr: 9.3, symTop: 8.7, symSide: 9.3, side: 9.6, icB: 9.0, fIcon: 19.6, globe: st.fn === 'top' ? { left: 10.6, bottom: 8.6 } : { left: 9.6, bottom: 8.4 } };
  if (model === 'mk')
    return { ws: 10.1, wb: 7.9, dt: 9.7, db: 6.7, fb: 8.8, cx: 10, cy: 10.6, fnr: 9.6, symTop: 10.3, symSide: 10, side: 9.8, icB: 9.2, fIcon: 19.3, globe: { left: 11, bottom: 10.5 } };
  return { ws: 10.9, wb: 8, dt: 9.8, db: 7.8, fb: 8.5, cx: 11, cy: 11, fnr: 9.7, symTop: 10.3, symSide: 11, side: 11, icB: 9.6, fIcon: 20.6, globe: { left: 11, bottom: 9.6 } };
}

/** Splits a string into code points, so that every port counts characters the same way. */
const chars = (s: string) => Array.from(s);

// One key before placement: legends by slot, CSS-like class tags, and an optional icon recipe.
interface Proto {
  u?: number;
  tags: string[];
  kind: KeyKind;
  t?: string;
  b?: string;
  c?: string;
  d?: string;
  label: string;
  code?: string;
  home?: boolean;
  touchId?: boolean;
  icon?: IconRecipe;
}

type IconRecipe = (w: number, h: number) => KeyIcon;

const iconFrom = (g: Glyph, x: number, y: number, w = g.w, h = g.h): KeyIcon => ({
  x,
  y,
  w,
  h,
  viewBox: g.viewBox,
  stroke: g.stroke,
  fill: g.fill,
  strokeWidth: g.strokeWidth
});

/** Parses one legend token. See {@link LayoutSpec} for the syntax. */
export function parseToken(s: string): Proto {
  const cs = chars(s);
  const sep = cs.indexOf('¦');
  if (sep > 0) {
    const lc = cs.slice(0, sep).map((ch) => (ch === '·' ? '' : ch));
    const rc = cs.slice(sep + 1).map((ch) => (ch === '·' ? '' : ch));
    const tl = lc.length > 1 ? lc[0] : lc[0] || '';
    const bl = lc.length > 1 ? lc[1] : '';
    const tr = rc.length > 1 ? rc[0] : '';
    const br = rc.length > 1 ? rc[1] : rc[0] || '';
    const big = /\p{L}/u.test(tl + bl + tr + br);
    const lat = [tl, bl, tr, br].find((ch) => /^[A-Z]$/.test(ch)) || '';
    return { tags: big ? ['quad', 'qbig'] : ['quad'], kind: 'quad', t: tl, b: bl, d: tr, c: br, label: [tl, bl, tr, br].filter(Boolean).join(' '), home: lat === 'F' || lat === 'J' };
  }
  if (cs.length === 1 || cs[1] === '|') return { tags: ['char'], kind: 'char', t: cs[0] || '', c: cs.slice(2).join(''), label: cs[0] || 'blank', home: s === 'F' || s === 'J' };
  return { tags: '{}|'.includes(cs[0]) ? ['dual', 'brk'] : ['dual'], kind: 'dual', t: cs[0], b: cs[1], c: cs.slice(2).join(''), label: cs[1] + ' ' + cs[0] };
}

const fit = (str: string, n: number) => {
  const a = String(str || '').trim().split(/\s+/).filter(Boolean);
  while (a.length < n) a.push('·');
  return a.slice(0, n).join(' ');
};

function resolveLayout(layout: string, custom?: Partial<CustomLayout>): LayoutSpec & { custom?: boolean } {
  if (layout === 'custom' || layout === 'Custom') {
    const c = { ...DEFAULT_CUSTOM_LAYOUT, ...(custom || {}) };
    const iso = c.kind !== 'ANSI';
    return {
      id: 'en-us',
      name: 'Custom',
      custom: true,
      iso,
      en: false,
      num: fit(c.num, 13),
      q: fit(c.q, iso ? 12 : 13),
      a: fit(c.a, iso ? 12 : 11),
      x: fit(c.x, 1),
      z: fit(c.z, 10)
    };
  }
  return getLayout(layout);
}

/** Builds the full key geometry for one finish and layout. */
export function buildKeyboard(opts: KeyboardOptions = {}): KeyboardGeometry {
  const f = getFinish(opts.finish ?? 'pro-space-black');
  const L = resolveLayout(opts.layout ?? 'en-us', opts.custom);
  const model = f.model;
  const ST = STYLES[model];
  const LM = metrics(model);
  const style: LegendStyle = ST.mb ? 'mb' : 'mk';
  const mb = style === 'mb';
  const lightKeys = model === 'neo' || model === 'mk';

  const U = UNIT, V = ROW_PITCH;
  const G = ST.mb ? 7 : model === 'mk' ? 8.6 : 7.3;
  const KH = ST.mb ? 55.4 : model === 'mk' ? 53.8 : 55.2;
  const kw = (u: number) => u * U - G;
  const keys: KeyCap[] = [];
  const en = L.en && ST.words;

  // ---- Legend placement: the cascade of the canvas's CSS, resolved to numbers. ----
  const place = (tags: string[], slot: Legend['slot'], text: string, w: number, h: number): Legend | null => {
    if (!text) return null;
    const has = (t: string) => tags.includes(t);
    const L0 = (size: number, align: Legend['align'], inset: number, top: number, tracking = 0): Legend => ({ text, size, tracking, align, inset, top, slot });
    const bottom = (size: number, align: Legend['align'], inset: number, b: number, tracking = 0) => L0(size, align, inset, h - b - size, tracking);
    if (slot === 't') {
      if (has('jisL')) return L0(16, 'left', 10, h / 2 - 10);
      if (has('jis')) return L0(10.5, 'center', 0, 7);
      if (has('quad')) return L0(has('qbig') ? 15 : 12, 'left', 9, 8);
      if (has('fnt')) return L0(12.2, 'right', 9.2, 7.25);
      if (has('brk')) return L0(mb ? 15.5 : 13.6, 'center', 0, mb ? 7.5 : 8.4);
      if (has('dual')) return L0(mb ? 14.4 : 12.6, 'center', 0, LM.dt);
      if (has('char')) return L0(mb ? 18.4 : 17.6, 'center', 0, mb ? 18.7 : 18.8);
      return L0(12, 'left', 0, 0);
    }
    if (slot === 'b') {
      if (has('jis')) return L0(16, 'left', 10, h / 2 - 8);
      if (has('quad')) return bottom(has('qbig') ? 15 : 13.5, 'left', 9, 8);
      if (has('cent')) return L0(12.5, 'center', 0, h / 2 - 6.5);
      if (has('fkey')) return bottom(mb ? 7.6 : 7.5, 'center', 0, LM.fb, 0.02);
      if (has('wl') || has('wr') || has('fnb')) {
        const size = mb ? 12.2 : 11.2, tr = mb ? 0.005 : 0.02;
        if (has('fnb')) return bottom(size, 'right', LM.fnr, LM.wb, tr);
        return bottom(size, has('wl') ? 'left' : 'right', LM.ws, LM.wb, tr);
      }
      if (has('brk')) return bottom(mb ? 16 : 14.6, 'center', 0, mb ? 8.4 : 7.4);
      if (has('dual')) return bottom(mb ? 17.8 : 17.6, 'center', 0, LM.db);
      return L0(12, 'left', 0, 0);
    }
    if (slot === 'c') {
      if (has('jis')) return bottom(10.5, 'center', 0, 7);
      if (has('quad')) return bottom(has('qbig') ? 15 : 13.5, 'right', 9, 8);
      if (has('dual')) return bottom(10.5, 'right', 9, 11);
      return bottom(10.5, 'right', 9, 9);
    }
    if (has('jis')) return L0(9.5, 'right', 9, h / 2 - 5);
    return L0(has('qbig') ? 15 : 12, 'right', 9, 8);
  };

  const add = (p: Proto, x: number, y: number, w: number, h: number, row: number, extra?: Partial<KeyCap>) => {
    const tags = p.tags;
    const legends = (['t', 'b', 'c', 'd'] as const).map((slot) => place(tags, slot, (p as any)[slot] || '', w, h)).filter((l): l is Legend => !!l);
    let homeBar: Rect | null = null;
    if (p.home) {
      if (tags.includes('jis')) homeBar = { x: w * 0.55 - 3, y: h / 2 - 1, w: 6, h: 1.6 };
      else if (tags.includes('quad')) homeBar = { x: w / 2 - 4.5, y: h / 2 - 1, w: 9, h: 1.6 };
      else homeBar = { x: w / 2 - 5.4, y: 43.3, w: 10.8, h: 1.6 };
    }
    let capsLed = null;
    if (tags.includes('caps')) capsLed = { x: LM.cx, y: tags.includes('capsj') ? h / 2 - 1.9 : LM.cy, d: 3.8 };
    const id = p.code || (p.touchId ? 'TouchID' : 'k' + keys.length);
    const k: KeyCap = {
      id,
      label: p.label,
      kind: p.kind,
      row,
      x,
      y,
      w,
      h,
      radius: p.kind === 'arrow' ? 4 : 5,
      sound: tags.includes('space') ? 'space' : w > 1.4 * U ? 'wide' : 'key',
      legends,
      icon: p.icon ? p.icon(w, h) : null,
      iso: null,
      homeBar,
      capsLed,
      touchId: p.touchId ? { d: model === 'neo' ? 34.4 : lightKeys ? 33.2 : 33.3 } : null,
      ...extra
    };
    keys.push(k);
    return k;
  };

  const row = (r: number, items: Proto[], codes?: string[]) => {
    let x = 0;
    items.forEach((it, i) => {
      const u = it.u ?? 1;
      const code = (codes && codes[i]) || it.code || '';
      add({ ...it, code }, x, r * V, kw(u), KH, r);
      x += u * U;
    });
    return x;
  };

  const iconAt = (name: keyof typeof ICON_GLYPHS, side: 'l' | 'r', top?: number): IconRecipe => (w, h) => {
    const g = ICON_GLYPHS[name];
    const x = side === 'l' ? LM.side : w - LM.side - g.w;
    const y = top !== undefined ? top : h - LM.icB - g.h;
    return iconFrom(g, x, y);
  };
  const word = (u: number, side: 'l' | 'r', enWord: string, icName: keyof typeof ICON_GLYPHS, label: string, extra: string[] = []): Proto => {
    if (en) return { u, tags: [side === 'l' ? 'wl' : 'wr', ...extra], kind: 'word', b: enWord, label };
    if (icName === 'caps' && L.caps) return { u, tags: ['wl', ...extra], kind: 'word', b: L.caps, label };
    return { u, tags: extra, kind: 'icon', label, icon: iconAt(icName, side) };
  };
  const modKey = (kind: 'ctrl' | 'opt' | 'cmd', side: 'l' | 'r', word: string, label: string, u = 1): Proto => {
    const g = MOD_GLYPHS[kind];
    const symRight = (side === 'l') === ST.inner;
    return {
      u,
      tags: [symRight ? 'wr' : 'wl'],
      kind: 'mod',
      b: word,
      label,
      icon: (w) => iconFrom(g, symRight ? w - LM.symSide - g.w : LM.symSide, LM.symTop)
    };
  };
  const globe: IconRecipe = (_w, h) => iconFrom(GLOBE_GLYPH, LM.globe.left, h - LM.globe.bottom - GLOBE_GLYPH.h);
  const lshape = (w: number, h: number, topW: number, botW: number, j: number): IsoShape => {
    const e = 0.5, r = 5, R = 5, xT = w - topW + e, xB = w - botW + e, rt = w - e, tp = e, bt = h - e;
    const n = fmt;
    let d = 'M' + n(xT + r) + ' ' + n(tp) + 'H' + n(rt - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(rt) + ' ' + n(tp + r) + 'V' + n(bt - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(rt - r) + ' ' + n(bt) + 'H' + n(xB + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(xB) + ' ' + n(bt - r);
    if (xB > xT) d += 'V' + n(j + R) + 'A' + R + ' ' + R + ' 0 0 0 ' + n(xB - R) + ' ' + n(j) + 'H' + n(xT + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(xT) + ' ' + n(j - r);
    else d += 'V' + n(j + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(xB + r) + ' ' + n(j) + 'H' + n(xT - R) + 'A' + R + ' ' + R + ' 0 0 0 ' + n(xT) + ' ' + n(j - R);
    d += 'V' + n(tp + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n(xT + r) + ' ' + n(tp) + 'Z';
    return { path: d, highlight: 'M' + n(xT + 3) + ' 1.4H' + n(rt - 3) };
  };
  const seq = (a: number, n: number) => Array.from({ length: n }, (_, i) => a + i);
  const LET = (s: string) => s.split('').map((c) => 'Key' + c);
  const DIG = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
  const toks = (s: string | undefined) => (s || '').split(' ').map(parseToken);

  // Row 0: escape, F1 to F12, Touch ID.
  const frow: Proto[] = [{ u: 1.5, tags: ['wl'], kind: 'word', b: 'esc', label: 'escape' }];
  FKEY_GLYPHS.forEach((g, i) => {
    const w = g.drawW!, h = g.drawH!;
    frow.push({ tags: ['fkey'], kind: 'fkey', b: 'F' + (i + 1), label: 'F' + (i + 1) + ', ' + g.name, icon: (kwid) => iconFrom(g, kwid / 2 - w / 2, LM.fIcon - h / 2, w, h) });
  });
  frow.push({ tags: ['touch'], kind: 'touchid', label: 'Touch ID', touchId: true });
  row(0, frow, ['Escape'].concat(seq(1, 12).map((n) => 'F' + n)));

  if (L.jis) {
    const J = (arr: readonly (readonly (string | number)[])[]): Proto[] =>
      arr.map((a) => ({ u: (a[4] as number) || 1, tags: ['jis'], kind: 'jis', t: a[0] as string, b: a[1] as string, c: a[2] as string, d: (a[3] as string) || '', label: ((a[1] as string) || (a[0] as string)) + ' ' + a[2] }));
    const JL = (arr: readonly (readonly string[])[]): Proto[] =>
      arr.map((a) => ({ tags: ['jis', 'jisL'], kind: 'jis', t: a[0], c: a[1], d: a[2] || '', label: a[0] + ' ' + a[1], home: a[0] === 'F' || a[0] === 'J' }));
    row(1, J(JIS.num).concat([word(1.25, 'r', 'delete', 'del', 'delete')]), DIG.concat(['Minus', 'Equal', 'IntlYen', 'Backspace']));
    row(2, [word(1, 'l', 'tab', 'tab', 'tab')].concat(JL(JIS.qLetters), J(JIS.qSymbols)), ['Tab'].concat(LET('QWERTYUIOP'), ['BracketLeft', 'BracketRight']));
    const ret = word(1.5, 'r', 'return', 'ret', 'return');
    const k = add({ ...ret, code: 'Enter', tags: [...ret.tags, 'iso'] }, 13 * U, 2 * V, kw(1.5), KH + V, 2);
    k.iso = lshape(kw(1.5), KH + V, kw(1.5), kw(1.25), KH);
    row(3, [modKey('ctrl', 'l', 'control', 'control', 1.25)].concat(JL(JIS.aLetters), J(JIS.aSymbols)), ['ControlLeft'].concat(LET('ASDFGHJKL'), ['Semicolon', 'Quote', 'Backslash']));
    row(4, [word(1.75, 'l', 'shift', 'shift', 'shift')].concat(JL(JIS.zLetters), J(JIS.zSymbols), [word(1.75, 'r', 'shift', 'shift', 'right shift')]), ['ShiftLeft'].concat(LET('ZXCVBNM'), ['Comma', 'Period', 'Slash', 'IntlRo', 'ShiftRight']));
  } else if (!L.iso) {
    row(1, toks(L.num).concat([word(1.5, 'r', 'delete', 'del', 'delete')]), ['Backquote'].concat(DIG, ['Minus', 'Equal', 'Backspace']));
    row(2, [word(1.5, 'l', 'tab', 'tab', 'tab')].concat(toks(L.q)), ['Tab'].concat(LET('QWERTYUIOP'), ['BracketLeft', 'BracketRight', 'Backslash']));
    row(3, [word(1.75, 'l', 'caps lock', 'caps', 'caps lock', ['caps'])].concat(toks(L.a), [word(1.75, 'r', 'return', 'ret', 'return')]), ['CapsLock'].concat(LET('ASDFGHJKL'), ['Semicolon', 'Quote', 'Enter']));
    row(4, [word(2.25, 'l', 'shift', 'shift', 'shift')].concat(toks(L.z), [word(2.25, 'r', 'shift', 'shift', 'right shift')]), ['ShiftLeft'].concat(LET('ZXCVBNM'), ['Comma', 'Period', 'Slash', 'ShiftRight']));
  } else {
    row(1, toks(L.num).concat([word(1.5, 'r', 'delete', 'del', 'delete')]), ['IntlBackslash'].concat(DIG, ['Minus', 'Equal', 'Backspace']));
    const x = row(2, [word(1.25, 'l', 'tab', 'tab', 'tab')].concat(toks(L.q)), ['Tab'].concat(LET('QWERTYUIOP'), ['BracketLeft', 'BracketRight']));
    const ret = word(1.25, 'r', 'return', 'ret', 'return');
    const k = add({ ...ret, code: 'Enter', tags: [...ret.tags, 'iso'] }, x, 2 * V, kw(1.25), KH + V, 2);
    k.iso = lshape(kw(1.25), KH + V, kw(1.25), kw(1), KH);
    row(3, [word(1.5, 'l', 'caps lock', 'caps', 'caps lock', ['caps'])].concat(toks(L.a)), ['CapsLock'].concat(LET('ASDFGHJKL'), ['Semicolon', 'Quote', 'Backslash']));
    row(4, [word(1.25, 'l', 'shift', 'shift', 'shift')].concat(toks(L.x), toks(L.z), [word(2.25, 'r', 'shift', 'shift', 'right shift')]), ['ShiftLeft', 'Backquote'].concat(LET('ZXCVBNM'), ['Comma', 'Period', 'Slash', 'ShiftRight']));
  }

  const fnKey: Proto =
    ST.fn === 'top'
      ? { tags: ['fnt'], kind: 'fn', t: 'fn', label: 'fn, globe', code: 'Fn', icon: globe }
      : ST.fn === 'pair'
        ? { tags: ['fnb'], kind: 'fn', b: 'fn', label: 'fn, globe', code: 'Fn', icon: globe }
        : { tags: [], kind: 'fn', label: 'globe', code: 'Fn', icon: globe };
  const ax = L.jis
    ? row(5, [
        { tags: ['caps', 'capsj'], kind: 'icon', label: 'caps lock', icon: (w, h) => ({ ...iconAt('caps', 'l', 21)(w, h), x: 20 }) },
        modKey('opt', 'l', 'option', 'option'),
        modKey('cmd', 'l', 'command', 'command', 1.25),
        { u: 1.25, tags: ['cent'], kind: 'kana', b: '英数', label: 'eisu' },
        { u: 3.5, tags: ['space'], kind: 'space', label: 'space' },
        { u: 1.25, tags: ['cent'], kind: 'kana', b: 'かな', label: 'kana' },
        modKey('cmd', 'r', 'command', 'right command', 1.25),
        fnKey
      ], ['CapsLock', 'AltLeft', 'MetaLeft', 'Lang2', 'Space', 'Lang1', 'MetaRight', 'Fn'])
    : row(5, [
        fnKey,
        modKey('ctrl', 'l', 'control', 'control'),
        modKey('opt', 'l', 'option', 'option'),
        modKey('cmd', 'l', 'command', 'command', 1.25),
        { u: 5, tags: ['space'], kind: 'space', label: 'space' },
        modKey('cmd', 'r', 'command', 'right command', 1.25),
        modKey('opt', 'r', 'option', 'right option')
      ], ['Fn', 'ControlLeft', 'AltLeft', 'MetaLeft', 'Space', 'MetaRight', 'AltRight']);

  // Inverted T. Up and down share one cap height with a hairline between them; Magic Keyboard has full-height left and right.
  const ah = (KH - 1.6) / 2, y5 = 5 * V;
  const arrow = (x: number, y: number, h: number, dir: keyof typeof ARROW_GLYPHS, code: string) => {
    const g = ARROW_GLYPHS[dir];
    add({ tags: ['arrow'], kind: 'arrow', label: dir + ' arrow', code, icon: (w, hh) => iconFrom(g, w / 2 - g.w / 2, hh / 2 - g.h / 2) }, x, y, kw(1), h, 5);
  };
  arrow(ax, ST.lrFull ? y5 : y5 + ah + 1.6, ST.lrFull ? KH : ah, 'left', 'ArrowLeft');
  arrow(ax + U, y5, ah, 'up', 'ArrowUp');
  arrow(ax + U, y5 + ah + 1.6, ah, 'down', 'ArrowDown');
  arrow(ax + 2 * U, ST.lrFull ? y5 : y5 + ah + 1.6, ST.lrFull ? KH : ah, 'right', 'ArrowRight');

  return {
    finish: f.id,
    layout: (L as any).custom ? 'custom' : L.id,
    model,
    style,
    lightKeys,
    backlit: !lightKeys,
    width: 14.5 * U - G,
    height: 5 * V + KH,
    gap: G,
    capHeight: KH,
    keys
  };
}
