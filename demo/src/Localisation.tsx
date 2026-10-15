import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardController, LAYOUTS, LayoutId, buildKeyboard } from '@mackeys/react';
import { Device } from './Device';
import { useFit, useOnScreen } from './fit';
import { useSound } from './sound';
import { DVORAK, HELLO, HELLO_SHOWN, keysFor } from './words';

type Id = LayoutId | 'custom';
const IDS: Id[] = [...LAYOUTS.map((l) => l.id), 'custom'];
const NAME = (id: Id) => (id === 'custom' ? 'Custom · Dvorak' : LAYOUTS.find((l) => l.id === id)!.name);

/** A keyboard that keeps changing its layout and says hello in each language. */
export function Localisation({ active }: { active: boolean }) {
  const { on } = useSound();
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const kbd = useRef<KeyboardController>(null);
  const [box, seen] = useOnScreen('-10%');
  const [ref, scale] = useFit(1053, 0.78, 0.2, 560, 420);
  const id = IDS[i];
  const custom = id === 'custom' ? DVORAK : undefined;
  const word = HELLO[id];
  const keys = useMemo(() => keysFor(buildKeyboard({ finish: 'pro-silver', layout: id, custom }), word), [id, custom, word]);

  const run = active && seen;
  useEffect(() => {
    if (!run) return;
    const timers: number[] = [];
    let t = 600;
    keys.forEach((k) => {
      timers.push(window.setTimeout(() => kbd.current?.tap(k), t));
      t += 95 + Math.random() * 60;
    });
    if (auto) timers.push(window.setTimeout(() => setI((n) => (n + 1) % IDS.length), t + 1500));
    return () => timers.forEach(clearTimeout);
  }, [run, keys, auto, i]);

  return (
    <section id="languages" ref={box as React.RefObject<HTMLElement>}>
      <div className="wrap">
        <div className="section-head">
          <div className="mono">Localisation</div>
          <h2>Any language. Any layout.</h2>
          <p>Seventeen layouts ship with the SDK, from ANSI to ISO to JIS, with every legend measured on the real keys. Or write your own rows and get a custom layout.</p>
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
                <span>{l}</span>
              </button>
            ))}
            {!auto && (
              <button onClick={() => setAuto(true)} style={{ color: 'var(--led)' }}>
                <span>resume</span>
                <span>▶</span>
              </button>
            )}
          </div>
          <div className="loc-stage">
            <div className="loc-word">
              <b key={id} className="loc-kbd">
                {HELLO_SHOWN[id] ?? word}
              </b>
              <span>
                {NAME(id)} · {custom ? 'ANSI' : LAYOUTS.find((l) => l.id === id)?.jis ? 'JIS' : LAYOUTS.find((l) => l.id === id)?.iso ? 'ISO' : 'ANSI'}
              </span>
            </div>
            <div ref={ref}>
              <div key={id} className="loc-kbd">
                <Device ref={kbd} finish="pro-silver" layout={id} custom={custom} sound={on && run} scale={scale} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
