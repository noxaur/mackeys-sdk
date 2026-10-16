import { useState } from 'react';
import { REPO } from '../links';
import { click } from '../sound';
import { Shell } from './Shell';

const PACKAGES = [
  { name: 'React', cmd: 'npm i @mackeys/react', code: `import { MacBook } from '@mackeys/react';\n\n<MacBook finish="air-midnight" layout="en-gb" />`, dir: 'packages/react' },
  { name: 'Vue', cmd: 'npm i @mackeys/vue', code: `<MacBook finish="air-midnight" layout="en-gb" />`, dir: 'packages/vue' },
  { name: 'Svelte', cmd: 'npm i @mackeys/svelte', code: `<MacBook finish="air-midnight" layout="en-gb" />`, dir: 'packages/svelte' },
  { name: 'Web Components', cmd: 'npm i @mackeys/elements', code: `<mac-book finish="air-midnight" layout="en-gb"></mac-book>`, dir: 'packages/elements' },
  { name: 'Core', cmd: 'npm i @mackeys/core', code: `import { buildKeyboard, keyboardTheme } from '@mackeys/core';\n\nconst geometry = buildKeyboard({ finish: 'pro-silver' });`, dir: 'packages/core' },
  { name: 'Swift', cmd: 'github.com/noxaur/mackeys-sdk', code: `Add the package in Xcode, then use the MacKeys views.`, dir: 'swift' },
  { name: 'Rust', cmd: 'cargo add mackeys-gpui', code: `Add the crate, then use the MacKeys views in gpui.`, dir: 'rust' }
];

/** /install: one card for each package, with the install command and a first example. */
export function Install() {
  const [copied, setCopied] = useState('');
  const copy = (name: string, cmd: string) => {
    click('key');
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(''), 1200);
    });
  };
  return (
    <Shell title="Install" lead="One keyboard for every platform. Pick your package.">
      <section className="inner-group">
        <div className="wrap cards">
          {PACKAGES.map((p) => (
            <article className="card" key={p.name} id={p.name.toLowerCase().replace(/\s+/g, '-')}>
              <h2>{p.name}</h2>
              <button className="get-cmd" onClick={() => copy(p.name, p.cmd)} title="Copy">
                <span className="p">{p.name === 'Swift' ? 'package' : '$'}</span>
                <span className="v">{p.cmd}</span>
                <span className="cap small">{copied === p.name ? 'copied' : 'copy'}</span>
              </button>
              <pre>{p.code}</pre>
              <a href={`${REPO}/tree/main/${p.dir}`} target="_blank" rel="noreferrer">
                How to use it →
              </a>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
