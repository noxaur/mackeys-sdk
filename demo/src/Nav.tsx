import { DEMO, REPO, STYLES } from './links';

export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href={location.pathname === '/' ? '#top' : '/'} aria-label="mackeys sdk, home">
        mackeys<span> / sdk</span>
      </a>
      <div className="links">
        <a href={STYLES} aria-current={location.pathname.startsWith(STYLES) ? 'page' : undefined}>
          Styles
        </a>
        <a href={DEMO}>
          Demo
        </a>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="/llms.txt">llms.txt</a>
      </div>
    </nav>
  );
}
