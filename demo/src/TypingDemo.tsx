import { Component, createRef, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { FinishId, KeyboardController } from '@mackeys/react';
import { Device } from './Device';
import './demo.css';

/**
 * The typing test at /demo, ported from the "mackeys demo" artifact.
 * The page is the same; only the keyboard under the words is now the SDK keyboard, with its sounds.
 */

const WORDS = 'the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line'.split(' ');

const QUOTES = [
  { g: 'short', t: 'Brevity is the soul of wit.', s: 'William Shakespeare, Hamlet' },
  { g: 'short', t: 'All that glitters is not gold.', s: 'William Shakespeare, The Merchant of Venice' },
  { g: 'short', t: 'Be not afraid of greatness.', s: 'William Shakespeare, Twelfth Night' },
  { g: 'medium', t: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.', s: 'Charles Dickens, A Tale of Two Cities' },
  { g: 'medium', t: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', s: 'Jane Austen, Pride and Prejudice' },
  { g: 'long', t: 'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.', s: 'Herman Melville, Moby-Dick' },
  { g: 'long', t: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.', s: 'Abraham Lincoln, Gettysburg Address' },
  { g: 'thicc', t: 'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.', s: 'Abraham Lincoln, Gettysburg Address' }
];

interface Run { tab?: string; name: string; wpm: number; acc: number; raw: number; cons: number; date: string; you?: boolean }
const mk = (name: string, wpm: number, acc: number, raw: number, cons: number, date: string): Run => ({ name, wpm, acc, raw, cons, date });
const LB: Record<string, Run[]> = {
  time15: [mk('kestrel', 212.8, 99.1, 216.4, 81.2, 'today'), mk('nullbyte', 205.6, 98.4, 209.9, 78.5, '11 oct'), mk('mira_k', 198.4, 100, 198.4, 84.0, 'today'), mk('oxide', 191.2, 97.6, 196.0, 76.3, '2 oct'), mk('ferngully', 187.6, 98.9, 190.1, 79.9, 'today'), mk('tachyon', 182.4, 96.8, 188.8, 72.1, '28 sep'), mk('lumen', 179.2, 99.4, 180.3, 83.6, '14 oct'), mk('quill', 175.6, 98.0, 179.2, 77.0, 'today'), mk('birch', 171.2, 97.3, 176.0, 74.8, '9 oct'), mk('sable', 168.8, 99.0, 170.4, 80.2, '13 oct')],
  time60: [mk('nullbyte', 184.3, 98.7, 187.5, 82.4, '12 oct'), mk('kestrel', 181.9, 99.2, 183.6, 85.1, 'today'), mk('oxide', 176.4, 97.9, 180.2, 79.6, '7 oct'), mk('mira_k', 172.0, 99.6, 172.8, 86.3, 'today'), mk('lumen', 165.7, 99.1, 167.2, 84.7, '30 sep'), mk('quill', 161.2, 98.3, 164.0, 81.0, 'today'), mk('tachyon', 158.8, 97.0, 163.5, 76.9, '14 oct'), mk('birch', 154.1, 98.6, 156.3, 80.8, '10 oct'), mk('sable', 150.6, 99.3, 151.7, 83.2, 'today'), mk('ferngully', 147.9, 98.1, 150.4, 79.4, '5 oct')]
};

/** The keyboard picker: one dark finish of each model. */
const MODELS: { id: string; finish: FinishId }[] = [
  { id: 'air', finish: 'air-midnight' },
  { id: 'pro', finish: 'pro-space-black' },
  { id: 'neo', finish: 'neo-indigo' },
  { id: 'magic', finish: 'imac-silver' }
];

const ACCENT = '#79d2a6';
const C = { text: '#d8d6cf', sub: '#666a72', err: '#ec7c6a', extra: '#b05a4d', dim: '#8b8e95' };

type Mode = 'time' | 'words' | 'quote' | 'zen' | 'custom';
interface Cfg { mode: Mode; timeOpt: number; wordsOpt: number; quoteOpt: string; punct: boolean; nums: boolean; customText: string }
interface Result { wpm: number; acc: string; avgY: string | number; pts: string; label: string; saved: boolean; hasSource: boolean; source: string; stats: { label: string; value: string }[] }
interface State extends Cfg {
  view: 'type' | 'board';
  model: string;
  focused: boolean;
  customEditing: boolean;
  customDraft: string;
  runs: Run[];
  lbTab: string;
  lbScope: string;
  typed: string[];
  idx: number;
  started: boolean;
  finished: boolean;
  startTime: number;
  now: number;
  keys: number;
  goodKeys: number;
  samples: number[];
  typedChars: number;
  result: Result | null;
  words: string[];
  quoteSrc: string;
  width: number;
  height: number;
}

const rnd = (n: number) => Math.floor(Math.random() * n);

function gen(n: number, punct: boolean, nums: boolean) {
  const out: string[] = [];
  let cap = true;
  let prev = '';
  for (let i = 0; i < n; i++) {
    let w: string;
    if (nums && Math.random() < 0.1) {
      w = String(rnd(Math.pow(10, 1 + rnd(4))));
    } else {
      do w = WORDS[rnd(WORDS.length)];
      while (w === prev);
      prev = w;
      if (punct) {
        if (cap) w = w[0].toUpperCase() + w.slice(1);
        cap = false;
        const r = Math.random();
        if (r < 0.08) {
          w += '.';
          cap = true;
        } else if (r < 0.1) {
          w += '?';
          cap = true;
        } else if (r < 0.115) {
          w += '!';
          cap = true;
        } else if (r < 0.2) w += ',';
      }
    }
    out.push(w);
  }
  return out;
}

function target(cfg: Cfg) {
  if (cfg.mode === 'time') return { words: gen(120, cfg.punct, cfg.nums), quoteSrc: '' };
  if (cfg.mode === 'words') return { words: gen(cfg.wordsOpt, cfg.punct, cfg.nums), quoteSrc: '' };
  if (cfg.mode === 'quote') {
    const pool = QUOTES.filter((q) => cfg.quoteOpt === 'all' || q.g === cfg.quoteOpt);
    const q = pool[rnd(pool.length)];
    return { words: q.t.split(' '), quoteSrc: q.s };
  }
  if (cfg.mode === 'zen') return { words: [] as string[], quoteSrc: '' };
  const t = cfg.customText.trim().split(/\s+/).filter(Boolean);
  return { words: t.length ? t : ['empty'], quoteSrc: '' };
}

const blank = () => ({ typed: [''], idx: 0, started: false, finished: false, startTime: 0, now: 0, keys: 0, goodKeys: 0, samples: [] as number[], typedChars: 0, result: null });
const fresh = (cfg: Cfg) => ({ ...cfg, ...blank(), ...target(cfg) });

interface Btn { label: string; on: boolean; pick: () => void }
function Pills({ list, h = 28 }: { list: Btn[]; h?: number }) {
  return (
    <>
      {list.map((b) => (
        <button key={b.label} className="td-pill" aria-pressed={b.on} onClick={b.pick} style={{ minHeight: h, color: b.on ? ACCENT : C.dim }}>
          {b.label}
        </button>
      ))}
    </>
  );
}

const Sep = () => <div style={{ width: 3, height: 18, borderRadius: 2, background: '#2a2b30', alignSelf: 'center' }} />;

export class TypingDemo extends Component<object, State> {
  timer = 0;
  input = createRef<HTMLInputElement>();
  kbd = createRef<KeyboardController>();

  constructor(props: object) {
    super(props);
    const cfg: Cfg = { mode: 'time', timeOpt: 30, wordsOpt: 25, quoteOpt: 'all', punct: false, nums: false, customText: 'the quick brown fox jumps over the lazy dog' };
    this.state = { view: 'type', model: 'air', focused: false, customEditing: false, customDraft: '', runs: [], lbTab: 'time15', lbScope: 'all', width: window.innerWidth, height: window.innerHeight, ...fresh(cfg) };
  }

  componentDidMount() {
    document.title = 'mackeys demo';
    if (!document.getElementById('td-font')) {
      const l = document.createElement('link');
      l.id = 'td-font';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap';
      document.head.appendChild(l);
    }
    setTimeout(() => this.focus(), 60);
    window.addEventListener('resize', this.onResize);
  }
  componentWillUnmount() {
    clearInterval(this.timer);
    window.removeEventListener('resize', this.onResize);
  }
  onResize = () => this.setState({ width: window.innerWidth, height: window.innerHeight });
  focus = () => setTimeout(() => this.input.current?.focus(), 0);

  cfgOf(): Cfg {
    const s = this.state;
    return { mode: s.mode, timeOpt: s.timeOpt, wordsOpt: s.wordsOpt, quoteOpt: s.quoteOpt, punct: s.punct, nums: s.nums, customText: s.customText };
  }
  setCfg(patch: Partial<Cfg>) {
    clearInterval(this.timer);
    this.setState({ view: 'type', ...fresh({ ...this.cfgOf(), ...patch }) });
    this.focus();
  }
  restart = () => this.setCfg({});
  repeat = () => {
    clearInterval(this.timer);
    this.setState({ view: 'type', ...blank() });
    this.focus();
  };

  startTimer() {
    clearInterval(this.timer);
    this.timer = window.setInterval(this.tick, 100);
  }
  tick = () => {
    const s = this.state;
    if (!s.started || s.finished) return;
    const el = (Date.now() - s.startTime) / 1000;
    let samples = s.samples;
    if (Math.floor(el) > samples.length) samples = samples.concat([s.typedChars]);
    if (s.mode === 'time' && el >= s.timeOpt) {
      this.finish(samples);
      return;
    }
    this.setState({ now: Date.now(), samples });
  };

  onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const s = this.state;
    const k = e.key;
    this.kbd.current?.handleKeyDown(e.nativeEvent);
    if (k === 'Tab') {
      e.preventDefault();
      this.restart();
      return;
    }
    if (s.view !== 'type' || s.customEditing) return;
    if (s.finished) {
      if (k === 'Enter') {
        e.preventDefault();
        this.restart();
      }
      return;
    }
    if (k === 'Enter' && e.shiftKey && s.mode === 'zen') {
      e.preventDefault();
      if (s.started) this.finish();
      return;
    }
    if (k === 'Backspace') {
      e.preventDefault();
      this.back(e.ctrlKey || e.altKey || e.metaKey);
      return;
    }
    if (e.metaKey || e.ctrlKey) return;
    if (k === ' ') {
      e.preventDefault();
      this.space();
      return;
    }
    if (k.length === 1) {
      e.preventDefault();
      this.char(k);
    }
  };
  onKeyUp = (e: ReactKeyboardEvent<HTMLInputElement>) => this.kbd.current?.handleKeyUp(e.nativeEvent);
  onFocus = () => this.setState({ focused: true });
  onBlur = () => {
    this.kbd.current?.releaseAll();
    this.setState({ focused: false });
  };

  char(k: string) {
    const s = this.state;
    const patch: Partial<State> = {};
    if (!s.started) {
      patch.started = true;
      patch.startTime = Date.now();
      this.startTimer();
    }
    const typed = s.typed.slice();
    const cur = typed[s.idx];
    const tgt = s.mode === 'zen' ? null : s.words[s.idx];
    if (tgt !== null && cur.length >= tgt.length + 10) return;
    typed[s.idx] = cur + k;
    const good = tgt === null || tgt[cur.length] === k;
    patch.typed = typed;
    patch.keys = s.keys + 1;
    patch.goodKeys = s.goodKeys + (good ? 1 : 0);
    patch.typedChars = s.typedChars + 1;
    const last = tgt !== null && s.mode !== 'time' && s.idx === s.words.length - 1 && typed[s.idx] === tgt;
    this.setState(patch as State, () => {
      if (last) this.finish();
    });
  }
  space() {
    const s = this.state;
    if (!s.started) return;
    const cur = s.typed[s.idx];
    if (cur === '') return;
    const patch: Partial<State> = { typed: s.typed.concat(['']), idx: s.idx + 1, keys: s.keys + 1, typedChars: s.typedChars + 1 };
    if (s.mode === 'zen') {
      patch.goodKeys = s.goodKeys + 1;
      this.setState(patch as State);
      return;
    }
    patch.goodKeys = s.goodKeys + (cur === s.words[s.idx] ? 1 : 0);
    if (s.mode !== 'time' && s.idx === s.words.length - 1) {
      this.finish();
      return;
    }
    if (s.mode === 'time' && s.idx > s.words.length - 40) patch.words = s.words.concat(gen(60, s.punct, s.nums));
    this.setState(patch as State);
  }
  back(word: boolean) {
    const s = this.state;
    const typed = s.typed.slice();
    const cur = typed[s.idx];
    if (cur === '') {
      if (s.idx === 0) return;
      typed.pop();
      if (word) typed[s.idx - 1] = '';
      this.setState({ typed, idx: s.idx - 1 });
      return;
    }
    typed[s.idx] = word ? '' : cur.slice(0, -1);
    this.setState({ typed });
  }

  finish(samplesIn?: number[]) {
    clearInterval(this.timer);
    const s = this.state;
    const el = s.mode === 'time' ? s.timeOpt : Math.max(0.5, (Date.now() - s.startTime) / 1000);
    const samples = (samplesIn || s.samples).slice();
    if (!samples.length || samples[samples.length - 1] < s.typedChars) samples.push(s.typedChars);
    const zen = s.mode === 'zen';
    const c = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
    let wordChars = 0;
    const last = s.idx;
    for (let i = 0; i <= last; i++) {
      const t = s.typed[i] || '';
      const w = zen ? t : s.words[i] || '';
      if (i === last && t === '') continue;
      for (let j = 0; j < Math.max(t.length, w.length); j++) {
        if (j < t.length && j < w.length) {
          if (t[j] === w[j]) c.correct++;
          else c.incorrect++;
        } else if (j < t.length) c.extra++;
        else if (i < last) c.missed++;
      }
      if (t === w) wordChars += w.length + (i < last ? 1 : 0);
      else if (i === last && s.mode === 'time' && w.indexOf(t) === 0) wordChars += t.length;
    }
    const min = el / 60;
    const wpm = wordChars / 5 / min;
    const raw = s.typedChars / 5 / min;
    const acc = s.keys ? (s.goodKeys / s.keys) * 100 : 0;
    let rates: number[] = [];
    for (let n = 0; n < samples.length; n++) rates.push((samples[n] - (n ? samples[n - 1] : 0)) * 12);
    if (rates.length < 2) rates = [raw, raw];
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rates.length);
    const cons = mean ? Math.max(0, 100 - (sd / mean) * 100) : 0;
    const maxY = Math.max(...rates, wpm, 10) * 1.15;
    const pts = rates.map((r, idx) => ((idx / (rates.length - 1)) * 600).toFixed(1) + ',' + (160 - (r / maxY) * 160).toFixed(1)).join(' ');
    let label: string = s.mode === 'time' ? 'time ' + s.timeOpt : s.mode === 'words' ? 'words ' + s.wordsOpt : s.mode === 'quote' ? 'quote ' + s.quoteOpt : s.mode;
    if ((s.mode === 'time' || s.mode === 'words') && s.punct) label += ' punctuation';
    if ((s.mode === 'time' || s.mode === 'words') && s.nums) label += ' numbers';
    const saved = s.mode === 'time' && (s.timeOpt === 15 || s.timeOpt === 60) && !s.punct && !s.nums;
    let runs = s.runs;
    if (saved) runs = runs.concat([{ tab: 'time' + s.timeOpt, name: 'you', wpm, acc, raw, cons, date: 'today', you: true }]);
    this.setState({
      finished: true,
      samples,
      runs,
      result: {
        wpm: Math.round(wpm),
        acc: Math.round(acc) + '%',
        avgY: (160 - (wpm / maxY) * 160).toFixed(1),
        pts,
        label,
        saved,
        hasSource: !!s.quoteSrc,
        source: s.quoteSrc,
        stats: [
          { label: 'test type', value: label },
          { label: 'raw', value: String(Math.round(raw)) },
          { label: 'characters', value: c.correct + '/' + c.incorrect + '/' + c.extra + '/' + c.missed },
          { label: 'consistency', value: Math.round(cons) + '%' },
          { label: 'time', value: Math.round(el) + 's' }
        ]
      }
    });
  }

  btn(label: string, on: boolean, pick: () => void): Btn {
    return { label, on, pick };
  }

  render() {
    const s = this.state;
    const zen = s.mode === 'zen';
    const running = s.started && !s.finished;

    const tw = zen ? s.typed : s.words;
    const narrow = s.width < 760;
    // Line breaks use the target words only, so typing never moves a word to another line.
    // Room is left at the end of each line for extra letters.
    const LINE = narrow ? 24 : 44;
    const lines: number[][] = [];
    let cur: number[] = [];
    let len = 0;
    for (let i = 0; i < tw.length; i++) {
      const wl = tw[i].length;
      if (len && len + 1 + wl > LINE) {
        lines.push(cur);
        cur = [];
        len = 0;
      }
      cur.push(i);
      len += (len ? 1 : 0) + wl;
    }
    if (cur.length || !lines.length) lines.push(cur);
    let curLine = 0;
    lines.forEach((l, n) => {
      if (l.indexOf(s.idx) >= 0) curLine = n;
    });
    if (zen && s.idx >= tw.length) curLine = lines.length - 1;
    let caretX = 0;
    const vis = lines.map((l, n) =>
      l.map((wi) => {
        const w = tw[wi];
        const t = s.typed[wi] || '';
        const isCur = wi === s.idx;
        const past = wi < s.idx;
        const letters: { ch: string; color: string }[] = [];
        for (let j = 0; j < Math.max(w.length, t.length); j++) {
          let color = C.sub;
          if (j < t.length) color = j >= w.length ? C.extra : t[j] === w[j] ? C.text : C.err;
          letters.push({ ch: j < w.length ? w[j] : t[j], color });
        }
        if (n === curLine && wi < s.idx) caretX += letters.length + 1;
        if (isCur) caretX += t.length;
        const wrong = past && !zen && t !== w;
        return { wi, letters, deco: wrong ? 'underline 2px ' + C.err : 'none' };
      })
    );

    const el = running ? Math.max(0, ((s.now || s.startTime) - s.startTime) / 1000) : 0;
    const counter = s.mode === 'time' ? String(Math.max(0, Math.ceil(s.timeOpt - el))) : zen ? String(Math.floor(el)) : s.idx + '/' + s.words.length;

    const withToggles = s.mode === 'time' || s.mode === 'words';
    const toggles = [this.btn('@ punctuation', s.punct, () => this.setCfg({ punct: !s.punct })), this.btn('# numbers', s.nums, () => this.setCfg({ nums: !s.nums }))];
    const modes = (['time', 'words', 'quote', 'zen', 'custom'] as Mode[]).map((m) =>
      this.btn(m, s.mode === m, () => {
        this.setState({ customEditing: false });
        this.setCfg({ mode: m });
      })
    );
    let opts: Btn[] = [];
    if (s.mode === 'time') opts = [15, 30, 60, 120].map((v) => this.btn(String(v), s.timeOpt === v, () => this.setCfg({ timeOpt: v })));
    if (s.mode === 'words') opts = [10, 25, 50, 100].map((v) => this.btn(String(v), s.wordsOpt === v, () => this.setCfg({ wordsOpt: v })));
    if (s.mode === 'quote') opts = ['all', 'short', 'medium', 'long', 'thicc'].map((v) => this.btn(v, s.quoteOpt === v, () => this.setCfg({ quoteOpt: v })));
    if (s.mode === 'custom') opts = [this.btn('change', s.customEditing, () => this.setState({ customEditing: !s.customEditing, customDraft: s.customText }))];

    const models = MODELS.map((m) =>
      this.btn(m.id, s.model === m.id, () => {
        this.setState({ model: m.id });
        this.focus();
      })
    );
    const finish = MODELS.find((m) => m.id === s.model)!.finish;
    // The keyboard fits the width of the page and the room under the words, so the test needs no scroll.
    const kbScale = Math.max(0.45, Math.min(0.82, (Math.min(1040, s.width - 64) - 24) / 1100, (s.height - 620) / 470));

    const tab = s.lbTab;
    const rows = LB[tab]
      .concat(s.runs.filter((r) => r.tab === tab))
      .filter((r) => s.lbScope === 'all' || r.date === 'today')
      .sort((a, b) => b.wpm - a.wpm);

    const showTest = s.view === 'type' && !s.finished && !s.customEditing;
    const r = s.result;
    const goType = () => {
      this.setState({ view: 'type' });
      this.focus();
    };
    const goBoard = () => {
      clearInterval(this.timer);
      if (s.finished) this.setState({ view: 'board' });
      else this.setState({ view: 'board', ...blank() });
    };
    const lbCols = '56px minmax(0, 1fr) 96px 96px 96px 120px 110px';

    return (
      <div className="td">
        <header className="td-head">
          <a href="/" aria-label="mackeys, home" style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
            <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: C.text }}>
              mackeys<span style={{ color: C.sub }}> demo</span>
            </span>
          </a>
          <nav style={{ display: 'flex', gap: 4 }}>
            <button className="td-icon" onClick={goType} aria-label="typing test" style={{ color: s.view === 'type' ? C.text : C.dim }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="4" />
                <path d="M12 8v8M9.5 8h5M9.5 16h5" />
              </svg>
            </button>
            <button className="td-icon" onClick={goBoard} aria-label="leaderboard" style={{ color: s.view === 'board' ? C.text : C.dim }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="13" width="5" height="7" rx="1.5" />
                <rect x="9.5" y="7" width="5" height="13" rx="1.5" />
                <rect x="16" y="10" width="5" height="10" rx="1.5" />
              </svg>
            </button>
          </nav>
        </header>

        <main className="td-main">
          {s.view === 'type' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', opacity: running ? 0 : 1, transition: 'opacity .25s' }}>
                <div className="td-bar">
                  {withToggles && (
                    <>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <Pills list={toggles} />
                      </div>
                      <Sep />
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 14 }}>
                    <Pills list={modes} />
                  </div>
                  {opts.length > 0 && (
                    <>
                      <Sep />
                      <div style={{ display: 'flex', gap: 14 }}>
                        <Pills list={opts} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {s.customEditing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720, width: '100%', margin: '0 auto' }}>
                  <label htmlFor="customText" style={{ fontSize: 12, color: C.dim }}>
                    custom text
                  </label>
                  <textarea id="customText" value={s.customDraft} onChange={(e) => this.setState({ customDraft: e.target.value })} rows={4} className="td-text" />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, fontSize: 13 }}>
                    <button
                      className="td-pill"
                      onClick={() => {
                        this.setState({ customEditing: false });
                        this.focus();
                      }}
                      style={{ minHeight: 36, color: C.dim }}
                    >
                      cancel
                    </button>
                    <button
                      className="td-pill"
                      onClick={() => {
                        this.setState({ customEditing: false });
                        this.setCfg({ customText: s.customDraft });
                      }}
                      style={{ minHeight: 36, color: ACCENT }}
                    >
                      apply
                    </button>
                  </div>
                </div>
              )}

              {showTest && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 900, margin: '0 auto' }}>
                  <div style={{ height: 32, fontSize: 24, color: ACCENT, opacity: running ? 1 : 0 }}>{counter}</div>
                  <div style={{ position: 'relative' }}>
                    <div className="td-words" style={{ height: 138, overflow: 'hidden' }}>
                      <div style={{ position: 'relative', transform: `translateY(${-Math.max(0, curLine - 1) * 46}px)`, transition: 'transform .18s ease-out' }}>
                        {vis.map((line, n) => (
                          <div key={n} style={{ height: 46, display: 'flex', alignItems: 'center', gap: '0 1ch', whiteSpace: 'nowrap' }}>
                            {line.map((w) => (
                              <span key={w.wi} style={{ textDecoration: w.deco, textUnderlineOffset: 8 }}>
                                {w.letters.map((l, j) => (
                                  <span key={j} style={{ color: l.color }}>
                                    {l.ch}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        ))}
                        <span className={running ? 'td-caret' : 'td-caret idle'} style={{ left: caretX + 'ch', top: curLine * 46 + 8, background: ACCENT }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {s.finished && r && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: '100%', maxWidth: 900, margin: '0 auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: '24px 40px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 20, color: C.dim }}>wpm</div>
                      <div style={{ fontSize: 64, lineHeight: 1, color: ACCENT }}>{r.wpm}</div>
                      <div style={{ fontSize: 20, color: C.dim, marginTop: 16 }}>acc</div>
                      <div style={{ fontSize: 64, lineHeight: 1, color: ACCENT }}>{r.acc}</div>
                    </div>
                    <svg viewBox="0 0 600 160" preserveAspectRatio="none" style={{ width: '100%', height: 160, overflow: 'visible' }} role="img" aria-label="speed during the test">
                      <line x1="0" x2="600" y1={r.avgY} y2={r.avgY} stroke="#34363c" strokeWidth="1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                      <polyline points={r.pts} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 48px' }}>
                    {r.stats.map((st) => (
                      <div key={st.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13, color: C.dim }}>{st.label}</div>
                        <div style={{ fontSize: 22, color: ACCENT }}>{st.value}</div>
                      </div>
                    ))}
                  </div>
                  {r.hasSource && <div style={{ fontSize: 13, color: C.dim }}>source: {r.source}</div>}
                  {r.saved && <div style={{ fontSize: 13, color: C.dim }}>saved to the {r.label} leaderboard</div>}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                    <button className="td-icon" onClick={this.restart} aria-label="next test" style={{ width: 52, color: C.dim }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                    <button className="td-icon" onClick={this.repeat} aria-label="repeat test" style={{ width: 52, color: C.dim }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 3-6.7" />
                        <path d="M3 4v5h5" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div style={{ position: 'relative', height: 0 }}>
                <input
                  ref={this.input}
                  aria-label="typing input"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onKeyDown={this.onKeyDown}
                  onKeyUp={this.onKeyUp}
                  onFocus={this.onFocus}
                  onBlur={this.onBlur}
                  style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: showTest ? 184 : 1, opacity: 0, border: 0, padding: 0, cursor: 'default' }}
                />
              </div>

              {showTest && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 12 }}>
                  <div className="td-kb" aria-hidden="true">
                    <Device ref={this.kbd} finish={finish} layout="en-us" sound scale={kbScale} inert />
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <Pills list={models} />
                  </div>
                </div>
              )}
            </>
          )}

          {s.view === 'board' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px 24px' }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>leaderboard</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13 }}>
                  <Pills
                    h={32}
                    list={[this.btn('time 15', tab === 'time15', () => this.setState({ lbTab: 'time15' })), this.btn('time 60', tab === 'time60', () => this.setState({ lbTab: 'time60' }))]}
                  />
                  <Sep />
                  <Pills
                    h={32}
                    list={[this.btn('all-time', s.lbScope === 'all', () => this.setState({ lbScope: 'all' })), this.btn('daily', s.lbScope === 'daily', () => this.setState({ lbScope: 'daily' }))]}
                  />
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 680, display: 'flex', flexDirection: 'column', fontSize: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: lbCols, gap: 12, padding: '10px 16px', fontSize: 12, color: C.dim }}>
                    <span>#</span>
                    <span>name</span>
                    <span style={{ textAlign: 'right' }}>wpm</span>
                    <span style={{ textAlign: 'right' }}>acc</span>
                    <span style={{ textAlign: 'right' }}>raw</span>
                    <span style={{ textAlign: 'right' }}>consistency</span>
                    <span style={{ textAlign: 'right' }}>date</span>
                  </div>
                  {rows.map((row, n) => (
                    <div key={n} style={{ display: 'grid', gridTemplateColumns: lbCols, gap: 12, padding: '12px 16px', borderRadius: 6, background: n % 2 === 0 ? '#1b1c20' : 'transparent', color: row.you ? ACCENT : C.text }}>
                      <span>{n + 1}</span>
                      <span>{row.name}</span>
                      <span style={{ textAlign: 'right' }}>{row.wpm.toFixed(2)}</span>
                      <span style={{ textAlign: 'right' }}>{row.acc.toFixed(2)}%</span>
                      <span style={{ textAlign: 'right' }}>{row.raw.toFixed(2)}</span>
                      <span style={{ textAlign: 'right' }}>{row.cons.toFixed(2)}%</span>
                      <span style={{ textAlign: 'right', color: C.dim }}>{row.date}</span>
                    </div>
                  ))}
                  {rows.length === 0 && <div style={{ padding: '32px 16px', color: C.dim }}>No results today. Finish a time 15 or time 60 test to add one.</div>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>Sample data. Your time 15 and time 60 results show in accent color.</div>
            </div>
          )}
        </main>

        <footer className="td-foot">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
            <span>
              <kbd>tab</kbd> restart
            </span>
            <span>
              <kbd>shift</kbd> + <kbd>enter</kbd> end zen
            </span>
          </div>
          <div>
            keyboard by <a href="https://www.npmjs.com/package/@mackeys/react">@mackeys/react</a>
          </div>
        </footer>
      </div>
    );
  }
}
