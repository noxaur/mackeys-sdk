import { useEffect, useMemo, useRef, useState } from 'react';
import { BacklightOptions, FINISHES, FinishId, KeyboardTheme, getFinish } from '@mackeys/react';
import { Device } from './Device';
import { useFit } from './fit';
import { DEMO } from './links';
import { click, useSound } from './sound';

type Group = 'pro' | 'air' | 'neo' | 'mk' | 'own';

interface Preset {
  id: string;
  name: string;
  group: Group;
  finish: FinishId;
  backlight?: BacklightOptions;
  theme?: Partial<KeyboardTheme>;
}

const GROUPS: { id: Group | 'all'; name: string }[] = [
  { id: 'all', name: 'All' },
  { id: 'pro', name: 'MacBook Pro' },
  { id: 'air', name: 'MacBook Air' },
  { id: 'neo', name: 'MacBook Neo' },
  { id: 'mk', name: 'iMac' },
  { id: 'own', name: 'Your own' }
];
const GROUP_NAME = Object.fromEntries(GROUPS.map((g) => [g.id, g.name])) as Record<Group, string>;

// Your own styles change any color of the keys: faces, edges, letters and the light.
const OWN: Preset[] = [
  { id: 'phosphor', name: 'Phosphor', group: 'own', finish: 'pro-space-black', theme: { face0: '#0c100cff', face1: '#161c16ff', outline: '#3ddc5c4d', highlight: '#3ddc5c33', legend: '#3ddc5cff', capsLedOn: '#3ddc5cff', homeBar: '#3ddc5c99' } },
  { id: 'blueprint', name: 'Blueprint', group: 'own', finish: 'pro-silver', theme: { face0: '#0d3b8fff', face1: '#1552c2ff', outline: '#ffffff33', highlight: '#ffffff4d', legend: '#ffffffff', homeBar: '#ffffffcc', capsLedOff: '#ffffff40' } },
  { id: 'paper', name: 'Paper', group: 'own', finish: 'pro-space-black', theme: { face0: '#e7e5dfff', face1: '#f8f7f3ff', outline: '#00000026', highlight: '#ffffffff', legend: '#1a1a1aff', homeBar: '#1a1a1a99', capsLedOff: '#00000026' } },
  { id: 'ember', name: 'Ember', group: 'own', finish: 'air-midnight', theme: { face0: '#3a0d0aff', face1: '#6b1812ff', outline: '#ffa07840', highlight: '#ffc8a040', legend: '#ffb199ff', capsLedOn: '#ff6a3dff', homeBar: '#ffb199aa' } },
  { id: 'lit', name: 'Night light', group: 'own', finish: 'pro-space-black', backlight: { on: true, level: 16, room: 'dark' } },
  { id: 'lit-pink', name: 'Pink light', group: 'own', finish: 'air-midnight', backlight: { on: true, level: 14, room: 'dark', color: '#ff9ad5', bleed: 0.8 } }
];

const PRESETS: Preset[] = [...FINISHES.map((f) => ({ id: f.id, name: f.name.split(' · ')[1] ?? f.name, group: f.model as Group, finish: f.id })), ...OWN];

const OFF: BacklightOptions = { on: false, level: 12, room: 'daylight', color: '#f2f5ff', bleed: 0.5 };

/** The top of the page: a big keyboard in the chosen style, and a shelf of every style below it. */
export function Presets() {
  const { on } = useSound();
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [group, setGroup] = useState<Group | 'all'>('all');
  const [bl, setBl] = useState<BacklightOptions>(OFF);
  const [ref, scale] = useFit(1053, 0.9, 0.2, 560, 450);
  const list = useMemo(() => (group === 'all' ? PRESETS : PRESETS.filter((p) => p.group === group)), [group]);
  const model = getFinish(preset.finish).model;
  const lightable = model === 'pro' || model === 'air';

  const pick = (p: Preset) => {
    setPreset(p);
    setBl(p.backlight ? { ...OFF, ...p.backlight } : { ...bl, on: false });
  };
  const set = (patch: Partial<BacklightOptions>) => setBl({ ...bl, ...patch });
  const step = (d: number) => {
    const i = list.findIndex((p) => p.id === preset.id);
    pick(list[(i + d + list.length) % list.length]);
  };
  const filter = (g: Group | 'all') => {
    setGroup(g);
    const next = g === 'all' ? PRESETS : PRESETS.filter((p) => p.group === g);
    if (!next.some((p) => p.id === preset.id)) pick(next[0]);
  };

  return (
    <section className="hero" id="top">
      <div className="wrap hero-head">
        <h1>Mac keyboards for any language.</h1>
        <p>Put a real Mac keyboard in your app or on your website. Pick a style below, then click the keys to hear them.</p>
        <div className="hero-cta">
          <a className="cap light" href={DEMO} target="_blank" rel="noreferrer" onPointerDown={() => click('key')} onPointerUp={() => click('key', true)}>
            Try the typing demo <span aria-hidden="true">→</span>
          </a>
          <a className="cap" href="#get" onPointerDown={() => click('key')} onPointerUp={() => click('key', true)}>
            Get it
          </a>
        </div>
      </div>

      <div className="wrap stage">
        <div className="stage-kbd" ref={ref}>
          <div key={preset.id} className="rise">
            <Device finish={preset.finish} layout="en-us" backlight={lightable ? bl : undefined} theme={preset.theme} sound={on} scale={scale} />
          </div>
        </div>
        <div className="stage-bar">
          <div className="stage-name">
            <b>{preset.name}</b>
            <span>{GROUP_NAME[preset.group]}</span>
          </div>
          <div className="stage-controls">
            {lightable ? (
              <>
                <Toggle on={!!bl.on} onChange={(v) => set({ on: v })}>
                  Key light
                </Toggle>
                <Toggle on={bl.room === 'dark'} onChange={(v) => set({ room: v ? 'dark' : 'daylight' })}>
                  Dark room
                </Toggle>
                <label className={bl.on ? '' : 'off'}>
                  Brightness <input type="range" min={1} max={16} value={bl.level} disabled={!bl.on} onChange={(e) => set({ level: +e.target.value })} />
                </label>
                <label className={bl.on ? '' : 'off'}>
                  Color <input type="color" value={bl.color} disabled={!bl.on} onChange={(e) => set({ color: e.target.value })} />
                </label>
              </>
            ) : (
              <span className="muted">This keyboard has no key light.</span>
            )}
          </div>
        </div>
      </div>

      <Shelf list={list} group={group} current={preset.id} onPick={pick} onFilter={filter} onStep={step} />
    </section>
  );
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button className={'cap small' + (on ? ' on' : '')} aria-pressed={on} onPointerDown={() => click('mod')} onPointerUp={() => click('mod', true)} onClick={() => onChange(!on)}>
      <span className="dot" />
      {children}
    </button>
  );
}

interface ShelfProps {
  list: Preset[];
  group: Group | 'all';
  current: string;
  onPick: (p: Preset) => void;
  onFilter: (g: Group | 'all') => void;
  onStep: (d: number) => void;
}

/** A sideways shelf of keyboards with a filter for each kind of Mac. It scrolls sideways only. */
function Shelf({ list, group, current, onPick, onFilter, onStep }: ShelfProps) {
  const ref = useRef<HTMLDivElement>(null);
  const index = list.findIndex((p) => p.id === current);

  // Cards turn away from the middle, like a row of boxes on a shelf.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tilt = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      for (const c of Array.from(el.children) as HTMLElement[]) {
        const b = c.getBoundingClientRect();
        const d = Math.max(-1, Math.min(1, (b.left + b.width / 2 - mid) / (r.width / 2)));
        c.style.transform = reduce ? '' : `rotateY(${(-d * 24).toFixed(2)}deg) translateZ(${(-Math.abs(d) * 140).toFixed(1)}px)`;
        c.style.opacity = String(1 - Math.abs(d) * 0.4);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tilt);
    };
    tilt();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [group]);

  // Keep the chosen card in the middle of the shelf.
  useEffect(() => {
    const el = ref.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  }, [index, group]);

  return (
    <div className="shelf">
      <div className="wrap shelf-head">
        <div className="shelf-title">
          <b>{PRESETS.length}</b> styles
        </div>
        <div className="chips" role="radiogroup" aria-label="Kind of Mac">
          {GROUPS.map((g) => {
            const n = g.id === 'all' ? PRESETS.length : PRESETS.filter((p) => p.group === g.id).length;
            return (
              <button key={g.id} className={'chip' + (g.id === group ? ' on' : '')} role="radio" aria-checked={g.id === group} onClick={() => onFilter(g.id)}>
                {g.name} <i>{n}</i>
              </button>
            );
          })}
        </div>
        <div className="shelf-nav">
          <span>
            {index + 1} / {list.length}
          </span>
          <button className="cap small" aria-label="Previous style" onPointerDown={() => click('key')} onPointerUp={() => click('key', true)} onClick={() => onStep(-1)}>
            ←
          </button>
          <button className="cap small" aria-label="Next style" onPointerDown={() => click('key')} onPointerUp={() => click('key', true)} onClick={() => onStep(1)}>
            →
          </button>
        </div>
      </div>
      <div
        className="strip"
        ref={ref}
        role="listbox"
        aria-label="Styles"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            onStep(e.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
      >
        {list.map((p) => (
          <div
            key={p.id}
            role="option"
            aria-selected={p.id === current}
            className={'strip-card' + (p.id === current ? ' on' : '')}
            onPointerDown={() => click('mod')}
            onPointerUp={() => click('mod', true)}
            onClick={() => onPick(p)}
          >
            <div className="kbd">
              <Device finish={p.finish} layout="en-us" backlight={p.backlight} theme={p.theme} sound={false} scale={0.34} inert />
            </div>
            <div className="label">
              <span>{p.name}</span>
              <i>{GROUP_NAME[p.group]}</i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
