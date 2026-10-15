import { createContext, useContext } from 'react';
import { sharedClickSound, type KeySound } from '@mackeys/react';

export interface SoundState {
  on: boolean;
  setOn: (on: boolean) => void;
}

export const SoundContext = createContext<SoundState>({ on: false, setOn: () => {} });

export const useSound = () => useContext(SoundContext);

/** Plays one key click outside a keyboard, for buttons on the page. Starts the AudioContext on a user gesture. */
export function click(kind: KeySound = 'key', up = false) {
  sharedClickSound().key(kind, up);
}
