import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TypingDemo } from './TypingDemo';
import './styles.css';

// One static site: /demo is the typing test, every other path is the landing page.
const demo = /^\/demo\/?$/.test(location.pathname);
createRoot(document.getElementById('root')!).render(demo ? <TypingDemo /> : <App />);
