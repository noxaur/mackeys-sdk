import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, memo } from 'react';
import {
  KeyCap,
  KeyboardController,
  KeyboardGeometry,
  KeyboardState,
  KeyboardTheme,
  iconStyle,
  keyStyle,
  legendStyle,
  reactStyle,
  rectStyle,
  themeVars,
  touchIdStyle
} from '@mackeys/core';
import { useStableId } from './hooks';

const css = (m: Record<string, string>) => reactStyle(m) as CSSProperties;

interface KeyProps {
  k: KeyCap;
  down: boolean;
  caps: boolean;
  gradId: string;
  touchIdStyleName: KeyboardTheme['touchId'];
  controller: KeyboardController;
}

const Key = memo(function Key({ k, down, caps, gradId, touchIdStyleName, controller }: KeyProps) {
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    e.currentTarget.focus({ preventScroll: true });
    controller.press(k.id, 'pointer');
  };
  const onUp = () => controller.release(k.id, 'pointer');
  const cls = 'mk-k' + (down ? ' mk-dn' : '') + (k.iso ? ' mk-iso' : '');
  return (
    <button
      type="button"
      className={cls}
      aria-label={k.label}
      aria-pressed={k.id === 'CapsLock' ? caps : undefined}
      data-key={k.id}
      style={css(keyStyle(k))}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {k.iso && (
        <svg className="mk-isoshape" width={k.w} height={k.h} viewBox={'0 0 ' + k.w + ' ' + k.h} aria-hidden="true">
          <path className="mk-fc" d={k.iso.path} fill={'url(#' + gradId + ')'} strokeWidth={1} />
          <path className="mk-hl" d={k.iso.highlight} fill="none" strokeWidth={0.8} />
        </svg>
      )}
      {k.legends.map((l) => (
        <span key={l.slot} className="mk-l" aria-hidden="true" style={css(legendStyle(l))}>
          {l.text}
        </span>
      ))}
      {k.icon && (
        <svg className="mk-ic" viewBox={k.icon.viewBox.join(' ')} style={css(iconStyle(k.icon))} aria-hidden="true">
          {k.icon.fill && <path d={k.icon.fill} fill="currentColor" />}
          {k.icon.stroke && <path d={k.icon.stroke} fill="none" stroke="currentColor" strokeWidth={k.icon.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      )}
      {k.capsLed && <span className={'mk-led' + (caps ? ' mk-on' : '')} aria-hidden="true" style={css(rectStyle({ x: k.capsLed.x, y: k.capsLed.y, w: k.capsLed.d, h: k.capsLed.d }))} />}
      {k.homeBar && <span className="mk-home" aria-hidden="true" style={css(rectStyle(k.homeBar))} />}
      {k.touchId && <span className={'mk-tid mk-tid-' + touchIdStyleName} aria-hidden="true" style={css(touchIdStyle(k.touchId.d))} />}
    </button>
  );
});

export interface KeysProps {
  geometry: KeyboardGeometry;
  theme: KeyboardTheme;
  state: KeyboardState;
  controller: KeyboardController;
  /** Extra keys to show as pressed (for example, to play back a shortcut). */
  highlight?: readonly string[];
  label?: string;
  /** Feed physical keys to the controller while a key has focus. Default true. */
  focusKeys?: boolean;
}

/** The key caps of one keyboard, positioned from the engine's geometry. */
export function Keys({ geometry, theme, state, controller, highlight, label, focusKeys = true }: KeysProps) {
  const gradId = useStableId('mk-iso');
  const hl = highlight && highlight.length ? new Set(highlight) : null;
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!focusKeys) return;
    if (controller.handleKeyDown(e.nativeEvent)) e.preventDefault();
  };
  const onKeyUp = (e: ReactKeyboardEvent) => {
    if (focusKeys) controller.handleKeyUp(e.nativeEvent);
  };
  const onBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) controller.releaseAll('keyboard');
  };
  const vars = themeVars(theme, geometry.lightKeys);
  return (
    <div
      role="group"
      className="mk-kbd"
      aria-label={label}
      style={{ width: geometry.width, height: geometry.height, ...(vars as CSSProperties) }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
    >
      {geometry.keys.some((k) => k.iso) && (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <radialGradient id={gradId} cx="50%" cy="100%" r="90%">
              <stop offset="0" style={{ stopColor: 'var(--mk-f1)' }} />
              <stop offset="1" style={{ stopColor: 'var(--mk-f0)' }} />
            </radialGradient>
          </defs>
        </svg>
      )}
      {geometry.keys.map((k) => (
        <Key
          key={k.id}
          k={k}
          down={state.down.has(k.id) || !!hl?.has(k.id)}
          caps={state.caps}
          gradId={gradId}
          touchIdStyleName={theme.touchId}
          controller={controller}
        />
      ))}
    </div>
  );
}
