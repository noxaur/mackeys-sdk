/** Formats a number for path strings: at most 4 decimals, no trailing zeros. Every port uses the same rule. */
export function fmt(n: number): string {
  const r = Math.round(n * 10000) / 10000;
  if (Object.is(r, -0) || r === 0) return '0';
  let s = r.toFixed(4);
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/** A color as `#rrggbbaa`. Every color the core returns uses this form. */
export type Color = string;

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const h2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

export function rgba(r: number, g: number, b: number, a = 1): Color {
  return '#' + h2(r) + h2(g) + h2(b) + h2(a * 255);
}

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()` and `transparent`. */
export function parseColor(css: string): RGBA {
  const s = css.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.substr(i, 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length >= 8 ? n(6) / 255 : 1 };
  }
  const m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  throw new Error('Unsupported color: ' + css);
}

/** Normalizes any supported CSS color to `#rrggbbaa`. */
export function color(css: string): Color {
  const c = parseColor(css);
  return rgba(c.r, c.g, c.b, c.a);
}

/** Converts a `#rrggbbaa` color to a CSS color string. */
export function cssColor(c: Color): string {
  const p = parseColor(c);
  if (p.a >= 1) return '#' + c.slice(1, 7);
  return 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + +p.a.toFixed(3) + ')';
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: Color;
  inset: boolean;
}

export function shadow(x: number, y: number, blur: number, spread: number, c: string, inset = false): Shadow {
  return { x, y, blur, spread, color: color(c), inset };
}

export function cssShadows(list: Shadow[]): string {
  if (!list.length) return 'none';
  return list
    .map((s) => (s.inset ? 'inset ' : '') + s.x + 'px ' + s.y + 'px ' + s.blur + 'px ' + (s.spread ? s.spread + 'px ' : '') + cssColor(s.color))
    .join(', ');
}

/** A vertical (top to bottom) linear gradient. */
export interface Gradient {
  stops: { color: Color; at: number }[];
}

export function grad2(a: [string, string]): Gradient {
  return { stops: [{ color: color(a[0]), at: 0 }, { color: color(a[1]), at: 1 }] };
}

export function cssGradient(g: Gradient, angle = 180): string {
  return 'linear-gradient(' + angle + 'deg, ' + g.stops.map((s) => cssColor(s.color) + ' ' + +(s.at * 100).toFixed(3) + '%').join(', ') + ')';
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
