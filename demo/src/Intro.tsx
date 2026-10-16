import { Fragment, useEffect, useRef, useState } from 'react';
import { KeyboardController, buildKeyboard } from '@mackeys/react';
import { Device } from './Device';
import { useFit } from './fit';
import { useSound } from './sound';
import { keysFor } from './words';

const TITLE = 'mac keyboards for any language';

/** Keys that scroll the page. The intro blocks them while it plays. */
const SCROLL_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

/**
 * Locks page scroll (wheel, touch, keys and scrollbar) while the intro plays.
 * Returns the function that releases the lock. It is safe to call more than once.
 */
function lockScroll() {
  const html = document.documentElement;
  const body = document.body;
  const prev = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const stop = (e: Event) => e.preventDefault();
  const keys = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key)) e.preventDefault();
  };
  const opts: AddEventListenerOptions = { passive: false, capture: true };
  window.addEventListener('wheel', stop, opts);
  window.addEventListener('touchmove', stop, opts);
  window.addEventListener('keydown', keys, opts);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    [html.style.overflow, body.style.overflow, html.style.overscrollBehavior] = prev;
    window.removeEventListener('wheel', stop, opts);
    window.removeEventListener('touchmove', stop, opts);
    window.removeEventListener('keydown', keys, opts);
  };
}

/**
 * The title types itself out on a MacBook Pro. The keyboard tilts in and settles,
 * then everything fades and the page shows under it.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const { on } = useSound();
  const kbd = useRef<KeyboardController>(null);
  const [n, setN] = useState(0);
  const [out, setOut] = useState(false);
  const [ref, scale] = useFit(1053, 0.82, 0.2, 560, 280);
  const done = useRef(false);
  const unlock = useRef<() => void>(() => {});

  const finish = () => {
    if (done.current) return;
    done.current = true;
    unlock.current();
    setOut(true);
    setTimeout(onDone, 1000);
  };

  useEffect(() => {
    unlock.current = lockScroll();
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
    timers.push(window.setTimeout(finish, t + 800));
    const skip = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', skip);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', skip);
      unlock.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every letter has its place from the start, so the title does not reflow while it types.
  // Words stay whole when the line wraps.
  let i = 0;
  const words = TITLE.split(' ').map((word, w) => {
    const start = i;
    i += word.length + 1;
    return (
      <Fragment key={w}>
        {w > 0 ? ' ' : null}
        <span className="intro-word">
          {start === n ? <span className="caret" /> : null}
          {[...word].map((ch, c) => (
            <Fragment key={c}>
              <span className={start + c < n ? 'on' : undefined}>{ch}</span>
              {start + c === n - 1 ? <span className="caret" /> : null}
            </Fragment>
          ))}
        </span>
      </Fragment>
    );
  });

  return (
    <div className={'intro' + (out ? ' out' : '')} aria-live="polite">
      <div className="intro-inner" ref={ref}>
        <h1 className="intro-title" aria-label={TITLE.slice(0, n)}>
          <span aria-hidden="true">{words}</span>
        </h1>
        <div className="intro-stage">
          <div className="intro-kbd">
            <Device ref={kbd} finish="pro-space-black" layout="en-us" sound={on} scale={scale} inert />
          </div>
        </div>
      </div>
      <button className="cap small intro-skip" onClick={finish}>
        skip · esc
      </button>
    </div>
  );
}
