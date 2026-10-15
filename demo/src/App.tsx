import { useState } from 'react';
import { SoundContext } from './sound';
import { Intro } from './Intro';
import { KeyField } from './KeyField';
import { Nav } from './Nav';
import { Playground } from './Playground';
import { Sdks } from './Sdks';
import { Localisation } from './Localisation';
import { Styles } from './Styles';
import { Footer } from './Footer';

const SOUND = { on: true, setOn: () => {} };

export function App() {
  const [ready, setReady] = useState(false);
  return (
    <SoundContext.Provider value={SOUND}>
      {!ready && <Intro onDone={() => setReady(true)} />}
      <KeyField />
      <div className="page">
        <Nav />
        <main>
          <Playground active={ready} />
          <Sdks />
          <Localisation active={ready} />
          <Styles />
        </main>
        <Footer />
      </div>
    </SoundContext.Provider>
  );
}
