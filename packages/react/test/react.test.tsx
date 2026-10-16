import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { MacBook, MacKeyboard, MacTrackpad } from '../src';

describe('MacKeyboard', () => {
  it('renders every key and presses one with the pointer and the keyboard', () => {
    const onKeyDown = vi.fn();
    const { container } = render(<MacKeyboard finish="pro-space-black" layout="en-us" sound={false} onKeyDown={onKeyDown} />);
    const keys = container.querySelectorAll('button.mk-k');
    expect(keys.length).toBe(78);
    const a = container.querySelector('[data-key="KeyA"]')!;
    fireEvent.pointerDown(a, { button: 0 });
    expect(a.className).toContain('mk-dn');
    fireEvent.pointerUp(a);
    expect(a.className).not.toContain('mk-dn');
    fireEvent.keyDown(a, { code: 'KeyS' });
    expect(container.querySelector('[data-key="KeyS"]')!.className).toContain('mk-dn');
    expect(onKeyDown.mock.calls.map((c) => c[0].id)).toEqual(['KeyA', 'KeyS']);
    expect(document.getElementById('mackeys-css')).not.toBeNull();
  });
  it('renders word legends for English Pro and icons for Magic Keyboard', () => {
    const pro = render(<MacKeyboard finish="pro-silver" sound={false} />);
    expect(pro.container.querySelector('[data-key="Tab"]')!.textContent).toBe('tab');
    const mk = render(<MacKeyboard finish="imac-green" layout="de" sound={false} />);
    expect(mk.container.querySelector('[data-key="Tab"] svg')).not.toBeNull();
    expect(mk.container.querySelector('[data-key="Enter"] .mk-isoshape')).not.toBeNull();
  });
  it('captures window keys and shows highlighted keys', () => {
    const { container } = render(<MacKeyboard capture="window" highlight={['MetaLeft']} sound={false} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    });
    expect(container.querySelector('[data-key="KeyQ"]')!.className).toContain('mk-dn');
    expect(container.querySelector('[data-key="MetaLeft"]')!.className).toContain('mk-dn');
  });
  it('leaves keys typed in a text field to the page', () => {
    const { container } = render(
      <>
        <input data-testid="field" />
        <MacKeyboard capture="window" sound={false} />
      </>
    );
    const field = container.querySelector('input')!;
    const ev = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, cancelable: true });
    act(() => {
      field.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-key="KeyA"]')!.className).not.toContain('mk-dn');
  });
});

describe('MacTrackpad and MacBook', () => {
  it('releases a key-held trackpad when it loses focus', () => {
    vi.useFakeTimers();
    const onForceClick = vi.fn();
    const { container } = render(<MacTrackpad sound={false} onForceClick={onForceClick} />);
    const pad = container.querySelector('button.mk-tp')!;
    fireEvent.keyDown(pad, { key: ' ' });
    expect(pad.className).toContain('mk-dn');
    fireEvent.blur(pad);
    expect(pad.className).not.toContain('mk-dn');
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onForceClick).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('force clicks after a hold', () => {
    vi.useFakeTimers();
    const onForceClick = vi.fn();
    const { container } = render(<MacTrackpad sound={false} onForceClick={onForceClick} />);
    const pad = container.querySelector('button.mk-tp')!;
    fireEvent.pointerDown(pad, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(pad.className).toContain('mk-force');
    expect(onForceClick).toHaveBeenCalledOnce();
    fireEvent.pointerUp(pad);
    expect(pad.className).not.toContain('mk-dn');
    vi.useRealTimers();
  });
  it('renders a full MacBook with lid and trackpad', () => {
    const { container } = render(<MacBook finish="air-midnight" sound={false} backlight={{ on: true, room: 'dark' }} />);
    expect(container.querySelector('.mk-lid')).not.toBeNull();
    expect(container.querySelector('button.mk-tp')).not.toBeNull();
    const kbd = container.querySelector('.mk-kbd') as HTMLElement;
    expect(kbd.style.getPropertyValue('--mk-ls')).not.toBe('none');
  });
});
