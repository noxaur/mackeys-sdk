import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyCap, KeyboardController, KeyboardGeometry, Keys, LAYOUT_IDS, UNIT, ROW_PITCH, buildKeyboard, keyboardTheme, injectStyles, themeVars } from '@mackeys/react';

// A field of single keys from every layout, matte and unlit, that covers the whole page.
// Only a soft circle around the pointer shows them. The key under the pointer presses and lights up.

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pool(): KeyCap[] {
  const out: KeyCap[] = [];
  for (const layout of LAYOUT_IDS) {
    const g = buildKeyboard({ finish: 'pro-space-black', layout });
    for (const k of g.keys) {
      const u = (k.w + g.gap) / UNIT;
      const oneUnit = u > 0.95 && u < 1.05 && k.h > g.capHeight * 0.9;
      if (!oneUnit) continue;
      if (k.kind === 'char' || k.kind === 'dual' || k.kind === 'quad' || k.kind === 'jis' || k.kind === 'fkey' || k.kind === 'fn' || k.kind === 'mod') out.push(k);
    }
  }
  return out;
}

const EMPTY = { down: new Set<string>(), caps: false, idle: false };

// The backlit look of a key, applied to one key at a time. Removing it fades the light out.
const LIT = themeVars(keyboardTheme('pro-space-black', { on: true, level: 16, room: 'dark' }), false);
const LIT_VARS = ['--mk-lc', '--mk-ls', '--mk-lk', '--mk-icf'] as const;

/** Visual only: these keys belong to no controller, so they make no sound. */
function keyAt(root: HTMLElement, r: number, c: number) {
  return root.querySelector<HTMLElement>(`[data-key="f${r}-${c}"]`);
}

export function KeyField() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    injectStyles();
    let t = 0;
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => {
      clearTimeout(t);
      t = window.setTimeout(measure, 150);
    };
    measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The keys never move. Only the circle that shows them follows the pointer, with a little lag.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let tx = window.innerWidth / 2, ty = window.innerHeight * 0.4;
    let x = tx, y = ty;
    let raf = 0;
    const step = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.setProperty('--fx', x.toFixed(1) + 'px');
      el.style.setProperty('--fy', y.toFixed(1) + 'px');
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(step) : 0;
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const off = new Map<HTMLElement, number>();
    const light = (k: HTMLElement, ms: number) => {
      for (const v of LIT_VARS) k.style.setProperty(v, LIT[v]);
      clearTimeout(off.get(k));
      off.set(k, window.setTimeout(() => LIT_VARS.forEach((v) => k.style.removeProperty(v)), ms));
    };
    const press = (k: HTMLElement, ms: number) => {
      k.classList.add('mk-dn');
      window.setTimeout(() => k.classList.remove('mk-dn'), ms);
    };
    const cell = (x: number, y: number) => [Math.floor((y + ROW_PITCH / 2) / ROW_PITCH), Math.floor((x + UNIT / 2) / UNIT)];
    let last = '';
    const move = (nx: number, ny: number) => {
      tx = nx;
      ty = ny;
      if (!raf) raf = requestAnimationFrame(step);
      if (reduce) return;
      const [r, c] = cell(nx, ny);
      if (r + ',' + c === last) return;
      last = r + ',' + c;
      const k = keyAt(el, r, c);
      if (!k) return;
      press(k, 120);
      light(k, 650);
    };
    // A click on the page presses the key under it and lights a ring around it.
    const down = (e: PointerEvent) => {
      if (reduce) return;
      const [r, c] = cell(e.clientX, e.clientY);
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const k = keyAt(el, r + dr, c + dc);
          if (!k) continue;
          const d = Math.max(Math.abs(dr), Math.abs(dc));
          window.setTimeout(() => {
            press(k, 140);
            light(k, 900 - d * 150);
          }, d * 70);
        }
    };
    step();
    const onMouse = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      off.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  const geometry = useMemo<KeyboardGeometry | null>(() => {
    if (!size.w) return null;
    const keys = pool();
    const rand = rng(1337 + size.w);
    const cols = Math.ceil(size.w / UNIT) + 1;
    const rows = Math.ceil(size.h / ROW_PITCH) + 1;
    const out: KeyCap[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = keys[Math.floor(rand() * keys.length)];
        out.push({ ...k, id: `f${r}-${c}`, x: c * UNIT - UNIT / 2, y: r * ROW_PITCH - ROW_PITCH / 2, homeBar: null, capsLed: null });
      }
    const base = buildKeyboard({ finish: 'pro-space-black' });
    return { ...base, width: cols * UNIT, height: rows * ROW_PITCH, keys: out };
  }, [size.w, size.h]);

  const controller = useMemo(() => new KeyboardController(), []);
  const theme = useMemo(() => keyboardTheme('pro-space-black', { on: false, room: 'daylight' }), []);
  return (
    <div ref={ref} className="field" aria-hidden="true" inert="">
      {geometry && <Keys geometry={geometry} theme={theme} state={EMPTY} controller={controller} focusKeys={false} />}
      <div className="field-fade" />
    </div>
  );
}
