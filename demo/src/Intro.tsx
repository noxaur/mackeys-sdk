import { useEffect, useRef, useState } from 'react';
import { KeyboardController, buildKeyboard } from '@mackeys/react';
import { Device } from './Device';
import { useFit } from './fit';
import { useSound } from './sound';
import { keysFor } from './words';

const TITLE = 'mac keyboards for any language';

/** The title types itself out on a MacBook Pro, then the whole screen slides away. */
export function Intro({ onDone }: { onDone: () => void }) {
  const { on } = useSound();
  const kbd = useRef<KeyboardController>(null);
  const [n, setN] = useState(0);
  const [out, setOut] = useState(false);
  const [ref, scale] = useFit(1053, 0.82, 0.2, 560, 280);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setOut(true);
    setTimeout(onDone, 1000);
  };

  useEffect(() => {
    const ids = keysFor(buildKeyboard({ finish: 'pro-space-black' }), TITLE);
    const timers: number[] = [];
    let t = 900;
    ids.forEach((id, i) => {
      timers.push(
        window.setTimeout(() => {
          kbd.current?.tap(id);
          setN(i + 1);
        }, t)
      );
      t += id === 'Space' ? 150 : 62 + Math.random() * 56;
    });
    timers.push(window.setTimeout(finish, t + 900));
    const skip = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', skip);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={'intro' + (out ? ' out' : '')} aria-live="polite">
      <div className="intro-inner" ref={ref}>
        <h1 className="intro-title">
          {TITLE.slice(0, n)}
          <span className="caret" />
        </h1>
        <div className="intro-kbd">
          <Device ref={kbd} finish="pro-space-black" layout="en-us" sound={on} scale={scale} inert />
        </div>
      </div>
      <button className="cap small intro-skip" onClick={finish}>
        skip · esc
      </button>
    </div>
  );
}
