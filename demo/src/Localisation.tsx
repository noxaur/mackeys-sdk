import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { KeyboardController, KeyboardGeometry, LAYOUTS, LayoutId, buildKeyboard } from '@mackeys/react';
import { Device } from './Device';
import { useFit, useFullyOnScreen } from './fit';
import { useSound } from './sound';
import { DVORAK, PHRASE, PHRASE_SHOWN, keysFor } from './words';

type Id = LayoutId | 'custom';
const IDS: Id[] = [...LAYOUTS.map((l) => l.id), 'custom'];
const NAME = (id: Id) => (id === 'custom' ? 'Your own · Dvorak' : LAYOUTS.find((l) => l.id === id)!.name);

const GEO = new Map<Id, KeyboardGeometry>();
const geo = (id: Id) => {
  if (!GEO.has(id)) GEO.set(id, buildKeyboard({ finish: 'pro-silver', layout: id, custom: id === 'custom' ? DVORAK : undefined }));
  return GEO.get(id)!;
};
/** What each key shows, so a change of layout touches only the keys that change. */
const faces = (g: KeyboardGeometry) => new Map(g.keys.map((k) => [k.id, k.legends.map((l) => l.text).join('\n') + (k.iso ? ' iso' : '')]));

const OUT = 170;

/** A keyboard that keeps changing its layout and types a greeting in each language. */
export function Localisation({ active }: { active: boolean }) {
  const { on } = useSound();
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const [auto, setAuto] = useState(true);
  const [typed, setTyped] = useState(0);
  const kbd = useRef<KeyboardController>(null);
  const changed = useRef<{ ids: string[]; added: string[] }>({ ids: [], added: [] });
  const [stage, seen] = useFullyOnScreen();
  const [ref, scale] = useFit(1053, 0.78, 0.2, 560, 420);
  const id = IDS[shown];
  const phrase = PHRASE[id];
  const keys = useMemo(() => keysFor(geo(id), phrase), [id, phrase]);

  // The old letters blur away on the keys that change. The keys move to their new places.
  useEffect(() => {
    if (i === shown) return;
    const a = faces(geo(IDS[shown]));
    const b = faces(geo(IDS[i]));
    const ids = [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k));
    changed.current = { ids, added: ids.filter((k) => !a.has(k)) };
    const root = stage.current;
    if (root)
      for (const k of ids) {
        const el = root.querySelector(`[data-key="${k}"]`);
        if (!el) continue;
        const parts = b.has(k) ? el.querySelectorAll('.mk-l') : [el];
        parts.forEach((p) => p.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(5px)' }], { duration: OUT, easing: 'ease-in', fill: 'forwards' }));
      }
    const t = window.setTimeout(() => setShown(i), OUT);
    return () => clearTimeout(t);
  }, [i, shown]);

  // The new letters come into focus, in a wave from left to right.
  useLayoutEffect(() => {
    const root = stage.current;
    const { ids, added } = changed.current;
    if (!root || !ids.length) return;
    const w = geo(id).width;
    for (const k of ids) {
      const el = root.querySelector<HTMLElement>(`[data-key="${k}"]`);
      if (!el) continue;
      const delay = (parseFloat(el.style.left) / w) * 260;
      const parts = added.includes(k) ? [el] : Array.from(el.querySelectorAll('.mk-l'));
      parts.forEach((p) => {
        p.getAnimations().forEach((x) => x.cancel());
        p.animate([{ opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 320, delay, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' });
      });
    }
    changed.current = { ids: [], added: [] };
  }, [id]);

  // It types only while you can see all of the keyboard.
  const run = active && seen;
  useEffect(() => {
    setTyped(0);
    if (!run) return;
    const timers: number[] = [];
    let t = 500;
    keys.forEach((k, n) => {
      timers.push(
        window.setTimeout(() => {
          kbd.current?.tap(k);
          setTyped(n + 1);
        }, t)
      );
      t += 85 + Math.random() * 55;
    });
    if (auto) timers.push(window.setTimeout(() => setI((n) => (n + 1) % IDS.length), t + 1800));
    return () => timers.forEach(clearTimeout);
  }, [run, keys, auto]);

  const text = Array.from(PHRASE_SHOWN[id] ?? phrase);
  const cut = keys.length ? Math.round((typed / keys.length) * text.length) : 0;
  return (
    <section id="languages">
      <div className="wrap">
        <div className="section-head">
          <h2>Any language.</h2>
          <p>Seventeen languages, with the same letters as on a real Mac. Or make your own.</p>
        </div>
        <div className="loc">
          <div className="loc-list" role="list">
            {IDS.map((l, n) => (
              <button
                key={l}
                className={n === i ? 'on' : ''}
                onClick={() => {
                  setI(n);
                  setAuto(false);
                }}
              >
                <span>{NAME(l)}</span>
              </button>
            ))}
            {!auto && (
              <button onClick={() => setAuto(true)} style={{ color: 'var(--led)' }}>
                <span>Play all ▶</span>
              </button>
            )}
          </div>
          <div className="loc-stage">
            <div className="loc-word">
              <b aria-label={text.join('')}>
                <span className="done">{text.slice(0, cut).join('')}</span>
                <i className="caret" aria-hidden="true" />
                <span>{text.slice(cut).join('')}</span>
              </b>
              <span>{NAME(id)}</span>
            </div>
            <div ref={ref}>
              <div ref={stage} className="loc-dev">
                <Device ref={kbd} finish="pro-silver" layout={id} custom={id === 'custom' ? DVORAK : undefined} sound={on && run} scale={scale} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
