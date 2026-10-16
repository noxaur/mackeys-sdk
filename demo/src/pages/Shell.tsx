import { useEffect, type ReactNode } from 'react';
import { SoundContext } from '../sound';
import { Nav } from '../Nav';
import { Footer } from '../Footer';
import './pages.css';

const SOUND = { on: true, setOn: () => {} };

/** The frame of every inner page: the nav, a heading, the content and the footer. */
export function Shell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · MacKeys`;
  }, [title]);
  return (
    <SoundContext.Provider value={SOUND}>
      <div className="page inner">
        <Nav />
        <main>
          <section className="inner-head">
            <div className="wrap">
              <h1>{title}</h1>
              <p>{lead}</p>
            </div>
          </section>
          {children}
        </main>
        <Footer />
      </div>
    </SoundContext.Provider>
  );
}
