import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FINISHES, LAYOUTS, MacBook, MacKeyboard, MacTrackpad, stageColor, type FinishId, type LayoutId, type KeyEvent } from '@mackeys/react';

// URL parameters set the first state, for reference screenshots:
// ?finish=pro-space-black&layout=de&part=keyboard&on=1&level=16&room=dark&bare=1&scale=1&press=KeyA,ShiftLeft
const q = new URLSearchParams(location.search);

function App() {
  const [finish, setFinish] = useState<FinishId>((q.get('finish') as FinishId) || 'pro-space-black');
  const [layout, setLayout] = useState<LayoutId>((q.get('layout') as LayoutId) || 'en-us');
  const [view, setView] = useState<'top-down' | 'angled'>((q.get('view') as any) || 'top-down');
  const [part, setPart] = useState<'macbook' | 'keyboard' | 'trackpad'>((q.get('part') as any) || 'macbook');
  const [on, setOn] = useState(q.get('on') === '1');
  const [level, setLevel] = useState(+(q.get('level') ?? 12));
  const [room, setRoom] = useState<'daylight' | 'dark'>((q.get('room') as any) || 'daylight');
  const bare = q.get('bare') === '1';
  const scale = +(q.get('scale') ?? 0.9);
  const press = q.get('press')?.split(',') ?? [];
  const [last, setLast] = useState('');
  const backlight = { on, level, room };
  const onKeyDown = (e: KeyEvent) => setLast(e.label + ' (' + e.id + ')');
  return (
    <div style={{ minHeight: '100vh', background: stageColor(finish, backlight), color: room === 'dark' ? '#ddd' : '#222', fontFamily: 'system-ui', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ display: bare ? 'none' : 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <label>Part <select value={part} onChange={(e) => setPart(e.target.value as any)}><option value="macbook">MacBook</option><option value="keyboard">Keyboard</option><option value="trackpad">Trackpad</option></select></label>
        <label>Finish <select value={finish} onChange={(e) => setFinish(e.target.value as FinishId)}>{FINISHES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Layout <select value={layout} onChange={(e) => setLayout(e.target.value as LayoutId)}>{LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>View <select value={view} onChange={(e) => setView(e.target.value as any)}><option value="top-down">Top-down</option><option value="angled">Angled</option></select></label>
        <label><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Backlight</label>
        <label>Level <input type="range" min={0} max={16} value={level} onChange={(e) => setLevel(+e.target.value)} /></label>
        <label>Room <select value={room} onChange={(e) => setRoom(e.target.value as any)}><option value="daylight">Daylight</option><option value="dark">Dark room</option></select></label>
        <span>Last key: {last}</span>
      </div>
      {part === 'macbook' && <MacBook finish={finish} layout={layout} view={view} backlight={backlight} capture="window" scale={scale} highlight={press} onKeyDown={onKeyDown} />}
      {part === 'keyboard' && <MacKeyboard finish={finish} layout={layout} view={view} backlight={backlight} capture="window" scale={scale} highlight={press} onKeyDown={onKeyDown} />}
      {part === 'trackpad' && <MacTrackpad finish={finish} scale={scale} />}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
