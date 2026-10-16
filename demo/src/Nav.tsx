import { DEMO, INSTALL, LANGUAGES, REPO, STYLES } from './links';

export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="/" aria-label="mackeys sdk, home">
        mackeys<span> / sdk</span>
      </a>
      <div className="links">
        <a href={STYLES}>Styles</a>
        <a className="opt" href={LANGUAGES}>Languages</a>
        <a className="opt" href={INSTALL}>Install</a>
        <a href={DEMO}>Demo</a>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </nav>
  );
}
