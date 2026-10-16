import { useState, type CSSProperties } from 'react';
import { getFinish } from '@mackeys/react';
import { REPO } from './links';
import { click } from './sound';

const SDKS = [
  { name: 'React', finish: 'air-sky-blue', cmd: 'npm i @mackeys/react', href: REPO + '/tree/main/packages/react' },
  { name: 'Svelte', finish: 'neo-blush', cmd: 'npm i @mackeys/svelte', href: REPO + '/tree/main/packages/svelte' },
  { name: 'Vue', finish: 'air-starlight', cmd: 'npm i @mackeys/vue', href: REPO + '/tree/main/packages/vue' },
  { name: 'Web Components', finish: 'neo-indigo', cmd: 'npm i @mackeys/elements', href: REPO + '/tree/main/packages/elements' },
  { name: 'Swift', finish: 'neo-citrus', cmd: 'github.com/noxaur/mackeys-sdk', href: REPO + '/tree/main/swift' },
  { name: 'Rust', finish: 'air-midnight', cmd: 'cargo add mackeys-gpui', href: REPO + '/tree/main/rust' }
] as const;

/** Key cap colors from a MacBook color: Neo keys have their own color, the others take the top case color. */
function capColors(finish: (typeof SDKS)[number]['finish']): CSSProperties {
  const f = getFinish(finish);
  return {
    '--face': f.kf ?? f.deck[1],
    '--face-2': f.kf ?? f.deck[0],
    '--edge': f.side[1],
    '--ink': f.dark ? '#f2f2f4' : (f.kl ?? '#1d1d1f')
  } as CSSProperties;
}

/** One big key per platform. Press it to copy the install line. */
export function Sdks() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (name: string, cmd: string) => {
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopied(name);
      setTimeout(() => setCopied((c) => (c === name ? null : c)), 1400);
    });
  };
  return (
    <section id="get">
      <div className="wrap get">
        <div className="section-head get-head">
          <h2>Your app, your keyboard.</h2>
          <p>Any framework you want.</p>
        </div>
        <ul className="get-keys">
          {SDKS.map((s) => (
            <li key={s.name}>
              <button
                className={'big-key' + (copied === s.name ? ' done' : '')}
                style={capColors(s.finish)}
                onPointerDown={() => click('mod')}
                onPointerUp={() => click('mod', true)}
                onClick={() => copy(s.name, s.cmd)}
                aria-label={`Copy ${s.cmd}`}
              >
                <span className="big-key-cmd">{copied === s.name ? 'Copied.' : s.cmd}</span>
                <span className="big-key-name">{s.name}</span>
              </button>
              <a className="get-link" href={s.href} target="_blank" rel="noreferrer">
                Read the guide →
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
