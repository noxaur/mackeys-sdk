import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineMacKeysElements, mountMacBook, mountMacKeyboard, mountMacTrackpad } from '../src';

const pointer = (el: Element, type: string) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
const key = (el: Element, type: string, code: string) => el.dispatchEvent(new KeyboardEvent(type, { bubbles: true, code }));

afterEach(() => {
  document.body.textContent = '';
});

describe('mountMacKeyboard', () => {
  it('renders every key and presses one with the pointer and the keyboard', () => {
    const onKeyDown = vi.fn();
    const v = mountMacKeyboard(document.body, { finish: 'pro-space-black', layout: 'en-us', sound: false, onKeyDown });
    expect(document.querySelectorAll('button.mk-k').length).toBe(78);
    const a = document.querySelector('[data-key="KeyA"]')!;
    pointer(a, 'pointerdown');
    expect(a.className).toContain('mk-dn');
    pointer(a, 'pointerup');
    expect(a.className).not.toContain('mk-dn');
    key(a, 'keydown', 'KeyS');
    expect(document.querySelector('[data-key="KeyS"]')!.className).toContain('mk-dn');
    expect(onKeyDown.mock.calls.map((c) => c[0].id)).toEqual(['KeyA', 'KeyS']);
    expect(document.getElementById('mackeys-css')).not.toBeNull();
    v.destroy();
    expect(document.querySelector('.mk-kbd')).toBeNull();
  });
  it('keeps the key elements on a backlight change and builds again on a layout change', () => {
    const v = mountMacKeyboard(document.body, { finish: 'imac-green', layout: 'en-us', sound: false });
    const tab = document.querySelector('[data-key="Tab"]');
    expect(document.querySelector('[data-key="Enter"] .mk-isoshape')).toBeNull();
    v.update({ highlight: ['Tab'] });
    expect(document.querySelector('[data-key="Tab"]')).toBe(tab);
    expect(tab!.className).toContain('mk-dn');
    v.update({ layout: 'de' });
    expect(document.querySelector('[data-key="Enter"] .mk-isoshape')).not.toBeNull();
    expect(document.querySelector('[data-key="KeyZ"]')!.textContent!.trim()).toBe('Y');
    expect(document.querySelector('[data-key="Tab"]')!.className).toContain('mk-dn');
  });
  it('captures window keys', () => {
    const v = mountMacKeyboard(document.body, { capture: 'window', sound: false });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    expect(document.querySelector('[data-key="KeyQ"]')!.className).toContain('mk-dn');
    v.update({ capture: 'none' });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(document.querySelector('[data-key="KeyW"]')!.className).not.toContain('mk-dn');
  });
});

describe('mountMacTrackpad and mountMacBook', () => {
  it('force clicks after a hold', () => {
    vi.useFakeTimers();
    const onForceClick = vi.fn();
    mountMacTrackpad(document.body, { sound: false, onForceClick });
    const pad = document.querySelector('button.mk-tp')!;
    pointer(pad, 'pointerdown');
    vi.advanceTimersByTime(600);
    expect(pad.className).toContain('mk-force');
    expect(onForceClick).toHaveBeenCalledOnce();
    pointer(pad, 'pointerup');
    expect(pad.className).not.toContain('mk-dn');
    vi.useRealTimers();
  });
  it('renders a full MacBook with lid, trackpad and backlight', () => {
    mountMacBook(document.body, { finish: 'air-midnight', sound: false, backlight: { on: true, room: 'dark' } });
    expect(document.querySelector('.mk-lid')).not.toBeNull();
    expect(document.querySelector('button.mk-tp')).not.toBeNull();
    expect((document.querySelector('.mk-kbd') as HTMLElement).style.getPropertyValue('--mk-ls')).not.toBe('none');
  });
});

describe('custom elements', () => {
  defineMacKeysElements();
  defineMacKeysElements();

  it('renders into a shadow root and sends events', () => {
    document.body.innerHTML = '<mac-keyboard finish="pro-silver" layout="en-us" sound="off"></mac-keyboard>';
    const el = document.querySelector('mac-keyboard')!;
    const root = el.shadowRoot!;
    expect(root.querySelectorAll('button.mk-k').length).toBe(78);
    expect(root.querySelector('style')!.textContent).toContain('.mk-k');
    const ids: string[] = [];
    el.addEventListener('mk-keydown', (e) => ids.push((e as CustomEvent).detail.id));
    pointer(root.querySelector('[data-key="KeyA"]')!, 'pointerdown');
    expect(ids).toEqual(['KeyA']);
    expect(el.keyboard!.isDown('KeyA')).toBe(true);
  });
  it('follows attributes and properties', () => {
    document.body.innerHTML = '<mac-keyboard finish="imac-green" sound="off" highlight="MetaLeft KeyC"></mac-keyboard>';
    const el = document.querySelector('mac-keyboard')!;
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-key="KeyC"]')!.className).toContain('mk-dn');
    el.setAttribute('layout', 'de');
    expect(root.querySelector('[data-key="KeyZ"]')!.textContent!.trim()).toBe('Y');
    el.finish = 'air-midnight';
    el.backlight = { on: true, room: 'dark' };
    expect((root.querySelector('.mk-kbd') as HTMLElement).style.getPropertyValue('--mk-ls')).not.toBe('none');
    el.remove();
    expect(el.keyboard).toBeNull();
  });
  it('renders <mac-book> and <mac-trackpad>', () => {
    document.body.innerHTML = '<mac-book finish="pro-space-black" sound="off" lid="false"></mac-book><mac-trackpad sound="off"></mac-trackpad>';
    const book = document.querySelector('mac-book')!.shadowRoot!;
    expect(book.querySelector('.mk-lid')).toBeNull();
    expect(book.querySelector('button.mk-tp')).not.toBeNull();
    document.querySelector('mac-book')!.setAttribute('lid', 'true');
    expect(book.querySelector('.mk-lid')).not.toBeNull();
    expect(document.querySelector('mac-trackpad')!.shadowRoot!.querySelector('button.mk-tp')).not.toBeNull();
  });
});
