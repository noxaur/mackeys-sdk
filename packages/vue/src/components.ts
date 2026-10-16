import { computed, defineComponent, h, onMounted, watchEffect, type PropType, type VNodeChild } from 'vue';
import {
  buildKeyboard,
  cssColor,
  getFinish,
  grad2,
  gradientCss,
  injectStyles,
  keyboardTheme,
  lidHtml,
  shadowsCss,
  topCase,
  topCaseStyles,
  trackpad,
  trackpadShadows,
  trackpadStyles,
  type BacklightOptions,
  type CustomLayout,
  type FinishId,
  type KeyEvent,
  type LayoutId,
  type StyleMap,
  type TopCaseGeometry,
  type TrackpadController,
  type TrackpadPhase
} from '@mackeys/core';
import { useKeyboardController, useStableId, useTrackpadController, useWindowKeys } from './composables';
import { Keys } from './Keys';
import { idleMs, resolveSound, type IdleOff, type SoundProp } from './sound';

export interface Backlight extends BacklightOptions {
  /** Switch the light off after inactivity: 'never', '5s', '10s', '30s', '1m', '5m', or ms. */
  idleOff?: IdleOff;
}

type View = 'top-down' | 'angled';

const keyboardProps = {
  finish: { type: String as PropType<FinishId>, default: 'pro-space-black' },
  layout: { type: String as PropType<LayoutId | 'custom'>, default: 'en-us' },
  custom: { type: Object as PropType<Partial<CustomLayout>>, default: undefined },
  backlight: { type: Object as PropType<Backlight>, default: undefined },
  /** Recorded click sounds, `false`, or your own `SoundSink`. Default true. */
  sound: { type: [Boolean, Object] as PropType<SoundProp>, default: undefined },
  /** Where physical key presses come from: `focus` (default), `window`, or `none`. */
  capture: { type: String as PropType<'focus' | 'window' | 'none'>, default: 'focus' },
  /** Keys to show as pressed, by id. */
  highlight: { type: Array as PropType<readonly string[]>, default: undefined },
  /** Uniform scale. Default 1 (1 key = 64 px). */
  scale: { type: Number, default: 1 },
  view: { type: String as PropType<View>, default: 'top-down' }
} as const;

const trackpadProps = {
  /** Hold time before a click becomes a force click. Default 500 ms. */
  forceDelayMs: { type: Number, default: 500 }
} as const;

const keyEmits = {
  keydown: (_e: KeyEvent) => true,
  keyup: (_e: KeyEvent) => true
};
const padEmits = {
  press: () => true,
  forceclick: () => true,
  release: () => true
};

const useStyles = () => onMounted(() => injectStyles());

function scaled(w: number, ht: number, scale: number, view: View | undefined, children: VNodeChild) {
  const transform = ((scale !== 1 ? 'scale(' + scale + ')' : '') + (view === 'angled' ? ' perspective(2600px) rotateX(32deg) scale(.96)' : '')).trim() || 'none';
  return h('div', { style: { position: 'relative', width: w * scale + 'px', height: ht * scale + 'px' } }, [
    h('div', { style: { position: 'absolute', left: 0, top: 0, width: w + 'px', height: ht + 'px', transformOrigin: '0 0', transform } }, children as never)
  ]);
}

const Grain = defineComponent({
  props: { opacity: { type: Number, required: true }, freq: { type: Number, required: true } },
  setup(props) {
    const id = useStableId('mk-grain');
    return () =>
      h('svg', { class: 'mk-grain', width: '100%', height: '100%', style: { opacity: props.opacity }, 'aria-hidden': 'true' }, [
        h('filter', { id }, [h('feTurbulence', { type: 'fractalNoise', baseFrequency: props.freq, numOctaves: 2, stitchTiles: 'stitch' }), h('feColorMatrix', { type: 'saturate', values: '0' })]),
        h('rect', { width: '100%', height: '100%', filter: 'url(#' + id + ')' })
      ]);
  }
});

function deck(tc: TopCaseGeometry, keys: VNodeChild, trackpadSlot?: VNodeChild) {
  const s = topCaseStyles(tc);
  const div = (style: StyleMap) => h('div', { 'aria-hidden': 'true', style });
  return [
    div(s.side),
    div(s.deck),
    h('div', { 'aria-hidden': 'true', style: s.grainBox }, [h(Grain, { opacity: tc.grain, freq: 0.95 })]),
    ...(s.hinge ? [div(s.hinge.bar), div(s.hinge.left), div(s.hinge.right)] : []),
    trackpadSlot,
    ...(s.notch ? [div(s.notch.lip), div(s.notch.scoop)] : []),
    ...s.grilles.map(div),
    div(s.dim),
    h('div', { style: s.well }, [keys as never])
  ];
}

const TrackpadButton = defineComponent({
  props: {
    controller: { type: Object as PropType<TrackpadController>, required: true },
    phase: { type: String as PropType<TrackpadPhase>, required: true },
    label: { type: String, required: true },
    padStyle: { type: Object as PropType<StyleMap>, required: true },
    grain: { type: Number, default: 0 }
  },
  setup(props) {
    const up = () => props.controller.release('pointer');
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: ['mk-tp', { 'mk-dn': props.phase !== 'up', 'mk-force': props.phase === 'force' }],
          'aria-label': props.label,
          style: props.padStyle,
          onPointerdown: (e: PointerEvent) => {
            if (!(e.button > 0)) props.controller.press('pointer');
          },
          onPointerup: up,
          onPointerleave: up,
          onPointercancel: up,
          onKeydown: (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              if (!e.repeat) props.controller.press('keyboard');
            }
          },
          onKeyup: (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') props.controller.release('keyboard');
          }
        },
        props.grain > 0 ? [h(Grain, { opacity: props.grain, freq: 1.1 })] : []
      );
  }
});

type KeyboardProps = { finish: FinishId; layout: LayoutId | 'custom'; custom?: Partial<CustomLayout>; backlight?: Backlight; sound?: SoundProp; capture: 'focus' | 'window' | 'none' };

function useDevice(props: KeyboardProps, parts: 'full' | 'keyboard', emit: (e: 'keydown' | 'keyup', ev: KeyEvent) => void) {
  const { controller, state } = useKeyboardController();
  const geometry = computed(() => buildKeyboard({ finish: props.finish, layout: props.layout, custom: props.custom }));
  watchEffect(() => controller.setKeys(geometry.value.keys));
  watchEffect(() => {
    controller.sound = resolveSound(props.sound);
  });
  watchEffect(() => controller.setIdleOff(idleMs(props.backlight?.idleOff)));
  controller.onKey((e) => emit(e.type === 'press' ? 'keydown' : 'keyup', e));
  useWindowKeys(() => props.capture === 'window', controller);
  const bl = computed(() => ({ ...props.backlight, idle: state.value.idle }));
  const theme = computed(() => keyboardTheme(props.finish, bl.value));
  const tc = computed(() => topCase(props.finish, geometry.value, { parts, backlight: bl.value }));
  return { controller, state, geometry, theme, tc };
}

/** A Mac keyboard on its deck: MacBook Pro, Air, Neo or iMac Magic Keyboard, by finish. */
export const MacKeyboard = defineComponent({
  name: 'MacKeyboard',
  props: keyboardProps,
  emits: keyEmits,
  setup(props, { emit }) {
    useStyles();
    const d = useDevice(props, 'keyboard', (t, e) => (t === 'keydown' ? emit('keydown', e) : emit('keyup', e)));
    return () => {
      const tc = d.tc.value;
      return scaled(
        tc.width,
        tc.height + 10,
        props.scale,
        props.view,
        deck(
          tc,
          h(Keys, {
            geometry: d.geometry.value,
            theme: d.theme.value,
            state: d.state.value,
            controller: d.controller,
            highlight: props.highlight,
            focusKeys: props.capture === 'focus',
            label: getFinish(props.finish).name + ' keyboard, ' + props.layout + ' layout. Click or type to press keys.'
          })
        )
      );
    };
  }
});

function usePad(props: { sound?: SoundProp; forceDelayMs: number }, emit: (e: 'press' | 'forceclick' | 'release') => void) {
  const { controller, phase } = useTrackpadController();
  watchEffect(() => {
    controller.sound = resolveSound(props.sound);
    controller.forceDelayMs = props.forceDelayMs;
  });
  controller.onEvent((e) => emit(e.type === 'press' ? 'press' : e.type === 'force' ? 'forceclick' : 'release'));
  return { controller, phase };
}

/** A standalone Force Touch trackpad. Click it, or hold it for a force click. */
export const MacTrackpad = defineComponent({
  name: 'MacTrackpad',
  props: {
    finish: keyboardProps.finish,
    sound: keyboardProps.sound,
    scale: keyboardProps.scale,
    ...trackpadProps
  },
  emits: padEmits,
  setup(props, { emit }) {
    useStyles();
    const pad = usePad(props, (e) => (e === 'press' ? emit('press') : e === 'forceclick' ? emit('forceclick') : emit('release')));
    return () => {
      const tp = trackpad(props.finish);
      const s = trackpadStyles(tp);
      return scaled(tp.width, tp.height + tp.sideDepth, props.scale, 'top-down', [
        h('div', { style: s.root }, [
          h('div', { 'aria-hidden': 'true', style: s.side }),
          h(TrackpadButton, { controller: pad.controller, phase: pad.phase.value, label: tp.label, padStyle: s.pad, grain: tp.grain })
        ])
      ]);
    };
  }
});

// The open lid leans toward the viewer, so its top edge projects wider than the base.
const LID_SPACE = 200;
const LID_SIDE = 120;

/**
 * A whole MacBook top case: keyboard, Force Touch trackpad and, by default, the open lid.
 * Magic Keyboard finishes render the keyboard only.
 */
export const MacBook = defineComponent({
  name: 'MacBook',
  props: {
    ...keyboardProps,
    ...trackpadProps,
    /** Show the open lid with its screen behind the keyboard. Default true. */
    lid: { type: Boolean, default: true }
  },
  emits: { ...keyEmits, ...padEmits },
  setup(props, { emit }) {
    useStyles();
    const d = useDevice(props, 'full', (t, e) => (t === 'keydown' ? emit('keydown', e) : emit('keyup', e)));
    const pad = usePad(props, (e) => (e === 'press' ? emit('press') : e === 'forceclick' ? emit('forceclick') : emit('release')));
    const lidId = useStableId('mk-lid');
    return () => {
      const tc = d.tc.value;
      const f = getFinish(props.finish);
      const showLid = props.lid && tc.full;
      const top = showLid ? LID_SPACE : 0;
      const side = showLid ? LID_SIDE : 0;
      const tp = tc.trackpad;
      const padStyle: StyleMap | null = tp && {
        left: tp.x + 'px',
        top: tp.y + 'px',
        width: tp.w + 'px',
        height: tp.h + 'px',
        'border-radius': tp.radius + 'px',
        background: gradientCss(grad2(f.pad)),
        'box-shadow': shadowsCss(trackpadShadows(props.finish))
      };
      return scaled(tc.width + 2 * side, tc.height + 10 + top, props.scale, props.view, [
        h('div', { style: { position: 'absolute', left: side + 'px', top: top + 'px', width: tc.width + 'px', height: tc.height + 'px' } }, [
          showLid && h('div', { style: 'display:contents', innerHTML: lidHtml(props.finish, tc.width, tc.height, lidId) }),
          ...deck(
            tc,
            h(Keys, {
              geometry: d.geometry.value,
              theme: d.theme.value,
              state: d.state.value,
              controller: d.controller,
              highlight: props.highlight,
              focusKeys: props.capture === 'focus',
              label: f.name + ' keyboard. Click or type to press keys.'
            }),
            padStyle && h(TrackpadButton, { controller: pad.controller, phase: pad.phase.value, label: 'Force Touch trackpad. Click, or press and hold for a force click.', padStyle })
          )
        ])
      ]);
    };
  }
});

/** The page color the canvas puts behind a device (near black in a dark room). */
export function stageColor(finish: FinishId, backlight?: BacklightOptions) {
  return cssColor(topCase(finish, buildKeyboard({ finish }), { backlight }).pageBackground);
}
