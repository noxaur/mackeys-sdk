import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { MacBook, MacKeyboard, MacTrackpad } from '../src/lib';

describe('MacKeyboard', () => {
  it('renders every key and presses keys with the pointer and the keyboard', async () => {
    const onkeydown = vi.fn();
    const { container } = render(MacKeyboard, { props: { finish: 'pro-space-black', layout: 'en-us', sound: false, onkeydown } });
    expect(container.querySelectorAll('button.mk-k').length).toBe(78);
    const a = container.querySelector('[data-key="KeyA"]')!;
    await fireEvent.pointerDown(a, { button: 0 });
    expect(a.className).toContain('mk-dn');
    await fireEvent.pointerUp(a);
    expect(a.className).not.toContain('mk-dn');
    await fireEvent.keyDown(a, { code: 'KeyS' });
    expect(container.querySelector('[data-key="KeyS"]')!.className).toContain('mk-dn');
    expect(onkeydown.mock.calls.map((c) => c[0].id)).toEqual(['KeyA', 'KeyS']);
    expect(document.getElementById('mackeys-css')).not.toBeNull();
  });
  it('updates when the layout prop changes', async () => {
    const { container, rerender } = render(MacKeyboard, { props: { finish: 'imac-green', layout: 'en-us', sound: false } });
    expect(container.querySelector('[data-key="Enter"] .mk-isoshape')).toBeNull();
    await rerender({ finish: 'imac-green', layout: 'de', sound: false });
    expect(container.querySelector('[data-key="Enter"] .mk-isoshape')).not.toBeNull();
    expect(container.querySelector('[data-key="KeyZ"]')!.textContent!.trim()).toBe('Y');
  });
  it('leaves keys typed in a text field to the page', () => {
    const { container } = render(MacKeyboard, { props: { capture: 'window', sound: false } });
    const field = document.createElement('input');
    document.body.appendChild(field);
    const ev = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, cancelable: true });
    field.dispatchEvent(ev);
    flushSync();
    expect(ev.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-key="KeyA"]')!.className).not.toContain('mk-dn');
    // A key typed outside a field still reaches the keyboard.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    flushSync();
    expect(container.querySelector('[data-key="KeyQ"]')!.className).toContain('mk-dn');
    field.remove();
  });
});

describe('MacTrackpad and MacBook', () => {
  it('releases a key-held trackpad when it loses focus', async () => {
    vi.useFakeTimers();
    const onforceclick = vi.fn();
    const { container } = render(MacTrackpad, { props: { sound: false, onforceclick } });
    const pad = container.querySelector('button.mk-tp')!;
    await fireEvent.keyDown(pad, { key: ' ' });
    expect(pad.className).toContain('mk-dn');
    await fireEvent.blur(pad);
    expect(pad.className).not.toContain('mk-dn');
    vi.advanceTimersByTime(600);
    flushSync();
    expect(onforceclick).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('force clicks after a hold', async () => {
    vi.useFakeTimers();
    const onforceclick = vi.fn();
    const { container } = render(MacTrackpad, { props: { sound: false, onforceclick } });
    const pad = container.querySelector('button.mk-tp')!;
    await fireEvent.pointerDown(pad, { button: 0 });
    vi.advanceTimersByTime(600);
    flushSync();
    expect(pad.className).toContain('mk-force');
    expect(onforceclick).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it('renders a full MacBook with lid, trackpad and backlight', () => {
    const { container } = render(MacBook, { props: { finish: 'air-midnight', sound: false, backlight: { on: true, room: 'dark' } } });
    expect(container.querySelector('.mk-lid')).not.toBeNull();
    expect(container.querySelector('button.mk-tp')).not.toBeNull();
    expect((container.querySelector('.mk-kbd') as HTMLElement).style.getPropertyValue('--mk-ls')).not.toBe('none');
  });
});
