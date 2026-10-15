import { useState } from 'react';
import { click } from './sound';

const REPO = 'https://github.com/noxaur/mackeys-sdk';

const SDKS = [
  { name: 'React', cmd: 'npm i @mackeys/react', text: 'MacBook, MacKeyboard and MacTrackpad components for React 18+. Hooks and parts to build your own.', href: REPO + '/tree/main/packages/react' },
  { name: 'Svelte', cmd: 'npm i @mackeys/svelte', text: 'The same components for Svelte 5, with runes.', href: REPO + '/tree/main/packages/svelte' },
  { name: 'Swift', cmd: 'github.com/noxaur/mackeys-sdk', text: 'A SwiftUI package for macOS 14 and later. Swift 6, no dependencies.', href: REPO + '/tree/main/swift' },
  { name: 'Rust', cmd: 'cargo add mackeys-gpui', text: 'mackeys-core is the engine. mackeys-gpui draws it in GPUI.', href: REPO + '/tree/main/rust' },
  { name: 'Core', cmd: 'npm i @mackeys/core', text: 'The TypeScript engine with no UI: geometry, themes, layouts, controllers and sounds as plain numbers.', href: REPO + '/tree/main/packages/core' },
  { name: 'Spec', cmd: 'spec/SPEC.md', text: 'One spec and golden fixtures. Every port loads the same data and passes the same tests.', href: REPO + '/blob/main/spec/SPEC.md' }
];

const STATS = [
  ['5', 'SDKs'],
  ['4', 'devices'],
  ['17', 'finishes'],
  ['17', 'layouts'],
  ['16', 'backlight steps'],
  ['9', 'key sounds']
];

function Cmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button className="cmd" onPointerDown={() => click('tab')} onPointerUp={() => click('tab', true)} onClick={copy} title="Copy">
      <span>{cmd}</span>
      <span>{copied ? 'copied' : '⌘C'}</span>
    </button>
  );
}

export function Sdks() {
  return (
    <section id="sdks">
      <div className="wrap">
        <div className="section-head">
          <div className="mono">SDKs</div>
          <h2>One keyboard, five SDKs.</h2>
          <p>The TypeScript engine is the reference. The Swift and Rust ports load the same data and pass the same fixtures, so every device looks and sounds the same everywhere.</p>
        </div>
        <div className="grid">
          {SDKS.map((s) => (
            <article className="card" key={s.name}>
              <h3>{s.name}</h3>
              <p>{s.text}</p>
              <Cmd cmd={s.cmd} />
              <a className="more" href={s.href} target="_blank" rel="noreferrer">
                Read the docs →
              </a>
            </article>
          ))}
        </div>
        <div className="stats">
          {STATS.map(([n, l]) => (
            <div key={l}>
              <b>{n}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
