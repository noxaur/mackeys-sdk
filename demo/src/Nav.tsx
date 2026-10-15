export function Nav() {
  return (
    <nav className="nav">
      <a className="brand" href="#top">
        <span className="led" /> mackeys
      </a>
      <div className="links">
        <a href="#play">Playground</a>
        <a href="#sdks">SDKs</a>
        <a href="#languages">Languages</a>
        <a href="#styles">Styles</a>
        <a href="https://github.com/noxaur/mackeys-sdk" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </nav>
  );
}
