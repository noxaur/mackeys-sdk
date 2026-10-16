import { BacklightOptions, FINISHES, FinishId, KeyboardTheme, getFinish } from '@mackeys/react';

export interface Preset {
  id: string;
  name: string;
  kind: string;
  finish: FinishId;
  backlight?: BacklightOptions;
  theme?: Partial<KeyboardTheme>;
}

export const KIND: Record<string, string> = { pro: 'MacBook Pro', air: 'MacBook Air', neo: 'MacBook Neo', mk: 'iMac' };

/** Your own styles change any color of the keys: faces, edges, letters and the light. */
export const OWN: Preset[] = [
  { id: 'phosphor', name: 'Phosphor', kind: 'Your own', finish: 'pro-space-black', theme: { face0: '#0c100cff', face1: '#161c16ff', outline: '#3ddc5c4d', highlight: '#3ddc5c33', legend: '#3ddc5cff', capsLedOn: '#3ddc5cff', homeBar: '#3ddc5c99' } },
  { id: 'blueprint', name: 'Blueprint', kind: 'Your own', finish: 'pro-silver', theme: { face0: '#0d3b8fff', face1: '#1552c2ff', outline: '#ffffff33', highlight: '#ffffff4d', legend: '#ffffffff', homeBar: '#ffffffcc', capsLedOff: '#ffffff40' } },
  { id: 'paper', name: 'Paper', kind: 'Your own', finish: 'pro-space-black', theme: { face0: '#e7e5dfff', face1: '#f8f7f3ff', outline: '#00000026', highlight: '#ffffffff', legend: '#1a1a1aff', homeBar: '#1a1a1a99', capsLedOff: '#00000026' } },
  { id: 'ember', name: 'Ember', kind: 'Your own', finish: 'air-midnight', theme: { face0: '#3a0d0aff', face1: '#6b1812ff', outline: '#ffa07840', highlight: '#ffc8a040', legend: '#ffb199ff', capsLedOn: '#ff6a3dff', homeBar: '#ffb199aa' } },
  { id: 'lit', name: 'Night light', kind: 'Your own', finish: 'pro-space-black', backlight: { on: true, level: 16, room: 'dark' } },
  { id: 'lit-pink', name: 'Pink light', kind: 'Your own', finish: 'air-midnight', backlight: { on: true, level: 14, room: 'dark', color: '#ff9ad5', bleed: 0.8 } }
];

/** Every Mac color, then our own styles. */
export const PRESETS: Preset[] = [...FINISHES.map((f) => ({ id: f.id, name: f.name.split(' · ')[1] ?? f.name, kind: KIND[f.model], finish: f.id })), ...OWN];

/** True when the model has a key light (MacBook Pro and Air). */
export const hasLight = (finish: FinishId) => {
  const m = getFinish(finish).model;
  return m === 'pro' || m === 'air';
};

/** Natural width of the widest keyboard deck, in px. */
export const DECK_W = 1053;
