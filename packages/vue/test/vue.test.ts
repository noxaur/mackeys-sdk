import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { MacBook, MacKeyboard, MacTrackpad } from '../src';

describe('MacKeyboard', () => {
  it('renders every key and presses one with the pointer and the keyboard', async () => {
    const w = mount(MacKeyboard, { props: { finish: 'pro-space-black', layout: 'en-us', sound: false }, attachTo: document.body });
    expect(w.findAll('button.mk-k').length).toBe(78);
    const a = w.get('[data-key="KeyA"]');
    await a.trigger('pointerdown', { button: 0 });
    expect(a.classes()).toContain('mk-dn');
    await a.trigger('pointerup');
    expect(a.classes()).not.toContain('mk-dn');
    await a.trigger('keydown', { code: 'KeyS' });
    expect(w.get('[data-key="KeyS"]').classes()).toContain('mk-dn');
    expect((w.emitted('keydown') as [{ id: string }][]).map((c) => c[0].id)).toEqual(['KeyA', 'KeyS']);
    expect(document.getElementById('mackeys-css')).not.toBeNull();
    w.unmount();
  });
  it('updates when the layout prop changes', async () => {
    const w = mount(MacKeyboard, { props: { finish: 'imac-green', layout: 'en-us', sound: false } });
    expect(w.find('[data-key="Enter"] .mk-isoshape').exists()).toBe(false);
    expect(w.find('[data-key="Tab"] svg').exists()).toBe(true);
    await w.setProps({ layout: 'de' });
    expect(w.find('[data-key="Enter"] .mk-isoshape').exists()).toBe(true);
    expect(w.get('[data-key="KeyZ"]').text().trim()).toBe('Y');
  });
  it('captures window keys and shows highlighted keys', async () => {
    const w = mount(MacKeyboard, { props: { capture: 'window', highlight: ['MetaLeft'], sound: false } });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    await nextTick();
    expect(w.get('[data-key="KeyQ"]').classes()).toContain('mk-dn');
    expect(w.get('[data-key="MetaLeft"]').classes()).toContain('mk-dn');
    w.unmount();
  });
});

describe('MacTrackpad and MacBook', () => {
  it('force clicks after a hold', async () => {
    vi.useFakeTimers();
    const w = mount(MacTrackpad, { props: { sound: false } });
    const pad = w.get('button.mk-tp');
    await pad.trigger('pointerdown', { button: 0 });
    vi.advanceTimersByTime(600);
    await nextTick();
    expect(pad.classes()).toContain('mk-force');
    expect(w.emitted('forceclick')).toHaveLength(1);
    await pad.trigger('pointerup');
    expect(pad.classes()).not.toContain('mk-dn');
    vi.useRealTimers();
  });
  it('renders a full MacBook with lid, trackpad and backlight', () => {
    const w = mount(MacBook, { props: { finish: 'air-midnight', sound: false, backlight: { on: true, room: 'dark' } } });
    expect(w.find('.mk-lid').exists()).toBe(true);
    expect(w.find('button.mk-tp').exists()).toBe(true);
    expect((w.get('.mk-kbd').element as HTMLElement).style.getPropertyValue('--mk-ls')).not.toBe('none');
  });
});
