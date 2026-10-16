import { useState } from 'react';
import type { KeyEvent } from '@mackeys/react';
import { Device } from '../Device';
import { useFit } from '../fit';
import { useSound } from '../sound';

/** Natural width of a keyboard deck, in px. */
const DECK_W = 1053;

const SOUND_NAME: Record<string, string> = {
  key: 'letter click',
  mod: 'small key click',
  tab: 'tab click',
  caps: 'caps lock click',
  wide: 'wide key click',
  enter: 'return click',
  space: 'space bar thud',
  arrow: 'arrow click',
  power: 'power button'
};

/** Idea 1: press any key and see what the keyboard knows about it. */
export function KeyInspector() {
  const { on } = useSound();
  const [ref, scale] = useFit(DECK_W, 0.82);
  const [last, setLast] = useState<KeyEvent | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [n, setN] = useState(0);

  const down = (e: KeyEvent) => {
    setLast(e);
    setN((x) => x + 1);
    setTrail((t) => [e.label || e.id, ...t].slice(0, 8));
  };

  return (
    <div className="idea-inspect">
      <div className="inspect-card" aria-live="polite">
        {last ? (
          <>
            <b key={n} className="inspect-label">
              {last.label || last.id}
            </b>
            <dl>
              <div>
                <dt>name</dt>
                <dd>{last.id}</dd>
              </div>
              <div>
                <dt>sound</dt>
                <dd>{SOUND_NAME[last.sound] ?? last.sound}</dd>
              </div>
              <div>
                <dt>from</dt>
                <dd>{last.source === 'keyboard' ? 'your keyboard' : 'a tap'}</dd>
              </div>
            </dl>
          </>
        ) : (
          <b className="inspect-label wait">Your key shows here</b>
        )}
        <div className="inspect-trail">
          {trail.map((t, i) => (
            <span key={trail.length - i + ':' + n} className="cap small">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div ref={ref} className="idea-stage">
        <Device finish="pro-space-black" scale={scale} sound={on} capture="window" onKeyDown={down} />
      </div>
    </div>
  );
}
