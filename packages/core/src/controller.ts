// Framework-free state machines for the keyboard and the trackpad. Renderers subscribe to them.
import type { KeyCap, KeySound } from './keyboard';

export type InputSource = 'pointer' | 'keyboard' | 'api';

export interface KeyEvent {
  type: 'press' | 'release';
  id: string;
  label: string;
  sound: KeySound;
  source: InputSource;
}

export interface KeyboardState {
  /** Ids of the keys that are down. */
  down: ReadonlySet<string>;
  caps: boolean;
  /** True while the idle timer has switched the backlight off. */
  idle: boolean;
}

export interface SoundSink {
  key(kind: KeySound, up: boolean): void;
  trackpad(kind: 'press' | 'release' | 'force'): void;
}

export interface KeyboardControllerOptions {
  keys?: KeyCap[];
  sound?: SoundSink | null;
  /** Switch the backlight off after this many ms without a key press. Null or 0 = never. */
  idleOffMs?: number | null;
  /** How long a synthetic tap (caps lock) holds the key down. */
  tapMs?: number;
}

/** System Settings idle delays for "Turn keyboard backlight off after inactivity". */
export const IDLE_DELAYS: Record<string, number | null> = {
  never: null,
  '5s': 5e3,
  '10s': 1e4,
  '30s': 3e4,
  '1m': 6e4,
  '5m': 3e5
};

export interface KeyDownInput {
  code: string;
  repeat?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

type Listener<T> = (v: T) => void;

export class KeyboardController {
  private down = new Set<string>();
  private caps = false;
  private idle = false;
  private keys = new Map<string, KeyCap>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private stateListeners = new Set<Listener<KeyboardState>>();
  private eventListeners = new Set<Listener<KeyEvent>>();
  private snapshot: KeyboardState;
  sound: SoundSink | null;
  idleOffMs: number | null;
  tapMs: number;

  constructor(opts: KeyboardControllerOptions = {}) {
    this.sound = opts.sound ?? null;
    this.idleOffMs = opts.idleOffMs ?? null;
    this.tapMs = opts.tapMs ?? 110;
    if (opts.keys) this.setKeys(opts.keys);
    this.snapshot = this.makeSnapshot();
    this.armIdle();
  }

  setKeys(keys: KeyCap[]) {
    this.keys = new Map(keys.map((k) => [k.id, k]));
  }

  setIdleOff(ms: number | null) {
    this.idleOffMs = ms;
    this.armIdle();
  }

  getState(): KeyboardState {
    return this.snapshot;
  }

  /** Subscribes to state changes. Returns an unsubscribe function. */
  subscribe(fn: Listener<KeyboardState>): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  /** Subscribes to key presses and releases. Returns an unsubscribe function. */
  onKey(fn: Listener<KeyEvent>): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  has(id: string) {
    return this.keys.has(id);
  }

  isDown(id: string) {
    return this.down.has(id);
  }

  press(id: string, source: InputSource = 'api') {
    if (this.down.has(id)) return;
    const k = this.keys.get(id);
    const kind = k?.sound ?? 'key';
    this.sound?.key(kind, false);
    this.down.add(id);
    if (id === 'CapsLock') this.caps = !this.caps;
    this.idle = false;
    this.emit({ type: 'press', id, label: k?.label ?? id, sound: kind, source });
    this.armIdle();
  }

  release(id: string, source: InputSource = 'api') {
    if (!this.down.has(id)) return;
    const k = this.keys.get(id);
    const kind = k?.sound ?? 'key';
    this.sound?.key(kind, true);
    this.down.delete(id);
    this.emit({ type: 'release', id, label: k?.label ?? id, sound: kind, source });
  }

  /** Presses a key and lets go after `tapMs`. */
  tap(id: string, source: InputSource = 'api') {
    this.press(id, source);
    const t = setTimeout(() => {
      this.timers.delete(t);
      this.release(id, source);
    }, this.tapMs);
    this.timers.add(t);
  }

  releaseAll(source: InputSource = 'api') {
    if (!this.down.size) return;
    this.sound?.key('key', true);
    const ids = [...this.down];
    this.down.clear();
    ids.forEach((id) => this.emitOnly({ type: 'release', id, label: this.keys.get(id)?.label ?? id, sound: this.keys.get(id)?.sound ?? 'key', source }));
    this.notify();
  }

  setCaps(on: boolean) {
    if (this.caps === on) return;
    this.caps = on;
    this.notify();
  }

  /**
   * Feeds a physical key down. Returns true when the host should call `preventDefault()`:
   * every known key except Tab and command or control chords.
   */
  handleKeyDown(e: KeyDownInput): boolean {
    const id = e.code;
    if (!this.keys.has(id)) return false;
    const chord = (e.metaKey || e.ctrlKey) && !/^(Meta|Control|Alt|Shift)/.test(id);
    const prevent = !chord && id !== 'Tab';
    // macOS sends one key down when caps lock turns on and one key up when it turns off.
    if (id === 'CapsLock') {
      this.tap(id, 'keyboard');
      return prevent;
    }
    if (e.repeat) return prevent;
    this.press(id, 'keyboard');
    return prevent;
  }

  handleKeyUp(e: { code: string }) {
    const id = e.code;
    if (id === 'CapsLock') {
      this.tap(id, 'keyboard');
      return;
    }
    // macOS sends no key up for keys typed while command is held, so command's release lets go of everything.
    if (id === 'MetaLeft' || id === 'MetaRight') {
      this.releaseAll('keyboard');
      return;
    }
    if (this.keys.has(id)) this.release(id, 'keyboard');
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.stateListeners.clear();
    this.eventListeners.clear();
  }

  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.idleOffMs)
      this.idleTimer = setTimeout(() => {
        this.idle = true;
        this.notify();
      }, this.idleOffMs);
  }

  private emit(ev: KeyEvent) {
    this.emitOnly(ev);
    this.notify();
  }

  private emitOnly(ev: KeyEvent) {
    this.eventListeners.forEach((fn) => fn(ev));
  }

  private makeSnapshot(): KeyboardState {
    return { down: new Set(this.down), caps: this.caps, idle: this.idle };
  }

  private notify() {
    this.snapshot = this.makeSnapshot();
    this.stateListeners.forEach((fn) => fn(this.snapshot));
  }
}

// ---- Trackpad -----------------------------------------------------------------------------------

export type TrackpadPhase = 'up' | 'down' | 'force';

export interface TrackpadEvent {
  type: 'press' | 'force' | 'release';
  source: InputSource;
}

export interface TrackpadControllerOptions {
  sound?: SoundSink | null;
  /** Hold time before a press becomes a force click. Default 500 ms. */
  forceDelayMs?: number;
}

/**
 * The trackpad never moves: a haptic engine clicks it. A press clicks, holding past the force threshold
 * gives a deeper force click, and lifting gives a lighter release click.
 */
export class TrackpadController {
  private phase: TrackpadPhase = 'up';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stateListeners = new Set<Listener<TrackpadPhase>>();
  private eventListeners = new Set<Listener<TrackpadEvent>>();
  sound: SoundSink | null;
  forceDelayMs: number;

  constructor(opts: TrackpadControllerOptions = {}) {
    this.sound = opts.sound ?? null;
    this.forceDelayMs = opts.forceDelayMs ?? 500;
  }

  getPhase() {
    return this.phase;
  }

  subscribe(fn: Listener<TrackpadPhase>): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  onEvent(fn: Listener<TrackpadEvent>): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  /** Starts a click. `timedForce` = false when the host reports real pressure and calls `force()` itself. */
  press(source: InputSource = 'api', timedForce = true) {
    if (this.phase !== 'up') return;
    this.sound?.trackpad('press');
    this.set('down', { type: 'press', source });
    if (this.timer) clearTimeout(this.timer);
    if (timedForce) this.timer = setTimeout(() => this.force(source), this.forceDelayMs);
  }

  /** Deepens a held click into a force click. */
  force(source: InputSource = 'api') {
    if (this.phase !== 'down') return;
    this.sound?.trackpad('force');
    this.set('force', { type: 'force', source });
  }

  release(source: InputSource = 'api') {
    if (this.phase === 'up') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.sound?.trackpad('release');
    this.set('up', { type: 'release', source });
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.stateListeners.clear();
    this.eventListeners.clear();
  }

  private set(p: TrackpadPhase, ev: TrackpadEvent) {
    this.phase = p;
    this.eventListeners.forEach((fn) => fn(ev));
    this.stateListeners.forEach((fn) => fn(p));
  }
}
