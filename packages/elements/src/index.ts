export { MacKeysView, mountMacKeyboard, mountMacTrackpad, mountMacBook, stageColor } from './view';
export type { Backlight, DeviceKind, MacKeyboardOptions, MacTrackpadOptions, MacBookOptions } from './view';
export { MacKeysElement, MacKeyboardElement, MacTrackpadElement, MacBookElement, defineMacKeysElements } from './elements';
export type { MacKeysEventMap } from './elements';
export { resolveSound, idleMs } from './sound';
export type { SoundProp, IdleOff } from './sound';
export * from '@mackeys/core';
