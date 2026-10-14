import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FINISHES, KeyboardController, LAYOUTS, TrackpadController, buildKeyboard, decodeClip, keyboardTheme, topCase, trackpad, KEYBOARD_CLIPS } from '../src';

const fixture = (n: string) => JSON.parse(readFileSync(join(__dirname, '../../../spec/fixtures', n), 'utf8'));

describe('geometry', () => {
  it('matches the golden keyboard fixtures', () => {
    for (const [name, c] of Object.entries<any>(fixture('keyboards.json'))) expect(JSON.parse(JSON.stringify(buildKeyboard(c.input))), name).toEqual(c.output);
  });
  it('matches the golden theme, top case and trackpad fixtures', () => {
    for (const c of Object.values<any>(fixture('themes.json'))) expect(keyboardTheme(c.input.finish, c.input.backlight)).toEqual(c.output);
    for (const c of Object.values<any>(fixture('topcases.json'))) expect(topCase(c.input.finish, buildKeyboard({ finish: c.input.finish }), c.input)).toEqual(c.output);
    for (const c of Object.values<any>(fixture('trackpads.json'))) expect(trackpad(c.input.finish)).toEqual(c.output);
  });
  it('gives every layout and model unique key ids and the full key count', () => {
    for (const f of ['pro-space-black', 'imac-green'])
      for (const l of LAYOUTS) {
        const kb = buildKeyboard({ finish: f, layout: l.id });
        const ids = kb.keys.map((k) => k.id);
        expect(new Set(ids).size, f + '/' + l.id).toBe(ids.length);
        expect(ids).toContain('Space');
        expect(ids).toContain('Fn');
        expect(ids).toContain('TouchID');
      }
  });
  it('keeps every key inside the keyboard bounds', () => {
    for (const f of FINISHES) {
      const kb = buildKeyboard({ finish: f.id, layout: 'ja' });
      for (const k of kb.keys) {
        expect(k.x + k.w).toBeLessThanOrEqual(kb.width + 1e-9);
        expect(k.y + k.h).toBeLessThanOrEqual(kb.height + 1e-9);
      }
    }
  });
  it('uses word legends on English MacBook Pro and icons on Magic Keyboard', () => {
    const pro = buildKeyboard({ finish: 'pro-silver', layout: 'en-us' });
    expect(pro.keys.find((k) => k.id === 'Tab')!.legends[0].text).toBe('tab');
    const mk = buildKeyboard({ finish: 'imac-pink', layout: 'en-us' });
    expect(mk.keys.find((k) => k.id === 'Tab')!.icon).not.toBeNull();
    expect(mk.backlit).toBe(false);
  });
});

describe('theme', () => {
  it('lights the legends only on backlit models', () => {
    expect(keyboardTheme('pro-space-black', { on: true }).glow).toBeGreaterThan(0);
    expect(keyboardTheme('neo-blush', { on: true }).legendGlow).toEqual([]);
    expect(keyboardTheme('pro-space-black', { on: true, idle: true }).glow).toBe(0);
  });
});

describe('controllers', () => {
  it('presses, toggles caps lock and releases everything on command up', () => {
    vi.useFakeTimers();
    const sound = { key: vi.fn(), trackpad: vi.fn() };
    const c = new KeyboardController({ keys: buildKeyboard().keys, sound });
    const events: string[] = [];
    c.onKey((e) => events.push(e.type + ':' + e.id));
    expect(c.handleKeyDown({ code: 'KeyA' })).toBe(true);
    expect(c.handleKeyDown({ code: 'KeyA', repeat: true })).toBe(true);
    expect(c.getState().down.has('KeyA')).toBe(true);
    c.handleKeyDown({ code: 'MetaLeft' });
    expect(c.handleKeyDown({ code: 'KeyC', metaKey: true })).toBe(false);
    c.handleKeyUp({ code: 'MetaLeft' });
    expect(c.getState().down.size).toBe(0);
    expect(c.handleKeyDown({ code: 'Tab' })).toBe(false);
    c.handleKeyDown({ code: 'CapsLock' });
    expect(c.getState().caps).toBe(true);
    vi.advanceTimersByTime(200);
    expect(c.getState().down.has('CapsLock')).toBe(false);
    expect(events.slice(0, 2)).toEqual(['press:KeyA', 'press:MetaLeft']);
    expect(sound.key).toHaveBeenCalledWith('key', false);
    c.dispose();
    vi.useRealTimers();
  });
  it('turns the backlight off after the idle delay and back on with a key', () => {
    vi.useFakeTimers();
    const c = new KeyboardController({ keys: buildKeyboard().keys, idleOffMs: 5000 });
    vi.advanceTimersByTime(5001);
    expect(c.getState().idle).toBe(true);
    c.press('KeyQ');
    expect(c.getState().idle).toBe(false);
    c.dispose();
    vi.useRealTimers();
  });
  it('turns a held trackpad click into a force click', () => {
    vi.useFakeTimers();
    const sound = { key: vi.fn(), trackpad: vi.fn() };
    const t = new TrackpadController({ sound });
    t.press('pointer');
    expect(t.getPhase()).toBe('down');
    vi.advanceTimersByTime(500);
    expect(t.getPhase()).toBe('force');
    t.release('pointer');
    expect(t.getPhase()).toBe('up');
    expect(sound.trackpad.mock.calls.map((c) => c[0])).toEqual(['press', 'force', 'release']);
    vi.useRealTimers();
  });
});

describe('audio', () => {
  it('decodes the recorded clips', () => {
    const d = decodeClip((KEYBOARD_CLIPS.press as string[])[0]);
    expect(d.length).toBe(1680);
    expect(Math.max(...Array.from(d).map(Math.abs))).toBeLessThanOrEqual(1);
  });
});
