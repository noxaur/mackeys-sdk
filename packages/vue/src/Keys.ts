import { defineComponent, h, type PropType } from 'vue';
import {
  iconStyle,
  keyStyle,
  legendStyle,
  rectStyle,
  themeVars,
  touchIdStyle,
  type KeyCap,
  type KeyboardController,
  type KeyboardGeometry,
  type KeyboardState,
  type KeyboardTheme
} from '@mackeys/core';
import { useStableId } from './composables';

/** The key caps of one keyboard, positioned from the engine's geometry. */
export const Keys = defineComponent({
  name: 'Keys',
  props: {
    geometry: { type: Object as PropType<KeyboardGeometry>, required: true },
    theme: { type: Object as PropType<KeyboardTheme>, required: true },
    state: { type: Object as PropType<KeyboardState>, required: true },
    controller: { type: Object as PropType<KeyboardController>, required: true },
    /** Extra keys to show as pressed (for example, to play back a shortcut). */
    highlight: { type: Array as PropType<readonly string[]>, default: undefined },
    label: { type: String, default: undefined },
    /** Feed physical keys to the controller while a key has focus. */
    focusKeys: { type: Boolean, default: true }
  },
  setup(props) {
    const gradId = useStableId('mk-iso');
    const onKeydown = (e: KeyboardEvent) => {
      if (props.focusKeys && props.controller.handleKeyDown(e)) e.preventDefault();
    };
    const onKeyup = (e: KeyboardEvent) => {
      if (props.focusKeys) props.controller.handleKeyUp(e);
    };
    const onFocusout = (e: FocusEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) props.controller.releaseAll('keyboard');
    };
    const key = (k: KeyCap, down: boolean) => {
      const c = props.controller;
      const up = () => c.release(k.id, 'pointer');
      return h(
        'button',
        {
          key: k.id,
          type: 'button',
          class: ['mk-k', { 'mk-dn': down, 'mk-iso': !!k.iso }],
          'aria-label': k.label,
          'aria-pressed': k.id === 'CapsLock' ? props.state.caps : undefined,
          'data-key': k.id,
          style: keyStyle(k),
          onPointerdown: (e: PointerEvent) => {
            if (e.button > 0) return;
            (e.currentTarget as HTMLElement).focus({ preventScroll: true });
            c.press(k.id, 'pointer');
          },
          onPointerup: up,
          onPointerleave: up,
          onPointercancel: up
        },
        [
          k.iso &&
            h('svg', { class: 'mk-isoshape', width: k.w, height: k.h, viewBox: '0 0 ' + k.w + ' ' + k.h, 'aria-hidden': 'true' }, [
              h('path', { class: 'mk-fc', d: k.iso.path, fill: 'url(#' + gradId + ')', 'stroke-width': 1 }),
              h('path', { class: 'mk-hl', d: k.iso.highlight, fill: 'none', 'stroke-width': 0.8 })
            ]),
          ...k.legends.map((l) => h('span', { key: l.slot, class: 'mk-l', 'aria-hidden': 'true', style: legendStyle(l) }, l.text)),
          k.icon &&
            h('svg', { class: 'mk-ic', viewBox: k.icon.viewBox.join(' '), style: iconStyle(k.icon), 'aria-hidden': 'true' }, [
              k.icon.fill && h('path', { d: k.icon.fill, fill: 'currentColor' }),
              k.icon.stroke && h('path', { d: k.icon.stroke, fill: 'none', stroke: 'currentColor', 'stroke-width': k.icon.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
            ]),
          k.capsLed && h('span', { class: ['mk-led', { 'mk-on': props.state.caps }], 'aria-hidden': 'true', style: rectStyle({ x: k.capsLed.x, y: k.capsLed.y, w: k.capsLed.d, h: k.capsLed.d }) }),
          k.homeBar && h('span', { class: 'mk-home', 'aria-hidden': 'true', style: rectStyle(k.homeBar) }),
          k.touchId && h('span', { class: 'mk-tid mk-tid-' + props.theme.touchId, 'aria-hidden': 'true', style: touchIdStyle(k.touchId.d) })
        ]
      );
    };
    return () => {
      const g = props.geometry;
      const hl = props.highlight && props.highlight.length ? new Set(props.highlight) : null;
      return h(
        'div',
        {
          role: 'group',
          class: 'mk-kbd',
          'aria-label': props.label,
          style: { width: g.width + 'px', height: g.height + 'px', ...themeVars(props.theme, g.lightKeys) },
          onKeydown,
          onKeyup,
          onFocusout
        },
        [
          g.keys.some((k) => k.iso) &&
            h('svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' }, [
              h('defs', [
                h('radialGradient', { id: gradId, cx: '50%', cy: '100%', r: '90%' }, [
                  h('stop', { offset: 0, style: 'stop-color:var(--mk-f1)' }),
                  h('stop', { offset: 1, style: 'stop-color:var(--mk-f0)' })
                ])
              ])
            ]),
          ...g.keys.map((k) => key(k, props.state.down.has(k.id) || !!hl?.has(k.id)))
        ]
      );
    };
  }
});
