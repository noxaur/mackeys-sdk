import { useMemo } from 'react';
import { KeyCap, Keys, UNIT, buildKeyboard, keyboardTheme, useKeyboardController } from '@mackeys/react';
import { useFit } from './fit';
import { DEMO, INSTALL, LANGUAGES, REPO, STYLES } from './links';
import { useSound } from './sound';

const WORD = 'MACKEYS';
const VERSION = '0.2.1';

/** The wordmark is seven real key caps. They press and click. */
function Mark() {
  const { on } = useSound();
  const geometry = useMemo(() => {
    const base = buildKeyboard({ finish: 'pro-space-black' });
    const keys: KeyCap[] = [...WORD].map((c, i) => {
      const k = base.keys.find((k) => k.id === 'Key' + c)!;
      return { ...k, x: i * UNIT, y: 0, homeBar: null, capsLed: null };
    });
    return { ...base, width: WORD.length * UNIT - base.gap, height: keys[0].h, keys };
  }, []);
  const [controller, state] = useKeyboardController({ keys: geometry.keys, sound: on });
  const theme = useMemo(() => keyboardTheme('pro-space-black'), []);
  // The scale has no lower limit above the fit, so the word never gets wider than its column.
  const [ref, scale] = useFit(geometry.width, 2.4, 0.1);
  return (
    <div className="foot-mark" ref={ref}>
      <div style={{ width: geometry.width * scale, height: geometry.height * scale, position: 'relative' }}>
        <div style={{ transformOrigin: '0 0', transform: `scale(${scale})`, position: 'absolute', left: 0, top: 0 }}>
          <Keys geometry={geometry} theme={theme} state={state} controller={controller} label="MacKeys" />
        </div>
      </div>
    </div>
  );
}

type Link = { label: string; href: string; out?: boolean };

const GROUPS: { title: string; links: Link[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Styles', href: STYLES },
      { label: 'Languages', href: LANGUAGES },
      { label: 'Install', href: INSTALL },
      { label: 'Typing demo', href: DEMO }
    ]
  },
  {
    title: 'Code',
    links: [
      { label: 'GitHub', href: REPO, out: true },
      { label: 'Docs', href: REPO + '/tree/main/docs', out: true },
      { label: 'npm', href: 'https://www.npmjs.com/package/@mackeys/react', out: true },
      { label: 'llms.txt', href: '/llms.txt' }
    ]
  },
  {
    title: 'Legal',
    links: [{ label: 'MIT License', href: REPO + '/blob/main/LICENSE', out: true }]
  }
];

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-top">
        <div className="foot-brand">
          <a className="foot-name" href="#top" aria-label="mackeys sdk, back to top">
            mackeys<span> / sdk</span>
          </a>
          <p>Real Mac keyboards for apps and websites. Every style, every language, real key sounds.</p>
          <span className="foot-ver">v{VERSION}</span>
        </div>
        <nav className="foot-groups" aria-label="Footer">
          {GROUPS.map((g) => (
            <div className="foot-group" key={g.title}>
              <h3>{g.title}</h3>
              <ul>
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} {...(l.out ? { target: '_blank', rel: 'noreferrer' } : {})}>
                      {l.label}
                      {l.out && <span aria-hidden="true">↗</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="wrap">
        <Mark />
      </div>
      <div className="wrap foot-note">
        <span>© 2026 noxaur</span>
        <span>Apple, Mac, MacBook and iMac are trademarks of Apple Inc. We are not part of Apple.</span>
      </div>
    </footer>
  );
}
