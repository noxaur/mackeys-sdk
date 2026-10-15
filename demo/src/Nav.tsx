import { DEMO, REPO } from './links';

export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="#top" aria-label="mackeys sdk, back to top">
        mackeys<span> / sdk</span>
      </a>
      <div className="links">
        <a href="#top">Styles</a>
        <a href="#languages">Languages</a>
        <a href="#get">Get it</a>
        <a href={DEMO} target="_blank" rel="noreferrer">
          Demo
        </a>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </nav>
  );
}
