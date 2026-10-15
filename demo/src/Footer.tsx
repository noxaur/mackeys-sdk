import { useMemo } from 'react';
import { KeyCap, Keys, UNIT, buildKeyboard, keyboardTheme, useKeyboardController } from '@mackeys/react';
import { useFit } from './fit';
import { useSound } from './sound';

const REPO = 'https://github.com/noxaur/mackeys-sdk';
const WORD = 'MACKEYS';

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
  const [ref, scale] = useFit(geometry.width, 3.2, 0.5);
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

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-cols">
          <div>
            <h4>Explore</h4>
            <ul>
              <li><a href="#play">Playground</a></li>
              <li><a href="#languages">Languages</a></li>
              <li><a href="#styles">Styles</a></li>
            </ul>
          </div>
          <div>
            <h4>SDKs</h4>
            <ul>
              <li><a href="https://www.npmjs.com/package/@mackeys/react" target="_blank" rel="noreferrer">React</a></li>
              <li><a href="https://www.npmjs.com/package/@mackeys/svelte" target="_blank" rel="noreferrer">Svelte</a></li>
              <li><a href={REPO + '/tree/main/swift'} target="_blank" rel="noreferrer">Swift</a></li>
              <li><a href="https://crates.io/crates/mackeys-gpui" target="_blank" rel="noreferrer">Rust</a></li>
              <li><a href="https://www.npmjs.com/package/@mackeys/core" target="_blank" rel="noreferrer">Core</a></li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              <li><a href={REPO} target="_blank" rel="noreferrer">GitHub</a></li>
              <li><a href={REPO + '/blob/main/spec/SPEC.md'} target="_blank" rel="noreferrer">Spec</a></li>
              <li><a href={REPO + '/tree/main/examples'} target="_blank" rel="noreferrer">Examples</a></li>
              <li><a href={REPO + '/issues'} target="_blank" rel="noreferrer">Issues</a></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><a href={REPO + '/blob/main/LICENSE'} target="_blank" rel="noreferrer">MIT License</a></li>
              <li><a href="https://freesound.org/s/467490/" target="_blank" rel="noreferrer">Trackpad sound · CC0</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-note">
          <span>Key clicks recorded on a Norwegian MacBook for this project.</span>
          <span>Apple, Mac, MacBook, iMac, Magic Keyboard, Touch ID and Force Touch are trademarks of Apple Inc. Not affiliated with Apple.</span>
        </div>
      </div>
      <Mark />
    </footer>
  );
}
