import { CSSProperties, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo } from 'react';
import {
  BacklightOptions,
  CustomLayout,
  FinishId,
  KeyEvent,
  KeyboardController,
  KeyboardTheme,
  LayoutId,
  Keys,
  buildKeyboard,
  injectStyles,
  keyboardTheme,
  reactStyle,
  topCase,
  topCaseStyles,
  useKeyboardController
} from '@mackeys/react';

const css = (m: Record<string, string>) => reactStyle(m) as CSSProperties;

export interface DeviceProps {
  finish?: FinishId;
  layout?: LayoutId | 'custom';
  custom?: Partial<CustomLayout>;
  backlight?: BacklightOptions;
  /** Overrides on top of the finish's theme: any style you want. */
  theme?: Partial<KeyboardTheme>;
  sound?: boolean;
  scale?: number;
  highlight?: readonly string[];
  /** Feed every key press on the page to this keyboard. */
  capture?: 'window' | 'none';
  /** Keep the keys out of the tab order and ignore clicks (decorative keyboards). */
  inert?: boolean;
  onKeyDown?: (e: KeyEvent) => void;
  onKeyUp?: (e: KeyEvent) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * A keyboard on its deck, built from the SDK parts (`buildKeyboard`, `keyboardTheme`, `topCase`, `Keys`).
 * The ref gives the controller, so the page can press keys itself.
 */
export const Device = forwardRef<KeyboardController, DeviceProps>(function Device(props, ref) {
  const { finish = 'pro-space-black', layout = 'en-us', custom, backlight, scale = 1, inert } = props;
  useLayoutEffect(() => injectStyles(), []);
  const customKey = custom ? JSON.stringify(custom) : '';
  const geometry = useMemo(() => buildKeyboard({ finish, layout, custom }), [finish, layout, customKey]);
  const [controller, state] = useKeyboardController({ keys: geometry.keys, sound: props.sound ?? true, onKeyDown: props.onKeyDown, onKeyUp: props.onKeyUp });
  useImperativeHandle(ref, () => controller, [controller]);
  const bl = { ...backlight, idle: state.idle };
  const theme = useMemo(() => ({ ...keyboardTheme(finish, bl), ...props.theme }), [finish, bl.on, bl.level, bl.room, bl.bleed, bl.color, bl.idle, props.theme]);
  const tc = useMemo(() => topCase(finish, geometry, { parts: 'keyboard', backlight: bl }), [finish, geometry, bl.on, bl.level, bl.room, bl.bleed, bl.color, bl.idle]);
  const s = topCaseStyles(tc);

  useEffect(() => {
    if (props.capture !== 'window') return;
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (controller.handleKeyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => controller.handleKeyUp(e);
    const blur = () => controller.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [props.capture, controller]);

  const w = tc.width;
  const h = tc.height + 10;
  return (
    <div className={props.className} style={{ position: 'relative', width: w * scale, height: h * scale, ...props.style }} {...(inert ? { inert: '' } : {})}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '0 0', transform: scale !== 1 ? `scale(${scale})` : undefined }}>
        <div aria-hidden="true" style={css(s.side)} />
        <div aria-hidden="true" style={css(s.deck)} />
        {s.grilles.map((g, i) => (
          <div key={i} aria-hidden="true" style={css(g)} />
        ))}
        <div aria-hidden="true" style={css(s.dim)} />
        <div style={css(s.well)}>
          <Keys geometry={geometry} theme={theme} state={state} controller={controller} highlight={props.highlight} focusKeys={!inert && props.capture !== 'window'} label={`${finish} keyboard, ${layout} layout`} />
        </div>
      </div>
    </div>
  );
});

/** True when the event target is a text field, so page-wide key capture leaves it alone. */
export function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: '';
  }
}
