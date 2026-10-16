import { useState } from 'react';
import { FINISHES } from '@mackeys/react';
import { Device } from '../Device';
import { KIND, OWN, PRESETS, Preset } from '../Presets';
import { useFit } from '../fit';
import { click } from '../sound';
import { Shell } from './Shell';

const GROUPS: { title: string; items: Preset[] }[] = [
  ...Object.values(KIND).map((kind) => ({ title: kind, items: PRESETS.filter((p) => p.kind === kind) })),
  { title: 'Your own', items: OWN }
];

/** The code that makes a style. */
function snippet(p: Preset) {
  if (p.theme) return `<MacKeyboard finish="${p.finish}" theme={${JSON.stringify(p.theme)}} />`;
  if (p.backlight) return `<MacKeyboard finish="${p.finish}" backlight={${JSON.stringify(p.backlight)}} />`;
  return `<MacKeyboard finish="${p.finish}" />`;
}

/** /styles: every finish and every custom style. Pick one to type on it. */
export function Styles() {
  const [cur, setCur] = useState(PRESETS[0]);
  const [ref, scale] = useFit(1053, 0.9, 0.2);
  return (
    <Shell title="Styles" lead="Every MacBook and iMac color, and styles of your own. Pick one and type on it.">
      <section className="inner-stage">
        <div className="wrap">
          <div className="stage" ref={ref}>
            <Device key={cur.id} finish={cur.finish} backlight={cur.backlight} theme={cur.theme} scale={scale} />
          </div>
          <div className="stage-info">
            <b>{cur.name}</b>
            <span>{cur.kind}</span>
          </div>
          <code className="snippet">{snippet(cur)}</code>
        </div>
      </section>
      {GROUPS.map((g) => (
        <section className="inner-group" key={g.title}>
          <div className="wrap">
            <h2>{g.title}</h2>
            <div className="chips">
              {g.items.map((p) => (
                <button
                  key={p.id}
                  className={'chip' + (p.id === cur.id ? ' on' : '')}
                  aria-pressed={p.id === cur.id}
                  onClick={() => {
                    click('mod');
                    setCur(p);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <Swatch p={p} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      ))}
    </Shell>
  );
}

function Swatch({ p }: { p: Preset }) {
  const f = FINISHES.find((x) => x.id === p.finish)!;
  const [a, b] = p.theme?.face0 && p.theme.face1 ? [p.theme.face0, p.theme.face1] : f.deck;
  return <i className="swatch" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />;
}
