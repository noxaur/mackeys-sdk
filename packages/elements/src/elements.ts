// Custom elements: <mac-keyboard>, <mac-trackpad> and <mac-book>. They work in plain HTML and in any
// framework that renders DOM (Angular, Vue, Solid, Lit, Preact, Astro ...).
import { MACKEYS_CSS, type CustomLayout, type FinishId, type KeyEvent, type KeyboardController, type LayoutId, type TrackpadController } from '@mackeys/core';
import { Backlight, DeviceKind, MacBookOptions, MacKeysView } from './view';
import type { SoundProp } from './sound';

/** The events the elements send. They bubble and cross the shadow root. */
export interface MacKeysEventMap {
  'mk-keydown': CustomEvent<KeyEvent>;
  'mk-keyup': CustomEvent<KeyEvent>;
  'mk-press': CustomEvent<void>;
  'mk-forceclick': CustomEvent<void>;
  'mk-release': CustomEvent<void>;
}

const HOST_CSS = ':host{display:inline-block;vertical-align:top}:host([hidden]){display:none}';

const ATTRS = ['finish', 'layout', 'capture', 'scale', 'view', 'sound', 'highlight', 'lid', 'force-delay', 'backlight', 'backlight-level', 'room', 'bleed', 'light-color', 'idle-off'] as const;

// Class fields are not allowed before HTMLElement exists, so the base is a stub on the server.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

const off = (v: string | null) => v === 'false' || v === 'off' || v === '0';
const num = (v: string | null) => (v == null || v === '' || isNaN(+v) ? undefined : +v);

/**
 * The shared base of the three elements. Simple options are attributes; `custom`, `backlight`,
 * `highlight` and `sound` are also properties, for objects, arrays and your own sound sink.
 */
export abstract class MacKeysElement extends Base {
  static readonly kind: DeviceKind;
  static get observedAttributes(): string[] {
    return [...ATTRS];
  }

  private _view: MacKeysView | null = null;
  private _custom: Partial<CustomLayout> | undefined;
  private _backlight: Backlight | undefined;
  private _highlight: readonly string[] | undefined;
  private _sound: SoundProp | undefined;

  connectedCallback() {
    // A property set before the element was defined hides the accessor; move it to the accessor.
    for (const p of ['custom', 'backlight', 'highlight', 'sound'] as const) {
      if (Object.prototype.hasOwnProperty.call(this, p)) {
        const v = (this as Record<string, unknown>)[p];
        delete (this as Record<string, unknown>)[p];
        (this as Record<string, unknown>)[p] = v;
      }
    }
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    if (!root.querySelector('style')) {
      const style = document.createElement('style');
      style.textContent = HOST_CSS + MACKEYS_CSS;
      root.appendChild(style);
    }
    this._view?.destroy();
    this._view = new MacKeysView(root, (this.constructor as typeof MacKeysElement).kind, this.options());
  }

  disconnectedCallback() {
    this._view?.destroy();
    this._view = null;
  }

  attributeChangedCallback() {
    this.refresh();
  }

  /** The keyboard state machine, while the element is in the document. */
  get keyboard(): KeyboardController | null {
    return this._view?.keyboard ?? null;
  }

  /** The trackpad state machine, while the element is in the document. */
  get trackpad(): TrackpadController | null {
    return this._view?.trackpad ?? null;
  }

  get finish(): FinishId {
    return (this.getAttribute('finish') as FinishId) || 'pro-space-black';
  }
  set finish(v: FinishId) {
    this.setAttribute('finish', v);
  }

  get layout(): LayoutId | 'custom' {
    return (this.getAttribute('layout') as LayoutId) || 'en-us';
  }
  set layout(v: LayoutId | 'custom') {
    this.setAttribute('layout', v);
  }

  get custom() {
    return this._custom;
  }
  set custom(v: Partial<CustomLayout> | undefined) {
    this._custom = v;
    this.refresh();
  }

  /** The backlight. The property wins over the `backlight-*` attributes. */
  get backlight(): Backlight | undefined {
    if (this._backlight) return this._backlight;
    const a = (n: string) => this.getAttribute(n);
    if (!this.hasAttribute('backlight')) return undefined;
    const idle = a('idle-off');
    return {
      on: !off(a('backlight')),
      level: num(a('backlight-level')),
      room: (a('room') as Backlight['room']) || undefined,
      bleed: num(a('bleed')),
      color: a('light-color') || undefined,
      idleOff: idle == null ? undefined : (num(idle) ?? (idle as Backlight['idleOff']))
    };
  }
  set backlight(v: Backlight | undefined) {
    this._backlight = v;
    this.refresh();
  }

  /** Key ids to show as pressed. The attribute takes a space-separated list. */
  get highlight(): readonly string[] | undefined {
    return this._highlight ?? this.getAttribute('highlight')?.split(/\s+/).filter(Boolean);
  }
  set highlight(v: readonly string[] | undefined) {
    this._highlight = v;
    this.refresh();
  }

  /** `true`, `false` or your own sound sink. The attribute `sound="off"` silences the element. */
  get sound(): SoundProp | undefined {
    if (this._sound !== undefined) return this._sound;
    return off(this.getAttribute('sound')) ? false : undefined;
  }
  set sound(v: SoundProp | undefined) {
    this._sound = v;
    this.refresh();
  }

  get capture(): 'focus' | 'window' | 'none' {
    return (this.getAttribute('capture') as 'window') || 'focus';
  }
  set capture(v: 'focus' | 'window' | 'none') {
    this.setAttribute('capture', v);
  }

  get scale(): number {
    return num(this.getAttribute('scale')) ?? 1;
  }
  set scale(v: number) {
    this.setAttribute('scale', String(v));
  }

  get view(): 'top-down' | 'angled' {
    return this.getAttribute('view') === 'angled' ? 'angled' : 'top-down';
  }
  set view(v: 'top-down' | 'angled') {
    this.setAttribute('view', v);
  }

  get lid(): boolean {
    return !off(this.getAttribute('lid'));
  }
  set lid(v: boolean) {
    this.setAttribute('lid', String(v));
  }

  get forceDelayMs(): number {
    return num(this.getAttribute('force-delay')) ?? 500;
  }
  set forceDelayMs(v: number) {
    this.setAttribute('force-delay', String(v));
  }

  private emit<K extends keyof MacKeysEventMap>(type: K, detail?: KeyEvent) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private options(): MacBookOptions {
    return {
      finish: this.finish,
      layout: this.layout,
      custom: this._custom,
      backlight: this.backlight,
      sound: this.sound,
      capture: this.capture,
      highlight: this.highlight,
      scale: this.scale,
      view: this.view,
      lid: this.lid,
      forceDelayMs: this.forceDelayMs,
      onKeyDown: (e) => this.emit('mk-keydown', e),
      onKeyUp: (e) => this.emit('mk-keyup', e),
      onPress: () => this.emit('mk-press'),
      onForceClick: () => this.emit('mk-forceclick'),
      onRelease: () => this.emit('mk-release')
    };
  }

  private refresh() {
    this._view?.set(this.options());
  }
}

/** `<mac-keyboard>`: a Mac keyboard on its deck. */
export class MacKeyboardElement extends MacKeysElement {
  static readonly kind = 'keyboard';
}

/** `<mac-trackpad>`: a standalone Force Touch trackpad. */
export class MacTrackpadElement extends MacKeysElement {
  static readonly kind = 'trackpad';
}

/** `<mac-book>`: a whole MacBook with lid, keyboard and trackpad. */
export class MacBookElement extends MacKeysElement {
  static readonly kind = 'macbook';
}

/** Registers `<mac-keyboard>`, `<mac-trackpad>` and `<mac-book>`. Safe to call more than once. */
export function defineMacKeysElements(registry: CustomElementRegistry | undefined = typeof customElements !== 'undefined' ? customElements : undefined) {
  if (!registry) return;
  const all: [string, CustomElementConstructor][] = [
    ['mac-keyboard', MacKeyboardElement],
    ['mac-trackpad', MacTrackpadElement],
    ['mac-book', MacBookElement]
  ];
  for (const [name, ctor] of all) if (!registry.get(name)) registry.define(name, ctor);
}

declare global {
  interface HTMLElementTagNameMap {
    'mac-keyboard': MacKeyboardElement;
    'mac-trackpad': MacTrackpadElement;
    'mac-book': MacBookElement;
  }
}
