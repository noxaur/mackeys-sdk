import { useState } from 'react';
import { SoundContext } from './sound';
import { Intro } from './Intro';
import { KeyField } from './KeyField';
import { Nav } from './Nav';
import { Presets } from './Presets';
import { Sdks } from './Sdks';
import { Localisation } from './Localisation';
import { Footer } from './Footer';

const SOUND = { on: true, setOn: () => {} };

// The intro always plays over the top of the page, so a reload starts at the top too.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

export function App() {
  const [ready, setReady] = useState(false);
  return (
    <SoundContext.Provider value={SOUND}>
      {!ready && <Intro onDone={() => setReady(true)} />}
      <KeyField />
      <div className="page">
        <Nav />
        <main>
          <Presets />
          <Localisation active={ready} />
          <Sdks />
        </main>
        <Footer />
      </div>
    </SoundContext.Provider>
  );
}
