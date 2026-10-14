import type { BacklightOptions, CustomLayout, FinishId, KeyEvent, LayoutId } from '@mackeys/core';
import type { IdleOff, SoundProp } from './sound';

export interface Backlight extends BacklightOptions {
  /** Switch the light off after inactivity: 'never', '5s', '10s', '30s', '1m', '5m', or ms. */
  idleOff?: IdleOff;
}

export interface MacKeyboardProps {
  finish?: FinishId;
  layout?: LayoutId | 'custom';
  custom?: Partial<CustomLayout>;
  backlight?: Backlight;
  /** Recorded click sounds. Default true. */
  sound?: SoundProp;
  /** Where physical key presses come from: `focus` (default), `window`, or `none`. */
  capture?: 'focus' | 'window' | 'none';
  /** Keys to show as pressed, by id. */
  highlight?: readonly string[];
  /** Uniform scale. Default 1 (1 key = 64 px). */
  scale?: number;
  view?: 'top-down' | 'angled';
  onkeydown?: (e: KeyEvent) => void;
  onkeyup?: (e: KeyEvent) => void;
  class?: string;
  style?: string;
}

export interface MacTrackpadProps {
  finish?: FinishId;
  sound?: SoundProp;
  forceDelayMs?: number;
  scale?: number;
  onpress?: () => void;
  onforceclick?: () => void;
  onrelease?: () => void;
  class?: string;
  style?: string;
}

export interface MacBookProps extends MacKeyboardProps {
  /** Show the open lid. Default true. */
  lid?: boolean;
  forceDelayMs?: number;
  onpress?: () => void;
  onforceclick?: () => void;
  onrelease?: () => void;
}
