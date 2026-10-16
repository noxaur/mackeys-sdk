import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TypingDemo } from './TypingDemo';
import './styles.css';

// One static site. Each path loads its own page code, so the landing page stays small.
const path = location.pathname.replace(/\/+$/, '');
const root = createRoot(document.getElementById('root')!);
const PAGES: Record<string, () => Promise<React.ReactElement>> = {
  // /ideas holds prototype sections to compare.
  '/ideas': () => import('./ideas/Ideas').then(({ Ideas }) => <Ideas />),
  '/styles': () => import('./pages/Styles').then(({ Styles }) => <Styles />),
  '/languages': () => import('./pages/Languages').then(({ Languages }) => <Languages />),
  '/install': () => import('./pages/Install').then(({ Install }) => <Install />)
};
// /demo is the typing test, every other path is the landing page.
if (PAGES[path]) PAGES[path]().then((page) => root.render(page));
else root.render(path === '/demo' ? <TypingDemo /> : <App />);
