import { useMemo } from 'react';
import { KeyCap, Keys, UNIT, buildKeyboard, keyboardTheme, useKeyboardController } from '@mackeys/react';
import { useFit } from './fit';
import { DEMO, REPO } from './links';
import { useSound } from './sound';

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
        <div className="foot-links">
          <a href={DEMO}>Demo</a>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href="/llms.txt">llms.txt</a>
          <a href={REPO + '/blob/main/LICENSE'} target="_blank" rel="noreferrer">MIT License</a>
        </div>
        <div className="foot-note">
          <span>Apple, Mac, MacBook and iMac are trademarks of Apple Inc. We are not part of Apple.</span>
        </div>
      </div>
      <Mark />
    </footer>
  );
}
