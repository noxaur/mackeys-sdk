import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyEvent, LAYOUTS, LayoutId, MacBook, buildKeyboard } from '@mackeys/react';
import { isTyping } from './Device';
import { useFit } from './fit';
import { useSound } from './sound';

const MAX = 160;

/** The top of the page: type anything on your keyboard, or click the keys, and see it land. */
export function Playground({ active }: { active: boolean }) {
  const { on } = useSound();
  const [layout, setLayout] = useState<LayoutId>('en-us');
  const [text, setText] = useState('');
  const [last, setLast] = useState<KeyEvent | null>(null);
  const [ref, scale] = useFit(1053, 0.9, 0.2, 755, 330);
  const shift = useRef(false);
  const caps = useRef(false);
  const geometry = useMemo(() => buildKeyboard({ finish: 'pro-space-black', layout }), [layout]);

  // Physical keys: take the character the browser gives us.
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') setText((t) => t.slice(0, -1));
      else if (e.key === 'Enter') setText((t) => (t + '\n').slice(-MAX));
      else if (e.key.length === 1) setText((t) => (t + e.key).slice(-MAX));
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [active]);

  // Clicked keys: read the character off the key cap.
  const onKeyDown = (e: KeyEvent) => {
    setLast(e);
    if (e.id === 'ShiftLeft' || e.id === 'ShiftRight') shift.current = true;
    if (e.id === 'CapsLock') caps.current = !caps.current;
    if (e.source !== 'pointer') return;
    if (e.id === 'Backspace') return setText((t) => t.slice(0, -1));
    if (e.id === 'Enter') return setText((t) => (t + '\n').slice(-MAX));
    if (e.id === 'Space') return setText((t) => (t + ' ').slice(-MAX));
    const k = geometry.keys.find((k) => k.id === e.id);
    if (!k || !k.legends.length) return;
    const base = k.legends.find((l) => l.slot === 'b') ?? k.legends[0];
    const top = k.legends.length > 1 ? k.legends.find((l) => l.slot === 't') : undefined;
    let c = base.text;
    if ([...c].length !== 1) return;
    const letter = /\p{L}/u.test(c) && !top;
    if (letter) c = shift.current !== caps.current ? c.toUpperCase() : c.toLowerCase();
    else if (shift.current && top && [...top.text].length === 1) c = top.text;
    setText((t) => (t + c).slice(-MAX));
  };
  const onKeyUp = (e: KeyEvent) => {
    if (e.id === 'ShiftLeft' || e.id === 'ShiftRight') shift.current = false;
  };

  return (
    <section className="hero" id="play">
      <div className="wrap" id="top">
        <p className="typed" aria-live="polite">
          {text ? <span>{text}</span> : <span className="ph">Type anything, or click the keys</span>}
          <span className="caret" />
        </p>
        <div className="hero-meta">
          <div className="pills" role="radiogroup" aria-label="Layout">
            {LAYOUTS.map((l) => (
              <button key={l.id} className={'pill' + (l.id === layout ? ' on' : '')} role="radio" aria-checked={l.id === layout} title={l.name} onClick={() => setLayout(l.id)}>
                {l.id}
              </button>
            ))}
          </div>
          <div className="readout">
            <span>
              key <b>{last?.id ?? '—'}</b>
            </span>
            <span>
              sound <b>{last?.sound ?? '—'}</b>
            </span>
            <span>
              layout <b>{LAYOUTS.find((l) => l.id === layout)?.name}</b>
            </span>
          </div>
        </div>
      </div>
      <div className="wrap hero-stage" ref={ref}>
        <MacBook finish="pro-space-black" layout={layout} lid={false} capture={active ? 'window' : 'none'} sound={on} scale={scale} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />
      </div>
    </section>
  );
}
