// Framework-free DOM renderer. It builds the device once and then only patches classes and styles,
// so focus stays on a key while the state changes. A change to the finish, layout, lid, scale or view
// builds the device again.
import {
  BacklightOptions,
  CustomLayout,
  FinishId,
  KeyCap,
  KeyEvent,
  KeyboardController,
  KeyboardGeometry,
  LayoutId,
  StyleMap,
  TrackpadController,
  TrackpadPhase,
  buildKeyboard,
  cssColor,
  getFinish,
  grad2,
  gradientCss,
  iconStyle,
  injectStyles,
  keyStyle,
  keyboardTheme,
  legendStyle,
  lidHtml,
  rectStyle,
  shadowsCss,
  themeVars,
  topCase,
  topCaseStyles,
  touchIdStyle,
  trackpad,
  trackpadShadows,
  trackpadStyles
} from '@mackeys/core';
import { h, setStyle, uid } from './h';
import { IdleOff, SoundProp, idleMs, resolveSound } from './sound';

export interface Backlight extends BacklightOptions {
  /** Switch the light off after inactivity: 'never', '5s', '10s', '30s', '1m', '5m', or ms. */
  idleOff?: IdleOff;
}

export interface MacKeyboardOptions {
  finish?: FinishId;
  layout?: LayoutId | 'custom';
  custom?: Partial<CustomLayout>;
  backlight?: Backlight;
  /** Recorded click sounds. Default true. */
  sound?: SoundProp;
  /** Where physical key presses come from: `focus` (default), `window`, or `none`. */
  capture?: 'focus' | 'window' | 'none';
  /** Keys to show as pressed, by id. */
  highlight?: readonly string[];
  /** Uniform scale. Default 1 (1 key = 64 px). */
  scale?: number;
  view?: 'top-down' | 'angled';
  onKeyDown?: (e: KeyEvent) => void;
  onKeyUp?: (e: KeyEvent) => void;
}

export interface MacTrackpadOptions {
  finish?: FinishId;
  sound?: SoundProp;
  /** Hold time before a click becomes a force click. Default 500 ms. */
  forceDelayMs?: number;
  scale?: number;
  onPress?: () => void;
  onForceClick?: () => void;
  onRelease?: () => void;
}

export interface MacBookOptions extends MacKeyboardOptions, Omit<MacTrackpadOptions, 'finish' | 'sound' | 'scale'> {
  /** Show the open lid. Default true. */
  lid?: boolean;
}

export type DeviceKind = 'keyboard' | 'trackpad' | 'macbook';
type AnyOptions = MacBookOptions;

// The open lid leans toward the viewer, so its top edge projects wider than the base.
const LID_SPACE = 200;
const LID_SIDE = 120;
const TRACKPAD_LABEL = 'Force Touch trackpad. Click, or press and hold for a force click.';

interface KeyRef {
  k: KeyCap;
  btn: HTMLButtonElement;
  led: HTMLElement | null;
  tid: HTMLElement | null;
}

interface DeckRefs {
  side: HTMLElement;
  deck: HTMLElement;
  grainBox: HTMLElement;
  dim: HTMLElement;
  well: HTMLElement;
  grilles: HTMLElement[];
  hinge: HTMLElement[];
  notch: HTMLElement[];
}

/**
 * One device in the DOM: a keyboard, a trackpad or a whole MacBook.
 * Use `mountMacKeyboard`, `mountMacTrackpad` or `mountMacBook` to make one.
 */
export class MacKeysView<O extends object = AnyOptions> {
  /** The keyboard state machine (null for a trackpad). */
  readonly keyboard: KeyboardController | null;
  /** The trackpad state machine (null for a keyboard). */
  readonly trackpad: TrackpadController | null;
  /** The outer element. */
  readonly root: HTMLDivElement;
  private o: AnyOptions = {};
  private doc: Document;
  private geometry: KeyboardGeometry | null = null;
  private geometryKey = '';
  private buildKey = '';
  private keys = new Map<string, KeyRef>();
  private kbd: HTMLElement | null = null;
  private deck: DeckRefs | null = null;
  private inner: HTMLElement | null = null;
  private pad: HTMLButtonElement | null = null;
  private stopWindow: (() => void) | null = null;
  private stops: (() => void)[] = [];

  constructor(
    parent: Node,
    readonly kind: DeviceKind,
    options: O
  ) {
    this.doc = parent.ownerDocument ?? (parent as Document);
    this.root = h(this.doc, 'div');
    if (parent.nodeType !== 11) injectStyles(this.doc); // a shadow root (11) brings its own stylesheet
    parent.appendChild(this.root);
    this.keyboard = kind === 'trackpad' ? null : new KeyboardController();
    this.trackpad = kind === 'keyboard' ? null : new TrackpadController();
    const kb = this.keyboard;
    const tp = this.trackpad;
    if (kb) {
      this.stops.push(kb.subscribe(() => this.paint()));
      this.stops.push(kb.onKey((e) => (e.type === 'press' ? this.o.onKeyDown?.(e) : this.o.onKeyUp?.(e))));
    }
    if (tp) {
      this.stops.push(tp.subscribe((p) => this.paintPad(p)));
      this.stops.push(tp.onEvent((e) => (e.type === 'press' ? this.o.onPress?.() : e.type === 'force' ? this.o.onForceClick?.() : this.o.onRelease?.())));
    }
    this.set(options);
  }

  /** Replaces all options. */
  set(options: O) {
    this.o = { ...(options as AnyOptions) };
    const o = this.o;
    const finish = o.finish ?? 'pro-space-black';
    if (this.keyboard) {
      const gk = finish + '|' + (o.layout ?? 'en-us') + '|' + (o.custom ? JSON.stringify(o.custom) : '');
      if (gk !== this.geometryKey) {
        this.geometryKey = gk;
        this.geometry = buildKeyboard({ finish, layout: o.layout ?? 'en-us', custom: o.custom });
        this.keyboard.setKeys(this.geometry.keys);
      }
      this.keyboard.sound = resolveSound(o.sound);
      this.keyboard.setIdleOff(idleMs(o.backlight?.idleOff));
      this.windowKeys(o.capture === 'window');
    }
    if (this.trackpad) {
      this.trackpad.sound = resolveSound(o.sound);
      this.trackpad.forceDelayMs = o.forceDelayMs || 500;
    }
    const bk = [this.geometryKey, finish, o.lid ?? true, o.scale ?? 1, o.view ?? 'top-down'].join('|');
    if (bk !== this.buildKey) {
      this.buildKey = bk;
      this.build();
    }
    this.paint();
  }

  /** Changes some options and keeps the rest. */
  update(patch: Partial<O>) {
    this.set({ ...(this.o as O), ...patch });
  }

  /** Removes the device and stops its timers and listeners. */
  destroy() {
    this.windowKeys(false);
    this.stops.forEach((s) => s());
    this.keyboard?.dispose();
    this.trackpad?.dispose();
    this.root.remove();
  }

  // ---- Build ----------------------------------------------------------------------------------

  private get finish(): FinishId {
    return this.o.finish ?? 'pro-space-black';
  }

  private parts() {
    return this.kind === 'macbook' ? 'full' : 'keyboard';
  }

  private build() {
    const d = this.doc;
    this.root.textContent = '';
    this.keys.clear();
    this.kbd = this.deck = this.pad = null;
    const inner = h(d, 'div');
    this.inner = inner;
    this.root.appendChild(inner);
    if (this.kind === 'trackpad') {
      const tp = trackpad(this.finish);
      const s = trackpadStyles(tp);
      this.pad = this.padButton(tp.label, s.pad, tp.grain);
      inner.appendChild(h(d, 'div', { style: s.root }, [h(d, 'div', { 'aria-hidden': 'true', style: s.side }), this.pad]));
      return;
    }
    const geometry = this.geometry!;
    const tc = topCase(this.finish, geometry, { parts: this.parts() });
    const showLid = this.kind === 'macbook' && (this.o.lid ?? true) && tc.full;
    let host: HTMLElement = inner;
    if (this.kind === 'macbook') {
      host = h(d, 'div');
      inner.appendChild(host);
      if (showLid) host.insertAdjacentHTML('beforeend', lidHtml(this.finish, tc.width, tc.height, uid('mk-lid')));
    }
    const s = topCaseStyles(tc);
    const div = (style: StyleMap) => h(d, 'div', { 'aria-hidden': 'true', style });
    const deck: DeckRefs = {
      side: div(s.side),
      deck: div(s.deck),
      grainBox: h(d, 'div', { 'aria-hidden': 'true', style: s.grainBox }, [this.grain(tc.grain, 0.95)]),
      dim: div(s.dim),
      well: h(d, 'div', { style: s.well }),
      grilles: s.grilles.map(div),
      hinge: s.hinge ? [div(s.hinge.bar), div(s.hinge.left), div(s.hinge.right)] : [],
      notch: s.notch ? [div(s.notch.lip), div(s.notch.scoop)] : []
    };
    this.deck = deck;
    host.append(deck.side, deck.deck, deck.grainBox, ...deck.hinge);
    if (this.kind === 'macbook' && tc.trackpad) {
      const t = tc.trackpad;
      const f = getFinish(this.finish);
      this.pad = this.padButton(TRACKPAD_LABEL, {
        left: t.x + 'px',
        top: t.y + 'px',
        width: t.w + 'px',
        height: t.h + 'px',
        'border-radius': t.radius + 'px',
        background: gradientCss(grad2(f.pad)),
        'box-shadow': shadowsCss(trackpadShadows(this.finish))
      }, 0);
      host.appendChild(this.pad);
    }
    host.append(...deck.notch, ...deck.grilles, deck.dim, deck.well);
    deck.well.appendChild(this.buildKeys(geometry));
  }

  private buildKeys(geometry: KeyboardGeometry) {
    const d = this.doc;
    const kb = this.keyboard!;
    const name = getFinish(this.finish).name;
    const label = this.kind === 'macbook' ? name + ' keyboard. Click or type to press keys.' : name + ' keyboard, ' + (this.o.layout ?? 'en-us') + ' layout. Click or type to press keys.';
    const root = h(d, 'div', { role: 'group', class: 'mk-kbd', 'aria-label': label });
    this.kbd = root;
    const focusKeys = () => (this.o.capture ?? 'focus') === 'focus';
    root.addEventListener('keydown', (e) => {
      if (focusKeys() && kb.handleKeyDown(e)) e.preventDefault();
    });
    root.addEventListener('keyup', (e) => {
      if (focusKeys()) kb.handleKeyUp(e);
    });
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget as Node | null)) kb.releaseAll('keyboard');
    });
    const gradId = uid('mk-iso');
    if (geometry.keys.some((k) => k.iso))
      root.appendChild(
        h(d, 'svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' }, [
          h(d, 'defs', {}, [
            h(d, 'radialGradient', { id: gradId, cx: '50%', cy: '100%', r: '90%' }, [
              h(d, 'stop', { offset: 0, style: 'stop-color:var(--mk-f1)' }),
              h(d, 'stop', { offset: 1, style: 'stop-color:var(--mk-f0)' })
            ])
          ])
        ])
      );
    for (const k of geometry.keys) {
      const led = k.capsLed ? h(d, 'span', { class: 'mk-led', 'aria-hidden': 'true', style: rectStyle({ x: k.capsLed.x, y: k.capsLed.y, w: k.capsLed.d, h: k.capsLed.d }) }) : null;
      const tid = k.touchId ? h(d, 'span', { class: 'mk-tid', 'aria-hidden': 'true', style: touchIdStyle(k.touchId.d) }) : null;
      const btn = h<HTMLButtonElement>(d, 'button', { type: 'button', class: 'mk-k' + (k.iso ? ' mk-iso' : ''), 'aria-label': k.label, 'data-key': k.id, style: keyStyle(k) }, [
        k.iso &&
          h(d, 'svg', { class: 'mk-isoshape', width: k.w, height: k.h, viewBox: '0 0 ' + k.w + ' ' + k.h, 'aria-hidden': 'true' }, [
            h(d, 'path', { class: 'mk-fc', d: k.iso.path, fill: 'url(#' + gradId + ')', 'stroke-width': 1 }),
            h(d, 'path', { class: 'mk-hl', d: k.iso.highlight, fill: 'none', 'stroke-width': 0.8 })
          ]),
        ...k.legends.map((l) => h(d, 'span', { class: 'mk-l', 'aria-hidden': 'true', style: legendStyle(l) }, [l.text])),
        k.icon &&
          h(d, 'svg', { class: 'mk-ic', viewBox: k.icon.viewBox.join(' '), style: iconStyle(k.icon), 'aria-hidden': 'true' }, [
            k.icon.fill && h(d, 'path', { d: k.icon.fill, fill: 'currentColor' }),
            k.icon.stroke && h(d, 'path', { d: k.icon.stroke, fill: 'none', stroke: 'currentColor', 'stroke-width': k.icon.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
          ]),
        led,
        k.homeBar && h(d, 'span', { class: 'mk-home', 'aria-hidden': 'true', style: rectStyle(k.homeBar) }),
        tid
      ]);
      const up = () => kb.release(k.id, 'pointer');
      btn.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        btn.focus({ preventScroll: true });
        kb.press(k.id, 'pointer');
      });
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
      this.keys.set(k.id, { k, btn, led, tid });
      root.appendChild(btn);
    }
    return root;
  }

  private padButton(label: string, style: StyleMap, grain: number) {
    const tp = this.trackpad!;
    const btn = h<HTMLButtonElement>(this.doc, 'button', { type: 'button', class: 'mk-tp', 'aria-label': label, style }, [grain > 0 && this.grain(grain, 1.1)]);
    const up = () => tp.release('pointer');
    btn.addEventListener('pointerdown', (e) => {
      if (!(e.button > 0)) tp.press('pointer');
    });
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) tp.press('keyboard');
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') tp.release('keyboard');
    });
    return btn;
  }

  private grain(opacity: number, freq: number) {
    const d = this.doc;
    const id = uid('mk-grain');
    return h(d, 'svg', { class: 'mk-grain', width: '100%', height: '100%', style: 'opacity:' + opacity, 'aria-hidden': 'true' }, [
      h(d, 'filter', { id }, [h(d, 'feTurbulence', { type: 'fractalNoise', baseFrequency: freq, numOctaves: 2, stitchTiles: 'stitch' }), h(d, 'feColorMatrix', { type: 'saturate', values: 0 })]),
      h(d, 'rect', { width: '100%', height: '100%', filter: 'url(#' + id + ')' })
    ]);
  }

  // ---- Paint ----------------------------------------------------------------------------------

  private scaled(w: number, h: number, angled: boolean) {
    const scale = this.o.scale ?? 1;
    setStyle(this.root, { position: 'relative', width: w * scale + 'px', height: h * scale + 'px' });
    const transform = ((scale !== 1 ? 'scale(' + scale + ')' : '') + (angled && this.o.view === 'angled' ? ' perspective(2600px) rotateX(32deg) scale(.96)' : '')).trim() || 'none';
    setStyle(this.inner!, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px', 'transform-origin': '0 0', transform });
  }

  private paint() {
    if (!this.inner) return;
    if (this.kind === 'trackpad') {
      const tp = trackpad(this.finish);
      this.scaled(tp.width, tp.height + tp.sideDepth, false);
      this.paintPad(this.trackpad!.getPhase());
      return;
    }
    const kb = this.keyboard!;
    const geometry = this.geometry!;
    const state = kb.getState();
    const bl = { ...this.o.backlight, idle: state.idle };
    const theme = keyboardTheme(this.finish, bl);
    const tc = topCase(this.finish, geometry, { parts: this.parts(), backlight: bl });
    const showLid = this.kind === 'macbook' && (this.o.lid ?? true) && tc.full;
    const top = showLid ? LID_SPACE : 0;
    const side = showLid ? LID_SIDE : 0;
    this.scaled(tc.width + 2 * side, tc.height + 10 + top, true);
    if (this.kind === 'macbook') setStyle(this.inner.firstElementChild!, { position: 'absolute', left: side + 'px', top: top + 'px', width: tc.width + 'px', height: tc.height + 'px' });

    const s = topCaseStyles(tc);
    const deck = this.deck!;
    setStyle(deck.side, s.side);
    setStyle(deck.deck, s.deck);
    setStyle(deck.dim, s.dim);
    setStyle(deck.well, s.well);
    deck.grilles.forEach((el, i) => setStyle(el, s.grilles[i]));

    setStyle(this.kbd!, { width: geometry.width + 'px', height: geometry.height + 'px', ...themeVars(theme, geometry.lightKeys) });
    const hl = this.o.highlight;
    for (const { k, btn, led, tid } of this.keys.values()) {
      btn.classList.toggle('mk-dn', state.down.has(k.id) || !!hl?.includes(k.id));
      if (k.id === 'CapsLock') btn.setAttribute('aria-pressed', String(state.caps));
      led?.classList.toggle('mk-on', state.caps);
      if (tid) tid.setAttribute('class', 'mk-tid mk-tid-' + theme.touchId);
    }
    if (this.pad) this.paintPad(this.trackpad!.getPhase());
  }

  private paintPad(p: TrackpadPhase) {
    if (!this.pad) return;
    this.pad.classList.toggle('mk-dn', p !== 'up');
    this.pad.classList.toggle('mk-force', p === 'force');
  }

  private windowKeys(on: boolean) {
    if (on === !!this.stopWindow || typeof window === 'undefined') return;
    if (!on) {
      this.stopWindow!();
      this.stopWindow = null;
      return;
    }
    const kb = this.keyboard!;
    const down = (e: KeyboardEvent) => {
      if (kb.handleKeyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => kb.handleKeyUp(e);
    const blur = () => kb.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    this.stopWindow = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }
}

/** Renders a Mac keyboard on its deck into `parent`. */
export function mountMacKeyboard(parent: Node, options: MacKeyboardOptions = {}) {
  return new MacKeysView<MacKeyboardOptions>(parent, 'keyboard', options);
}

/** Renders a standalone Force Touch trackpad into `parent`. */
export function mountMacTrackpad(parent: Node, options: MacTrackpadOptions = {}) {
  return new MacKeysView<MacTrackpadOptions>(parent, 'trackpad', options);
}

/** Renders a whole MacBook (lid, keyboard and trackpad) into `parent`. Magic Keyboard finishes show the keyboard only. */
export function mountMacBook(parent: Node, options: MacBookOptions = {}) {
  return new MacKeysView<MacBookOptions>(parent, 'macbook', options);
}

/** The page color the canvas puts behind a device (near black in a dark room). */
export function stageColor(finish: FinishId, backlight?: BacklightOptions) {
  return cssColor(topCase(finish, buildKeyboard({ finish }), { backlight }).pageBackground);
}
