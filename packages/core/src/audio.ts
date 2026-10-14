// Recorded click sounds, played with Web Audio.
// Keyboard: a press, its release and a space bar, cut from a CC0 recording of a 2021 14-inch MacBook Pro
// (Freesound #853602, "Typing on Laptop Keyboard #2" by justamudkip).
// Trackpad: Force Touch press, release and force click, from a CC0 recording of a 2019 MacBook Pro
// (Freesound #467490, "MacBook Pro trackpad (48/24)" by neilraouf).
import type { SoundSink } from './controller';
import type { KeySound } from './keyboard';
import keyboardClips from '../assets/keyboard-clicks.json';
import trackpadClips from '../assets/trackpad-clicks.json';

/** A clip set: mono 16-bit little-endian PCM, base64 encoded, at sample rate `sr`. */
export interface ClipSet {
  source: string;
  sr: number;
  [kind: string]: string[] | number | string;
}

export const KEYBOARD_CLIPS = keyboardClips as unknown as ClipSet;
export const TRACKPAD_CLIPS = trackpadClips as unknown as ClipSet;

/** Decodes one base64 clip to float samples in -1..1. */
export function decodeClip(b64: string): Float32Array {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v > 32767) v -= 65536;
    out[i] = v / 32768;
  }
  return out;
}

type AC = AudioContext;

export interface ClickSoundOptions {
  /** Master volume, 0 to 1. Default 1. */
  volume?: number;
  /** Share an existing AudioContext. */
  context?: AudioContext;
}

/**
 * Plays the recorded clicks. Each press picks a different take, never the same one twice in a row,
 * with a small random pitch and level change. The AudioContext starts on the first sound,
 * so call it from a user gesture.
 */
export class ClickSound implements SoundSink {
  enabled = true;
  volume: number;
  private ctx: AC | null;
  private bufs: Record<string, AudioBuffer[]> | null = null;
  private lastKey = -1;

  constructor(opts: ClickSoundOptions = {}) {
    this.volume = opts.volume ?? 1;
    this.ctx = opts.context ?? null;
  }

  private context(): AC | null {
    if (this.ctx) return this.ctx;
    const Ctor = typeof window !== 'undefined' && ((window as any).AudioContext || (window as any).webkitAudioContext);
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  private buffers(ctx: AC) {
    if (this.bufs) return this.bufs;
    const make = (set: ClipSet, kind: string) =>
      (set[kind] as string[]).map((b64) => {
        const d = decodeClip(b64);
        const buf = ctx.createBuffer(1, d.length, set.sr);
        buf.getChannelData(0).set(d);
        return buf;
      });
    this.bufs = {
      press: make(KEYBOARD_CLIPS, 'press'),
      release: make(KEYBOARD_CLIPS, 'release'),
      space: make(KEYBOARD_CLIPS, 'space'),
      tpPress: make(TRACKPAD_CLIPS, 'press'),
      tpRelease: make(TRACKPAD_CLIPS, 'release'),
      tpForce: make(TRACKPAD_CLIPS, 'force')
    };
    return this.bufs;
  }

  key(kind: KeySound, up: boolean) {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const B = this.buffers(ctx);
      const list = up ? B.release : kind === 'space' ? B.space : B.press;
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === this.lastKey) i = (i + 1) % list.length;
      this.lastKey = i;
      const src = ctx.createBufferSource();
      src.buffer = list[i];
      src.playbackRate.value = 0.985 + Math.random() * 0.03;
      const g = ctx.createGain();
      g.gain.value = this.volume * 0.85 * (0.85 + Math.random() * 0.15);
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch {
      /* audio is optional */
    }
  }

  trackpad(kind: 'press' | 'release' | 'force') {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const B = this.buffers(ctx);
      const list = kind === 'press' ? B.tpPress : kind === 'force' ? B.tpForce : B.tpRelease;
      const src = ctx.createBufferSource();
      src.buffer = list[Math.floor(Math.random() * list.length)];
      src.playbackRate.value = (kind === 'force' ? 0.9 : 1) * (0.99 + Math.random() * 0.02);
      const g = ctx.createGain();
      g.gain.value = this.volume * (kind === 'force' ? 0.85 : 0.75);
      // Tame the brittle top end of the recording: shelf down above 2 kHz and roll off above 5 kHz.
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = 2000;
      shelf.gain.value = -14;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      lp.Q.value = 0.5;
      src.connect(shelf);
      shelf.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch {
      /* audio is optional */
    }
  }

  close() {
    this.ctx?.close?.();
    this.ctx = null;
    this.bufs = null;
  }
}

let shared: ClickSound | null = null;

/** One ClickSound shared by every component on the page. */
export function sharedClickSound(): ClickSound {
  if (!shared) shared = new ClickSound();
  return shared;
}
