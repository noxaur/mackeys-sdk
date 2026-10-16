import { useEffect, useMemo, useRef, useState } from 'react';
import { FINISHES, MacBook, buildKeyboard, topCase } from '@mackeys/react';
import { REPO } from './links';
import { click, useSound } from './sound';
import { keysFor } from './words';

const SDKS = [
  {
    name: 'React',
    finish: 'air-sky-blue' as const,
    cmd: 'npm i @mackeys/react',
    href: REPO + '/tree/main/packages/react'
  },
  {
    name: 'Svelte',
    finish: 'neo-blush' as const,
    cmd: 'npm i @mackeys/svelte',
    href: REPO + '/tree/main/packages/svelte'
  },
  {
    name: 'Swift',
    finish: 'neo-citrus' as const,
    cmd: 'github.com/noxaur/mackeys-sdk',
    href: REPO + '/tree/main/swift'
  },
  {
    name: 'Rust',
    finish: 'air-midnight' as const,
    cmd: 'cargo add mackeys-gpui',
    href: REPO + '/tree/main/rust'
  }
];

type Finish = (typeof SDKS)[number]['finish'];
/** Natural size of a MacBook top case: the keyboard and the trackpad, without the lid. */
const deck = (finish: Finish) => topCase(finish, buildKeyboard({ finish, layout: 'en-us' }), { parts: 'full' });
const DECK_W = Math.max(...SDKS.map((x) => deck(x.finish).width));
const DECK_H = Math.max(...SDKS.map((x) => deck(x.finish).height + 10));

/** The same keyboard and trackpad in every app. Each platform gets its own MacBook color, and the keyboard types its name. */
function Desk({ finish, name }: { finish: Finish; name: string }) {
  const { on } = useSound();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [down, setDown] = useState<string[]>([]);
  const first = useRef(true);
  const keys = useMemo(() => keysFor(buildKeyboard({ finish, layout: 'en-us' }), name.toLowerCase()), [finish, name]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / DECK_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timers: number[] = [];
    keys.forEach((k, n) => {
      const t = 160 + n * 120;
      timers.push(
        window.setTimeout(() => {
          setDown([k]);
          if (on) click('key');
        }, t),
        window.setTimeout(() => {
          setDown([]);
          if (on) click('key', true);
        }, t + 70)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [keys]);

  return (
    <div className="desk" ref={box} style={{ height: DECK_H * scale }}>
      <MacBook finish={finish} layout="en-us" lid={false} sound={on} scale={scale} highlight={down} />
    </div>
  );
}

export function Sdks() {
  const [n, setN] = useState(0);
  const [copied, setCopied] = useState(false);
  const s = SDKS[n];
  const color = FINISHES.find((f) => f.id === s.finish)!.name;
  const copy = () => {
    navigator.clipboard?.writeText(s.cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <section id="get">
      <div className="wrap get">
        <div className="get-side">
          <div className="get-tabs" role="tablist" aria-label="Platform">
            {SDKS.map((x, i) => (
              <button
                key={x.name}
                role="tab"
                aria-selected={i === n}
                className={'cap get-tab' + (i === n ? ' on' : '')}
                onPointerDown={() => click('mod')}
                onPointerUp={() => click('mod', true)}
                onClick={() => {
                  setN(i);
                  setCopied(false);
                }}
              >
                <span className="dot" />
                {x.name}
              </button>
            ))}
          </div>
        </div>

        <div className="get-code" role="tabpanel" aria-label={s.name}>
          <div className="get-bar">
            <span>{color}</span>
            <a href={s.href} target="_blank" rel="noreferrer">
              How to use it →
            </a>
          </div>
          <Desk finish={s.finish} name={s.name} />
          <button className="get-cmd" onClick={copy} title="Copy">
            <span className="p">{s.name === 'Swift' ? 'package' : '$'}</span>
            <span className="v">{s.cmd}</span>
            <span className="cap small">{copied ? 'copied' : 'copy'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
