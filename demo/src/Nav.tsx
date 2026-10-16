import { DEMO, REPO } from './links';

export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="#top" aria-label="mackeys sdk, back to top">
        mackeys<span> / sdk</span>
      </a>
      <div className="links">
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
