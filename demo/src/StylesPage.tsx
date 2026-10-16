import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BacklightOptions,
  FINISHES,
  FinishId,
  KeyboardController,
  LAYOUTS,
  LayoutId,
  buildKeyboard,
  getFinish,
  isEditableTarget,
  parseColor,
  topCase
} from '@mackeys/react';
import { Device } from './Device';
import { Footer } from './Footer';
import { KeyField } from './KeyField';
import { Nav } from './Nav';
import { DECK_W, KIND, PRESETS, Preset, hasLight } from './styleList';
import { SoundContext, click } from './sound';
import { useFit } from './fit';
import './styles-page.css';

const SOUND = { on: true, setOn: () => {} };

/** Natural height of the tallest keyboard deck, in px. */
const DECK_H = topCase('pro-space-black', buildKeyboard({ finish: 'pro-space-black' }), { parts: 'keyboard' }).height + 10;

interface Light {
  on: boolean;
  level: number;
  room: 'daylight' | 'dark';
  color: string;
  bleed?: number;
}

interface Mix {
  base: FinishId;
  keys: string;
  letters: string;
}

const LIGHT: Light = { on: false, level: 12, room: 'daylight', color: '#f2f5ff' };
const MIX: Mix = { base: 'pro-space-black', keys: '#2b2d42', letters: '#f4d35e' };
const MIX_ID = 'mix';

/** `#rrggbb` from any CSS color. */
const hex = (c: string) => {
  try {
    const p = parseColor(c);
    return '#' + [p.r, p.g, p.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  } catch {
    return c;
  }
};

/** Mixes a hex color toward black (k < 0) or white (k > 0). */
const shade = (c: string, k: number) => {
  const p = parseColor(c);
  const t = k < 0 ? 0 : 255;
  const a = Math.abs(k);
  return hex(`rgb(${p.r + (t - p.r) * a}, ${p.g + (t - p.g) * a}, ${p.b + (t - p.b) * a})`);
};

/** Your mix: one color for the keys and one for the letters. The page makes the rest from them. */
function mixPreset(m: Mix): Preset {
  return {
    id: MIX_ID,
    name: 'Your mix',
    kind: 'Make your own',
    finish: m.base,
    theme: {
      face1: m.keys + 'ff',
      face0: shade(m.keys, -0.28) + 'ff',
      outline: m.letters + '33',
      highlight: shade(m.keys, 0.5) + '40',
      legend: m.letters + 'ff',
      homeBar: m.letters + '99',
      capsLedOn: m.letters + 'ff',
      capsLedOff: m.letters + '40'
    }
  };
}

/** The style, layout and light come from the address, so you can share a link to one look. */
function readUrl() {
  const q = new URLSearchParams(location.search);
  const id = q.get('style') ?? PRESETS[0].id;
  const layout = (LAYOUTS.find((l) => l.id === q.get('layout'))?.id ?? 'en-us') as LayoutId;
  const preset = PRESETS.find((p) => p.id === id);
  const light: Light = { ...LIGHT, ...(preset?.backlight as Partial<Light>) };
  const lv = q.get('light');
  if (lv !== null) {
    light.on = lv !== 'off';
    if (light.on && Number.isFinite(+lv)) light.level = Math.max(0, Math.min(16, Math.round(+lv)));
  }
  if (q.get('room') === 'dark') light.room = 'dark';
  if (q.get('room') === 'day') light.room = 'daylight';
  if (/^[0-9a-f]{6}$/i.test(q.get('glow') ?? '')) light.color = '#' + q.get('glow');
  const mix: Mix = { ...MIX };
  if (FINISHES.some((f) => f.id === q.get('case'))) mix.base = q.get('case') as FinishId;
  if (/^[0-9a-f]{6}$/i.test(q.get('keys') ?? '')) mix.keys = '#' + q.get('keys');
  if (/^[0-9a-f]{6}$/i.test(q.get('letters') ?? '')) mix.letters = '#' + q.get('letters');
  return { id: preset || id === MIX_ID ? id : PRESETS[0].id, layout, light, mix };
}

function writeUrl(id: string, layout: LayoutId, light: Light, mix: Mix) {
  const q = new URLSearchParams();
  q.set('style', id);
  if (layout !== 'en-us') q.set('layout', layout);
  q.set('light', light.on ? String(light.level) : 'off');
  if (light.on) {
    q.set('room', light.room === 'dark' ? 'dark' : 'day');
    if (light.color !== LIGHT.color) q.set('glow', light.color.slice(1));
  }
  if (id === MIX_ID) {
    q.set('case', mix.base);
    q.set('keys', mix.keys.slice(1));
    q.set('letters', mix.letters.slice(1));
  }
  history.replaceState(null, '', '/styles?' + q.toString());
}

/** The one line of React that draws this keyboard. */
function snippet(p: Preset, layout: LayoutId, light: Light) {
  const a = [`finish="${p.finish}"`];
  if (layout !== 'en-us') a.push(`layout="${layout}"`);
  if (light.on && hasLight(p.finish)) {
    const b = ['on: true'];
    if (light.level !== 12) b.push(`level: ${light.level}`);
    if (light.room === 'dark') b.push(`room: 'dark'`);
    if (light.color !== LIGHT.color) b.push(`color: '${light.color}'`);
    if (light.bleed !== undefined && light.bleed !== 0.5) b.push(`bleed: ${light.bleed}`);
    a.push(`backlight={{ ${b.join(', ')} }}`);
  }
  return `<MacKeyboard ${a.join(' ')} />`;
}

/** Copies text, and shows "Copied" on the button for a moment. */
function useCopy() {
  const [done, setDone] = useState('');
  const timer = useRef(0);
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setDone(key);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(''), 1400);
  }, []);
  return [done, copy] as const;
}

const GROUPS = [...new Set(PRESETS.map((p) => p.kind))];

export function StylesPage() {
  const init = useMemo(readUrl, []);
  const [id, setId] = useState(init.id);
  const [layout, setLayout] = useState<LayoutId>(init.layout);
  const [light, setLight] = useState<Light>(init.light);
  const [mix, setMix] = useState<Mix>(init.mix);
  const [done, copy] = useCopy();
  const kbd = useRef<KeyboardController>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [fitRef, scale] = useFit(DECK_W, 1, 0.2, DECK_H, 330);

  const mixed = useMemo(() => mixPreset(mix), [mix]);
  const all = useMemo(() => [...PRESETS, mixed], [mixed]);
  const index = Math.max(0, all.findIndex((p) => p.id === id));
  const p = all[index];
  const lit = hasLight(p.finish);
  const backlight: BacklightOptions = { on: light.on, level: light.level, room: light.room, color: light.color, bleed: light.bleed };

  useEffect(() => writeUrl(id, layout, light, mix), [id, layout, light, mix]);
  useEffect(() => {
    document.title = `${p.name}, ${p.kind} · MacKeys styles`;
  }, [p]);

  const pick = useCallback(
    (next: Preset, scroll = false) => {
      setId(next.id);
      // A style with its own light brings that light. Leave it, and the light goes back to off.
      if (next.backlight) setLight({ ...LIGHT, ...(next.backlight as Partial<Light>) });
      else if (p.backlight) setLight(LIGHT);
      if (scroll && stage.current) {
        const r = stage.current.getBoundingClientRect();
        if (r.top < 0 || r.top > innerHeight * 0.4) window.scrollTo({ top: scrollY + r.top - 88, behavior: 'smooth' });
      }
    },
    [p]
  );
  const step = useCallback((d: number) => pick(all[(index + d + all.length) % all.length]), [all, index, pick]);

  // Keys you type play on the big keyboard. Left and right arrows also change the style.
  // Enter and space on a button stay with the button, and text fields keep their keys.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const el = e.target as HTMLElement;
      const control = el.closest?.('button, a, summary');
      if (control && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) return;
      if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !e.repeat) step(e.code === 'ArrowLeft' ? -1 : 1);
      if (kbd.current?.handleKeyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => kbd.current?.handleKeyUp(e);
    const blur = () => kbd.current?.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [step]);

  const code = snippet(p, layout, light);

  return (
    <SoundContext.Provider value={SOUND}>
      <KeyField />
      <div className="page">
        <Nav />
        <main className="sp">
          <div className="wrap sp-panel" ref={stage}>
            <div className="sp-name">
              <button type="button" className="cap sp-arrow" aria-label="Previous style" onClick={() => (click('mod'), step(-1))}>
                ←
              </button>
              <div className="sp-title" aria-live="polite">
                <h1 key={p.id}>{p.name}</h1>
              </div>
              <button type="button" className="cap sp-arrow" aria-label="Next style" onClick={() => (click('mod'), step(1))}>
                →
              </button>
            </div>

            <div className="sp-row">
              <label className="cap sp-select">
                <span className="sr">Layout</span>
                <select value={layout} onChange={(e) => (click('mod'), setLayout(e.target.value as LayoutId))}>
                  {LAYOUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>

              {lit && (
                <div className={'cap sp-lightcap' + (light.on ? ' on' : '')}>
                  <button type="button" className="sp-lightbtn" aria-pressed={light.on} onClick={() => (click('mod'), setLight(light.on ? { ...light, on: false } : { ...light, on: true, room: 'dark' }))}>
                    <span className="dot" /> Light
                  </button>
                  {/* Sixteen steps, as macOS shows the keyboard brightness. A real slider lies over them for keys and screen readers. */}
                  <span className="sp-steps" aria-hidden={!light.on}>
                    {Array.from({ length: 16 }, (_, i) => (
                      <i key={i} className={i < light.level ? 'lit' : ''} />
                    ))}
                    <input type="range" min={1} max={16} value={light.level} tabIndex={light.on ? 0 : -1} aria-label="Brightness" onChange={(e) => setLight({ ...light, level: +e.target.value })} />
                  </span>
                </div>
              )}

              {p.id === MIX_ID && (
                <>
                  <label className="cap sp-colorcap">
                    <input type="color" value={mix.keys} onChange={(e) => setMix({ ...mix, keys: e.target.value })} />
                    Keys
                  </label>
                  <label className="cap sp-colorcap">
                    <input type="color" value={mix.letters} onChange={(e) => setMix({ ...mix, letters: e.target.value })} />
                    Letters
                  </label>
                  <button type="button" className="cap" onClick={() => (click('mod'), setMix({ ...mix, keys: randomColor(), letters: randomColor() }))}>
                    Shuffle
                  </button>
                </>
              )}

              <button type="button" className={'cap light sp-copy' + (done === 'code' ? ' done' : '')} onClick={() => (click('key'), copy('code', p.theme ? JSON.stringify(p.theme, null, 2) : code))}>
                {done === 'code' ? 'Copied' : p.theme ? 'Copy colors' : 'Copy code'}
              </button>
            </div>
          </div>

          <section className="sp-stage" aria-label="Selected style">
            <div className="wrap sp-fit" ref={fitRef}>
              <div className="sp-glow" key={p.id} aria-hidden="true" />
              <Device
                ref={kbd}
                className="sp-dev"
                finish={p.finish}
                layout={layout}
                backlight={backlight}
                theme={p.theme}
                scale={scale}
                capture="none"
              />
            </div>
          </section>

          <section className="wrap sp-all" aria-label="All styles">
            {GROUPS.map((g) => {
              const list = all.filter((x) => x.kind === g || (g === 'Your own' && x.id === MIX_ID));
              return (
                <div className="sp-group" key={g}>
                  <h2>
                    {g} <span>{list.length}</span>
                  </h2>
                  <div className="sp-grid">
                    {list.map((x) => (
                      <Card key={x.id} p={x} on={x.id === p.id} light={x.id === p.id ? backlight : x.backlight} onPick={() => (click('key'), pick(x, true))} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </main>
        <Footer />
      </div>
    </SoundContext.Provider>
  );
}

function randomColor() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function Card({ p, on, light, onPick }: { p: Preset; on: boolean; light?: BacklightOptions; onPick: () => void }) {
  const [ref, scale] = useFit(DECK_W, 1, 0.05);
  return (
    <div className={'sp-card' + (on ? ' on' : '')}>
      {/* The keyboard holds its own buttons, so the button that picks the card lies over it, not around it. */}
      <button type="button" className="sp-card-hit" aria-pressed={on} onClick={onPick} aria-label={`${p.name}, ${p.kind}`} />
      <div className="sp-thumb" ref={ref} aria-hidden="true">
        <Device finish={p.finish} layout="en-us" backlight={light} theme={p.theme} scale={scale} sound={false} inert />
      </div>
      <div className="sp-card-meta">
        <span className="sp-card-name">{p.name}</span>
      </div>
      {p.kind !== KIND[getFinish(p.finish).model] && <span className="sp-card-kind">{p.id === MIX_ID ? 'Pick your own colors' : 'On a ' + KIND[getFinish(p.finish).model] + ' case'}</span>}
    </div>
  );
}
