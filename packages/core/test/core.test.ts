import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClickSound, FINISHES, KeyboardController, isEditableTarget, LAYOUTS, TrackpadController, buildKeyboard, decodeClip, keyboardTheme, keyClipName, topCase, trackpad, KEYBOARD_CLIPS, KEY_SOUNDS } from '../src';

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
  it('plays the command release sound when command goes up', () => {
    const sound = { key: vi.fn(), trackpad: vi.fn() };
    const c = new KeyboardController({ keys: buildKeyboard().keys, sound });
    c.handleKeyDown({ code: 'MetaLeft' });
    c.handleKeyUp({ code: 'MetaLeft' });
    expect(sound.key.mock.calls).toEqual([['mod', false], ['mod', true]]);
    // Focus loss has no lead key, so it keeps the plain key sound.
    c.press('MetaLeft');
    c.releaseAll('keyboard');
    expect(sound.key.mock.calls.at(-1)).toEqual(['key', true]);
    c.dispose();
  });
  it('ignores caps lock auto-repeat', () => {
    vi.useFakeTimers();
    const c = new KeyboardController({ keys: buildKeyboard().keys });
    let presses = 0;
    c.onKey((e) => (presses += e.type === 'press' ? 1 : 0));
    c.handleKeyDown({ code: 'CapsLock' });
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(35);
      expect(c.handleKeyDown({ code: 'CapsLock', repeat: true })).toBe(true);
    }
    expect(presses).toBe(1);
    expect(c.getState().caps).toBe(true);
    c.dispose();
    vi.useRealTimers();
  });
  it('lights the backlight again when the idle delay becomes never', () => {
    vi.useFakeTimers();
    const c = new KeyboardController({ keys: buildKeyboard().keys, idleOffMs: 5000 });
    const states: boolean[] = [];
    c.subscribe((s) => states.push(s.idle));
    vi.advanceTimersByTime(6000);
    expect(c.getState().idle).toBe(true);
    c.setIdleOff(null);
    expect(c.getState().idle).toBe(false);
    expect(states).toEqual([true, false]);
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
    const d = decodeClip((KEYBOARD_CLIPS['key-soft-down'] as string[])[0]);
    expect(d.length).toBeGreaterThan(0.05 * KEYBOARD_CLIPS.sr);
    expect(Math.max(...Array.from(d).map(Math.abs))).toBeLessThanOrEqual(1);
  });
  it('maps the Norwegian keys to the recordings of their size', () => {
    const kb = buildKeyboard({ finish: 'pro-space-black', layout: 'no' });
    const sound = (id: string) => kb.keys.find((k) => k.id === id)!.sound;
    const want: Record<string, string> = {
      KeyA: 'key', F5: 'key', Fn: 'key', ControlLeft: 'key', AltLeft: 'key', IntlBackslash: 'key', Backquote: 'key',
      MetaLeft: 'mod', MetaRight: 'mod', ShiftLeft: 'mod',
      Escape: 'tab', Tab: 'tab', Backspace: 'tab',
      CapsLock: 'caps', ShiftRight: 'wide', Enter: 'enter', Space: 'space',
      ArrowUp: 'arrow', ArrowLeft: 'arrow', TouchID: 'power'
    };
    for (const [id, s] of Object.entries(want)) expect(sound(id), id).toBe(s);
  });
  it('maps other layouts by key size', () => {
    const us = buildKeyboard({ finish: 'pro-space-black', layout: 'en-us' });
    const ja = buildKeyboard({ finish: 'pro-space-black', layout: 'ja' });
    const mk = buildKeyboard({ finish: 'imac-blue', layout: 'en-us' });
    const s = (kb: typeof us, id: string) => kb.keys.find((k) => k.id === id)!.sound;
    expect([s(us, 'ShiftLeft'), s(us, 'Backslash'), s(us, 'Backspace'), s(us, 'Enter'), s(us, 'CapsLock')]).toEqual(['wide', 'key', 'tab', 'enter', 'caps']);
    expect([s(ja, 'ShiftLeft'), s(ja, 'ShiftRight'), s(ja, 'Backspace'), s(ja, 'Tab'), s(ja, 'Lang1'), s(ja, 'CapsLock')]).toEqual(['wide', 'wide', 'mod', 'tab', 'mod', 'caps']);
    // Magic Keyboard left and right arrows are full height: a normal key.
    expect([s(mk, 'ArrowLeft'), s(mk, 'ArrowUp')]).toEqual(['key', 'arrow']);
  });
  it('has a soft and a hard press and release for every key sound', () => {
    for (const k of KEY_SOUNDS)
      for (const force of ['soft', 'hard'] as const)
        for (const up of [false, true]) {
          const name = keyClipName(k, force, up);
          expect((KEYBOARD_CLIPS[name] as string[] | undefined)?.length, name).toBe(1);
        }
    expect(keyClipName('key', 'hard', false)).toBe('key-hard-down');
    expect(keyClipName('power', 'hard', true)).toBe('power-up');
  });
});

describe('audio', () => {
  it('leaves a caller-owned AudioContext open on close', () => {
    const context = { close: vi.fn() } as unknown as AudioContext;
    new ClickSound({ context }).close();
    expect(context.close).not.toHaveBeenCalled();
  });
});

describe('dom', () => {
  it('finds the key event targets that window capture must leave alone', () => {
    const el = (tag: string, attrs: Record<string, string> = {}) => ({ tagName: tag, type: attrs.type, isContentEditable: attrs.ce === 'true', getAttribute: (n: string) => (n === 'contenteditable' ? attrs.ce ?? null : null) }) as unknown as EventTarget;
    expect(isEditableTarget(el('INPUT'))).toBe(true);
    expect(isEditableTarget(el('INPUT', { type: 'range' }))).toBe(true);
    expect(isEditableTarget(el('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(el('SELECT'))).toBe(true);
    expect(isEditableTarget(el('DIV', { ce: 'true' }))).toBe(true);
    expect(isEditableTarget(el('INPUT', { type: 'checkbox' }))).toBe(false);
    expect(isEditableTarget(el('BUTTON'))).toBe(false);
    expect(isEditableTarget(el('DIV'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
