import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import {
  ClickSound,
  IDLE_DELAYS,
  KeyCap,
  KeyEvent,
  KeyboardController,
  KeyboardState,
  SoundSink,
  TrackpadController,
  TrackpadEvent,
  TrackpadPhase,
  sharedClickSound
} from '@mackeys/core';

/** `true` = the shared recorded clicks, `false` = silent, or your own sink. */
export type SoundProp = boolean | SoundSink;

export function resolveSound(sound: SoundProp | undefined): SoundSink | null {
  if (sound === false) return null;
  if (sound === undefined || sound === true) return typeof window === 'undefined' ? null : sharedClickSound();
  return sound;
}

export type IdleOff = keyof typeof IDLE_DELAYS | number | null;

export function idleMs(v: IdleOff | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v || null;
  return IDLE_DELAYS[v] ?? null;
}

export interface UseKeyboardOptions {
  keys: KeyCap[];
  sound?: SoundProp;
  idleOff?: IdleOff;
  onKeyDown?: (e: KeyEvent) => void;
  onKeyUp?: (e: KeyEvent) => void;
}

/** Creates a keyboard controller for the life of the component and keeps it in sync with the props. */
export function useKeyboardController(opts: UseKeyboardOptions): [KeyboardController, KeyboardState] {
  const ref = useRef<KeyboardController | null>(null);
  if (!ref.current) ref.current = new KeyboardController({ keys: opts.keys });
  const c = ref.current;
  c.setKeys(opts.keys);
  c.sound = resolveSound(opts.sound);
  const idle = idleMs(opts.idleOff);
  useEffect(() => c.setIdleOff(idle), [c, idle]);
  const handlers = useRef(opts);
  handlers.current = opts;
  useEffect(
    () =>
      c.onKey((e) => {
        if (e.type === 'press') handlers.current.onKeyDown?.(e);
        else handlers.current.onKeyUp?.(e);
      }),
    [c]
  );
  useEffect(() => () => c.dispose(), [c]);
  const state = useSyncExternalStore(
    (fn) => c.subscribe(fn),
    () => c.getState(),
    () => c.getState()
  );
  return [c, state];
}

export interface UseTrackpadOptions {
  sound?: SoundProp;
  forceDelayMs?: number;
  onPress?: () => void;
  onForceClick?: () => void;
  onRelease?: () => void;
}

export function useTrackpadController(opts: UseTrackpadOptions = {}): [TrackpadController, TrackpadPhase] {
  const ref = useRef<TrackpadController | null>(null);
  if (!ref.current) ref.current = new TrackpadController();
  const c = ref.current;
  c.sound = resolveSound(opts.sound);
  if (opts.forceDelayMs) c.forceDelayMs = opts.forceDelayMs;
  const handlers = useRef(opts);
  handlers.current = opts;
  useEffect(
    () =>
      c.onEvent((e: TrackpadEvent) => {
        const h = handlers.current;
        if (e.type === 'press') h.onPress?.();
        else if (e.type === 'force') h.onForceClick?.();
        else h.onRelease?.();
      }),
    [c]
  );
  useEffect(() => () => c.dispose(), [c]);
  const phase = useSyncExternalStore(
    (fn) => c.subscribe(fn),
    () => c.getPhase(),
    () => c.getPhase()
  );
  return [c, phase];
}

/** A stable id for SVG gradients, unique per component instance and safe in a `url(#...)` reference. */
export function useStableId(prefix: string) {
  return prefix + '-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

export { ClickSound };
