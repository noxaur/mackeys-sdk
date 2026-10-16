import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TypingDemo } from './TypingDemo';
import { StylesPage } from './StylesPage';
import './styles.css';

// One static site: /demo is the typing test, /styles shows every style, every other path is the landing page.
const path = location.pathname.replace(/\/+$/, '');
createRoot(document.getElementById('root')!).render(path === '/demo' ? <TypingDemo /> : path === '/styles' ? <StylesPage /> : <App />);
