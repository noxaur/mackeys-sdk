import { useState } from 'react';
import { LAYOUTS, LayoutId } from '@mackeys/react';
import { Device } from '../Device';
import { useFit } from '../fit';
import { click } from '../sound';
import { DVORAK } from '../words';
import { Shell } from './Shell';

type Id = LayoutId | 'custom';
const ITEMS: { id: Id; name: string }[] = [...LAYOUTS.map((l) => ({ id: l.id as Id, name: l.name })), { id: 'custom', name: 'Your own · Dvorak' }];

/** /languages: every layout. Pick one and type on it. */
export function Languages() {
  const [cur, setCur] = useState(ITEMS[0]);
  const [ref, scale] = useFit(1053, 0.9, 0.2);
  return (
    <Shell title="Languages" lead={`${LAYOUTS.length} layouts with the same letters as on a real Mac. Or make your own.`}>
      <section className="inner-stage">
        <div className="wrap">
          <div className="stage" ref={ref}>
            <Device key={cur.id} finish="pro-silver" layout={cur.id} custom={cur.id === 'custom' ? DVORAK : undefined} scale={scale} />
          </div>
          <div className="stage-info">
            <b>{cur.name}</b>
            <span>{cur.id}</span>
          </div>
          <code className="snippet">{cur.id === 'custom' ? '<MacKeyboard layout="custom" custom={{ … }} />' : `<MacKeyboard layout="${cur.id}" />`}</code>
        </div>
      </section>
      <section className="inner-group">
        <div className="wrap">
          <div className="chips">
            {ITEMS.map((l) => (
              <button
                key={l.id}
                className={'chip' + (l.id === cur.id ? ' on' : '')}
                aria-pressed={l.id === cur.id}
                onClick={() => {
                  click('mod');
                  setCur(l);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  );
}
