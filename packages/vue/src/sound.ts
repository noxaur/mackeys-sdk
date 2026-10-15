import { IDLE_DELAYS, sharedClickSound, type SoundSink } from '@mackeys/core';

/** `true` = the shared recorded clicks, `false` = silent, or your own sink. */
export type SoundProp = boolean | SoundSink;
export type IdleOff = keyof typeof IDLE_DELAYS | number | null;

export function resolveSound(sound: SoundProp | undefined): SoundSink | null {
  if (sound === false) return null;
  if (sound === undefined || sound === true) return typeof window === 'undefined' ? null : sharedClickSound();
  return sound;
}

export function idleMs(v: IdleOff | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v || null;
  return IDLE_DELAYS[v] ?? null;
}
