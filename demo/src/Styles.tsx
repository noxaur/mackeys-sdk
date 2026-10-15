import { useEffect, useRef, useState } from 'react';
import { BacklightOptions, FINISHES, FinishId, KeyboardTheme, getFinish } from '@mackeys/react';
import { Device } from './Device';
import { useFit } from './fit';
import { click, useSound } from './sound';

interface Preset {
  id: string;
  name: string;
  finish: FinishId;
  note: string;
  backlight?: BacklightOptions;
  theme?: Partial<KeyboardTheme>;
}

// Custom themes override any field of the finish's theme: faces, outline, legends, LED.
const CUSTOM: Preset[] = [
  { id: 'phosphor', name: 'Phosphor', finish: 'pro-space-black', note: 'custom theme', theme: { face0: '#0c100cff', face1: '#161c16ff', outline: '#3ddc5c4d', highlight: '#3ddc5c33', legend: '#3ddc5cff', capsLedOn: '#3ddc5cff', homeBar: '#3ddc5c99' } },
  { id: 'blueprint', name: 'Blueprint', finish: 'pro-silver', note: 'custom theme', theme: { face0: '#0d3b8fff', face1: '#1552c2ff', outline: '#ffffff33', highlight: '#ffffff4d', legend: '#ffffffff', homeBar: '#ffffffcc', capsLedOff: '#ffffff40' } },
  { id: 'paper', name: 'Paper', finish: 'pro-space-black', note: 'custom theme', theme: { face0: '#e7e5dfff', face1: '#f8f7f3ff', outline: '#00000026', highlight: '#ffffffff', legend: '#1a1a1aff', homeBar: '#1a1a1a99', capsLedOff: '#00000026' } },
  { id: 'ember', name: 'Ember', finish: 'air-midnight', note: 'custom theme', theme: { face0: '#3a0d0aff', face1: '#6b1812ff', outline: '#ffa07840', highlight: '#ffc8a040', legend: '#ffb199ff', capsLedOn: '#ff6a3dff', homeBar: '#ffb199aa' } },
  { id: 'lit', name: 'Space Black · lit', finish: 'pro-space-black', note: 'backlight 16 · dark room', backlight: { on: true, level: 16, room: 'dark' } },
  { id: 'lit-pink', name: 'Midnight · pink light', finish: 'air-midnight', note: 'backlight · #ff9ad5', backlight: { on: true, level: 14, room: 'dark', color: '#ff9ad5', bleed: 0.8 } }
];

const PRESETS: Preset[] = [...FINISHES.map((f) => ({ id: f.id, name: f.name, finish: f.id, note: f.model === 'mk' ? 'magic keyboard' : f.model === 'neo' ? 'light keys' : 'finish' })), ...CUSTOM];

export function Styles() {
  const { on } = useSound();
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [bl, setBl] = useState<BacklightOptions>({ on: false, level: 12, room: 'daylight', color: '#f2f5ff', bleed: 0.5 });
  const [ref, scale] = useFit(1053, 0.85);
  const backlit = getFinish(preset.finish).model === 'pro' || getFinish(preset.finish).model === 'air';
  const pick = (p: Preset) => {
    setPreset(p);
    if (p.backlight) setBl({ ...bl, ...p.backlight });
  };
  const set = (patch: Partial<BacklightOptions>) => setBl({ ...bl, ...patch });

  return (
    <section id="styles">
      <div className="wrap">
        <div className="section-head">
          <div className="mono">Styles</div>
          <h2>Every finish. Or your own.</h2>
          <p>Seventeen Apple finishes with their real deck, key and legend colors. The backlight has sixteen steps, a room, a light color and bleed. And a theme is plain data, so override any part of it.</p>
        </div>
        <div className="lab">
          <div className="lab-controls">
            <span style={{ color: 'var(--fg)' }}>{preset.name}</span>
            {backlit && (
              <>
                <label>
                  <input type="checkbox" checked={!!bl.on} onChange={(e) => set({ on: e.target.checked })} /> backlight
                </label>
                <label>
                  level <input type="range" min={0} max={16} value={bl.level} onChange={(e) => set({ level: +e.target.value })} /> {bl.level}
                </label>
                <label>
                  <input type="checkbox" checked={bl.room === 'dark'} onChange={(e) => set({ room: e.target.checked ? 'dark' : 'daylight' })} /> dark room
                </label>
                <label>
                  light <input type="color" value={bl.color} onChange={(e) => set({ color: e.target.value })} />
                </label>
                <label>
                  bleed <input type="range" min={0} max={1} step={0.05} value={bl.bleed} onChange={(e) => set({ bleed: +e.target.value })} />
                </label>
              </>
            )}
            {!backlit && <span>no backlight on this device</span>}
          </div>
          <div className="lab-stage" ref={ref}>
            <Device finish={preset.finish} layout="en-us" backlight={backlit ? bl : undefined} theme={preset.theme} sound={on} scale={scale} />
          </div>
          <div className="lab-readout">
            {`finish="${preset.finish}"` + (backlit && bl.on ? ` backlight={{ on: true, level: ${bl.level}, room: '${bl.room}', color: '${bl.color}', bleed: ${bl.bleed} }}` : '') + (preset.theme ? ` theme={${JSON.stringify(preset.theme)}}` : '')}
          </div>
        </div>
      </div>
      <Strip presets={PRESETS} current={preset.id} onPick={pick} />
    </section>
  );
}

/** A horizontal shelf of keyboards. It scrolls sideways only; the page keeps its own vertical scroll. */
function Strip({ presets, current, onPick }: { presets: Preset[]; current: string; onPick: (p: Preset) => void }) {
  const ref = useRef<HTMLDivElement>(null);
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
        c.style.transform = reduce ? '' : `rotateY(${(-d * 28).toFixed(2)}deg) translateZ(${(-Math.abs(d) * 160).toFixed(1)}px)`;
        c.style.opacity = String(1 - Math.abs(d) * 0.35);
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
  }, []);
  const pickAndShow = (p: Preset) => {
    onPick(p);
    document.getElementById('styles')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="strip-wrap">
      <div className="strip-hint">
        <span>{presets.length} presets</span>
        <span>scroll sideways →</span>
      </div>
      <div className="strip" ref={ref}>
        {presets.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            aria-pressed={p.id === current}
            className={'strip-card' + (p.id === current ? ' on' : '')}
            onPointerDown={() => click('mod')}
            onPointerUp={() => click('mod', true)}
            onClick={() => pickAndShow(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pickAndShow(p);
              }
            }}
          >
            <div className="kbd">
              <Device finish={p.finish} layout="en-us" backlight={p.backlight} theme={p.theme} sound={false} scale={0.34} inert />
            </div>
            <div className="label">
              <span>{p.name}</span>
              <i>{p.note}</i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
