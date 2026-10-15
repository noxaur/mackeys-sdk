import { useState } from 'react';
import { REPO } from './links';
import { click } from './sound';

const SDKS = [
  { name: 'React', cmd: 'npm i @mackeys/react', text: 'For websites and web apps made with React.', href: REPO + '/tree/main/packages/react' },
  { name: 'Svelte', cmd: 'npm i @mackeys/svelte', text: 'For websites and web apps made with Svelte.', href: REPO + '/tree/main/packages/svelte' },
  { name: 'Swift', cmd: 'github.com/noxaur/mackeys-sdk', text: 'For Mac apps made with SwiftUI.', href: REPO + '/tree/main/swift' },
  { name: 'Rust', cmd: 'cargo add mackeys-gpui', text: 'For desktop apps made with Rust.', href: REPO + '/tree/main/rust' }
];

const STATS = [
  ['4', 'kinds of Mac'],
  ['17', 'colors'],
  ['17', 'languages'],
  ['16', 'light steps'],
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
      <span>{copied ? 'copied' : 'copy'}</span>
    </button>
  );
}

export function Sdks() {
  return (
    <section id="get">
      <div className="wrap">
        <div className="section-head">
          <div className="mono">Get it</div>
          <h2>One keyboard. Every app.</h2>
          <p>The keys, colors and sounds are the same on the web, on the Mac and on the desktop. It is free and open source.</p>
        </div>
        <div className="grid">
          {SDKS.map((s) => (
            <article className="card" key={s.name}>
              <h3>{s.name}</h3>
              <p>{s.text}</p>
              <Cmd cmd={s.cmd} />
              <a className="more" href={s.href} target="_blank" rel="noreferrer">
                How to use it →
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
