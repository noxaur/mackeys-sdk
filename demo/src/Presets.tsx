import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BacklightOptions, FINISHES, FinishId, KeyboardTheme } from '@mackeys/react';
import { Device } from './Device';
import { click, useSound } from './sound';

export interface Preset {
  id: string;
  name: string;
  kind: string;
  finish: FinishId;
  backlight?: BacklightOptions;
  theme?: Partial<KeyboardTheme>;
}

export const KIND: Record<string, string> = { pro: 'MacBook Pro', air: 'MacBook Air', neo: 'MacBook Neo', mk: 'iMac' };

// Your own styles change any color of the keys: faces, edges, letters and the light.
export const OWN: Preset[] = [
  { id: 'phosphor', name: 'Phosphor', kind: 'Your own', finish: 'pro-space-black', theme: { face0: '#0c100cff', face1: '#161c16ff', outline: '#3ddc5c4d', highlight: '#3ddc5c33', legend: '#3ddc5cff', capsLedOn: '#3ddc5cff', homeBar: '#3ddc5c99' } },
  { id: 'blueprint', name: 'Blueprint', kind: 'Your own', finish: 'pro-silver', theme: { face0: '#0d3b8fff', face1: '#1552c2ff', outline: '#ffffff33', highlight: '#ffffff4d', legend: '#ffffffff', homeBar: '#ffffffcc', capsLedOff: '#ffffff40' } },
  { id: 'paper', name: 'Paper', kind: 'Your own', finish: 'pro-space-black', theme: { face0: '#e7e5dfff', face1: '#f8f7f3ff', outline: '#00000026', highlight: '#ffffffff', legend: '#1a1a1aff', homeBar: '#1a1a1a99', capsLedOff: '#00000026' } },
  { id: 'ember', name: 'Ember', kind: 'Your own', finish: 'air-midnight', theme: { face0: '#3a0d0aff', face1: '#6b1812ff', outline: '#ffa07840', highlight: '#ffc8a040', legend: '#ffb199ff', capsLedOn: '#ff6a3dff', homeBar: '#ffb199aa' } },
  { id: 'lit', name: 'Night light', kind: 'Your own', finish: 'pro-space-black', backlight: { on: true, level: 16, room: 'dark' } },
  { id: 'lit-pink', name: 'Pink light', kind: 'Your own', finish: 'air-midnight', backlight: { on: true, level: 14, room: 'dark', color: '#ff9ad5', bleed: 0.8 } }
];

export const PRESETS: Preset[] = [...FINISHES.map((f) => ({ id: f.id, name: f.name.split(' · ')[1] ?? f.name, kind: KIND[f.model], finish: f.id })), ...OWN];

/** Natural width of a keyboard deck, in px. */
const DECK_W = 1053;

/** The top of the page: every style on one sideways slider. The middle keyboard is big and you can click its keys. */
export function Presets() {
  const { on } = useSound();
  const strip = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState(420);
  const [narrow, setNarrow] = useState(false);
  const [deckH, setDeckH] = useState(0);
  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  const kbW = Math.min(slot * (narrow ? 1.5 : 1.4), 920);
  const scale = kbW / DECK_W;

  // The slot is the distance between two keyboards. The big one in the middle is wider than its slot.
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      setNarrow(w < 640);
      setSlot(Math.round(w < 640 ? w * 0.56 : Math.max(200, Math.min(w * 0.42, 660))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const dev = strip.current?.querySelector<HTMLElement>('.slide-tilt > div');
    if (dev) setDeckH(dev.offsetHeight);
  }, [scale]);

  // Each keyboard grows, tilts back and rises as it comes to the middle, like the a24 film shelf.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const mid = el.scrollLeft + el.clientWidth / 2;
      const slides = Array.from(el.children) as HTMLElement[];
      slides.forEach((s, i) => {
        const d = (s.offsetLeft + s.offsetWidth / 2 - mid) / slot;
        const a = Math.min(Math.abs(d), 1);
        const far = Math.max(Math.abs(d) - 1, 0);
        const size = 1 - 0.66 * a - 0.06 * far;
        const tilt = reduce ? 0 : 1 - a;
        const inner = s.firstElementChild as HTMLElement;
        inner.style.transform = `translateY(${(a * deckH * 0.3).toFixed(1)}px) perspective(1600px) rotateX(${(tilt * 26).toFixed(2)}deg) rotateZ(${(tilt * -4).toFixed(2)}deg) scale(${Math.max(size, 0.2).toFixed(3)})`;
        inner.style.opacity = String(Math.max(0, 1 - Math.max(Math.abs(d) - 1.6, 0)));
        s.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
        if (Math.abs(d) < 0.5 && i !== curRef.current) {
          curRef.current = i;
          setCur(i);
        }
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [slot, deckH]);

  const go = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const n = Math.max(0, Math.min(PRESETS.length - 1, i));
    el.scrollTo({ left: n * slot, behavior: 'smooth' });
  };

  // A mouse can drag the shelf sideways. The page keeps its own vertical scroll: wheel and touch stay native.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.slide.on .mk-k')) return;
    drag.current = { x: e.clientX, left: strip.current!.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current;
    const el = strip.current;
    if (!g || !el) return;
    const dx = e.clientX - g.x;
    if (!g.moved && Math.abs(dx) < 5) return;
    if (!g.moved) {
      g.moved = true;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = g.left - dx;
  };
  const onPointerUp = () => {
    const g = drag.current;
    const el = strip.current;
    drag.current = null;
    if (!g?.moved || !el) return;
    el.classList.remove('dragging');
    go(Math.round(el.scrollLeft / slot));
    // A drag is not a click on the keyboard under the pointer.
    const stop = (ev: Event) => ev.stopPropagation();
    el.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0);
  };

  // The keyboard under the mouse leans toward it, a few degrees at most.
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || drag.current?.moved) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--tx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    e.currentTarget.style.setProperty('--ty', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const untilt = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--tx', '0');
    e.currentTarget.style.setProperty('--ty', '0');
  };

  const p = PRESETS[cur];
  return (
    <section className="hero" id="top">
      <div className="wrap hero-head">
        <h1>Mac keyboards for any language.</h1>
        <p>Put a real Mac keyboard in your app or on your website.</p>
      </div>

      <div className="shelf">
        {deckH > 0 && <div className="slide-glow" key={p.id} style={{ width: kbW * 1.3, height: deckH * 0.9 }} aria-hidden="true" />}
        <div
          className="slides"
          ref={strip}
          role="listbox"
          aria-label="Styles"
          tabIndex={0}
          style={{ '--slot': slot + 'px', height: deckH ? Math.round(deckH * 1.12) : undefined } as React.CSSProperties}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              go(cur + (e.key === 'ArrowLeft' ? -1 : 1));
            }
          }}
        >
          {PRESETS.map((s, i) => (
            <div
              key={s.id}
              role="option"
              aria-selected={i === cur}
              aria-label={s.name + ', ' + s.kind}
              className={'slide' + (i === cur ? ' on' : '')}
              onClick={() => {
                if (i === cur) return;
                click('mod');
                go(i);
              }}
            >
              <div className="slide-in">
                <div className="slide-tilt" onPointerMove={i === cur ? tilt : undefined} onPointerLeave={untilt}>
                  <Device finish={s.finish} layout="en-us" backlight={s.backlight} theme={s.theme} sound={on && i === cur} scale={scale} inert={i !== cur} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="slide-info" aria-live="polite">
          <b key={p.id}>{p.name}</b>
          <span key={p.id + '-k'}>{p.kind}</span>
        </div>
      </div>
    </section>
  );
}

