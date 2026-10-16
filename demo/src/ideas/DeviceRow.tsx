import { useState } from 'react';
import { MacBook, MacKeyboard, MacTrackpad, buildKeyboard, topCase, trackpad, type KeyEvent } from '@mackeys/react';
import { useFit } from '../fit';
import { useSound } from '../sound';

const BOOK = topCase('air-midnight', buildKeyboard({ finish: 'air-midnight' }), { parts: 'full' });
const MK = topCase('imac-green', buildKeyboard({ finish: 'imac-green' }), { parts: 'keyboard' });
const TP = trackpad('imac-green');

/** Idea 4: a MacBook, an iMac keyboard and a trackpad. A key you press on one goes down on all of them. */
export function DeviceRow() {
  const { on } = useSound();
  const [down, setDown] = useState<string[]>([]);
  const [force, setForce] = useState(0);
  const [bookRef, bookScale] = useFit(BOOK.width, 0.6);
  const [mkRef, mkScale] = useFit(MK.width, 0.6);
  const [tpRef, tpScale] = useFit(TP.width, 0.6);

  const press = (e: KeyEvent) => setDown((d) => (d.includes(e.id) ? d : [...d, e.id]));
  const lift = (e: KeyEvent) => setDown((d) => d.filter((x) => x !== e.id));

  return (
    <div className="idea-row">
      <figure>
        <div ref={bookRef} className="row-slot">
          <MacBook finish="air-midnight" lid={false} sound={on} scale={bookScale} highlight={down} onKeyDown={press} onKeyUp={lift} onForceClick={() => setForce((n) => n + 1)} />
        </div>
        <figcaption>MacBook Air</figcaption>
      </figure>
      <figure>
        <div ref={mkRef} className="row-slot">
          <MacKeyboard finish="imac-green" sound={on} scale={mkScale} highlight={down} onKeyDown={press} onKeyUp={lift} />
        </div>
        <figcaption>iMac keyboard</figcaption>
      </figure>
      <figure>
        <div ref={tpRef} className="row-slot row-tp">
          <MacTrackpad finish="imac-green" sound={on} scale={tpScale} onForceClick={() => setForce((n) => n + 1)} />
          {force > 0 && <span key={force} className="row-ripple" aria-hidden="true" />}
        </div>
        <figcaption>Trackpad · hold it for a deep click</figcaption>
      </figure>
    </div>
  );
}
