export * from './util';
export * from './data';
export * from './keyboard';
export * from './theme';
export * from './controller';
export * from './audio';
export * from './dom';
export * from './lid';

import { buildKeyboard, KeyboardGeometry, KeyboardOptions } from './keyboard';
import { BacklightOptions, keyboardTheme, KeyboardTheme, topCase, TopCaseGeometry } from './theme';

export interface MacDeviceOptions extends KeyboardOptions {
  /** `full` = MacBook top case with trackpad; `keyboard` = keyboard deck only. Magic Keyboard is always `keyboard`. */
  parts?: 'full' | 'keyboard';
  backlight?: BacklightOptions;
}

export interface MacDevice {
  keyboard: KeyboardGeometry;
  theme: KeyboardTheme;
  topCase: TopCaseGeometry;
}

/** Everything a renderer needs to draw one device: key geometry, key theme and top case. */
export function macDevice(opts: MacDeviceOptions = {}): MacDevice {
  const keyboard = buildKeyboard(opts);
  return {
    keyboard,
    theme: keyboardTheme(keyboard.finish, opts.backlight),
    topCase: topCase(keyboard.finish, keyboard, { parts: opts.parts, backlight: opts.backlight })
  };
}
