import type { ReactNode } from 'react';
import { SoundContext } from '../sound';
import { KeyInspector } from './KeyInspector';
import { SoundWall } from './SoundWall';
import { ColorMorph } from './ColorMorph';
import { DeviceRow } from './DeviceRow';
import '../ideas.css';

const SOUND = { on: true, setOn: () => {} };

function Idea({ n, title, note, children }: { n: number; title: string; note: string; children: ReactNode }) {
  return (
    <section className="idea">
      <div className="wrap">
        <header className="idea-head">
          <span className="idea-n">{n}</span>
          <div>
            <h2>{title}</h2>
            <p>{note}</p>
          </div>
        </header>
        {children}
      </div>
    </section>
  );
}

/** /ideas: four prototype sections on one page, to compare. None of them is on the main page. */
export function Ideas() {
  return (
    <SoundContext.Provider value={SOUND}>
      <div className="page ideas">
        <nav className="nav">
          <a className="brand" href="/">
            mackeys<span> / ideas</span>
          </a>
        </nav>
        <main>
          <Idea n={1} title="Press any key" note="Type on your keyboard, or tap a key. The page shows which key it was.">
            <KeyInspector />
          </Idea>
          <Idea n={2} title="Sound wall" note="Every click the keyboard and the trackpad can make, side by side.">
            <SoundWall />
          </Idea>
          <Idea n={3} title="Every color" note="One keyboard changes into each MacBook and iMac color.">
            <ColorMorph />
          </Idea>
          <Idea n={4} title="The whole desk" note="Press a key on one keyboard. It goes down on the other too.">
            <DeviceRow />
          </Idea>
        </main>
      </div>
    </SoundContext.Provider>
  );
}
