import { useEffect, useMemo, useState } from 'react';
import { FINISHES, buildKeyboard, topCase } from '@mackeys/react';
import { Device } from '../Device';
import { useFit } from '../fit';
import { click, useSound } from '../sound';

const W = Math.max(...FINISHES.map((f) => topCase(f.id, buildKeyboard({ finish: f.id }), { parts: 'keyboard' }).width));
const H = Math.max(...FINISHES.map((f) => topCase(f.id, buildKeyboard({ finish: f.id }), { parts: 'keyboard' }).height + 10));

/** Idea 3: one keyboard that changes into every color. It plays by itself until you pick one. */
export function ColorMorph() {
  const { on } = useSound();
  const [ref, scale] = useFit(W, 0.82);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const f = FINISHES[i];
  const [model, color] = useMemo(() => f.name.split(' · '), [f]);

  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % FINISHES.length), 1700);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <div className="idea-morph">
      <div ref={ref} className="idea-stage morph-stage" style={{ height: H * scale }}>
        <Device finish={f.id} scale={scale} sound={on} inert={auto} />
      </div>
      <div className="morph-info">
        <b key={f.id}>{color ?? model}</b>
        <span>{model}</span>
      </div>
      <div className="morph-dots" role="radiogroup" aria-label="Color">
        {FINISHES.map((x, n) => (
          <button
            key={x.id}
            role="radio"
            aria-checked={n === i}
            aria-label={x.name}
            title={x.name}
            className={'morph-dot' + (n === i ? ' on' : '')}
            style={{ background: `linear-gradient(160deg, ${x.deck[0]}, ${x.deck[1]})` }}
            onClick={() => {
              click('mod');
              setAuto(false);
              setI(n);
            }}
          />
        ))}
        <button className={'cap small' + (auto ? ' on' : '')} onClick={() => setAuto((a) => !a)}>
          <span className="dot" />
          {auto ? 'pause' : 'play'}
        </button>
      </div>
    </div>
  );
}
