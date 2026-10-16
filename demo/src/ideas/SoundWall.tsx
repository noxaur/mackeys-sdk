import { useRef, useState } from 'react';
import { sharedClickSound, type KeySound } from '@mackeys/react';

type Pad = { name: string; hint: string; key?: KeySound; tp?: true; w?: number };

const PADS: Pad[] = [
  { name: 'A', hint: 'letter', key: 'key' },
  { name: 'esc', hint: 'small key', key: 'mod' },
  { name: '⌘', hint: 'command', key: 'mod' },
  { name: '→', hint: 'arrow', key: 'arrow' },
  { name: '⏻', hint: 'power', key: 'power' },
  { name: 'tab', hint: 'tab', key: 'tab', w: 1.5 },
  { name: 'caps lock', hint: 'caps lock', key: 'caps', w: 1.5 },
  { name: 'shift', hint: 'wide key', key: 'wide', w: 2 },
  { name: 'return', hint: 'return', key: 'enter', w: 2 },
  { name: '', hint: 'space bar', key: 'space', w: 4 },
  { name: 'click', hint: 'trackpad', tp: true, w: 4 },
  { name: 'hold', hint: 'force click', tp: true, w: 4 }
];

/** Idea 2: every sound the SDK has, as a wall of keys. Press and hold to hear the down and the up click. */
export function SoundWall() {
  const [hot, setHot] = useState<number | null>(null);
  const force = useRef<number>(0);

  const press = (i: number) => {
    const p = PADS[i];
    const s = sharedClickSound();
    setHot(i);
    if (p.key) s.key(p.key, false);
    else if (p.tp) {
      s.trackpad('press');
      if (p.name === 'hold') force.current = window.setTimeout(() => s.trackpad('force'), 450);
    }
  };
  const release = (i: number) => {
    const p = PADS[i];
    const s = sharedClickSound();
    clearTimeout(force.current);
    setHot((h) => (h === i ? null : h));
    if (p.key) s.key(p.key, true);
    else if (p.tp) s.trackpad('release');
  };

  return (
    <div className="idea-sounds">
      <div className="sound-grid">
        {PADS.map((p, i) => (
          <button
            key={i}
            className={'cap sound-pad' + (hot === i ? ' down on' : '') + (p.tp ? ' tp' : '')}
            style={{ gridColumn: 'span ' + Math.round((p.w ?? 1) * 2) }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              press(i);
            }}
            onPointerUp={() => release(i)}
            onPointerCancel={() => release(i)}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                press(i);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') release(i);
            }}
            aria-label={'Play the ' + p.hint + ' sound'}
          >
            <span className="sound-name">{p.name}</span>
            <span className="sound-hint">{p.hint}</span>
          </button>
        ))}
      </div>
      <p className="idea-note">Press and hold a key. You hear the click down, then the click up.</p>
    </div>
  );
}
