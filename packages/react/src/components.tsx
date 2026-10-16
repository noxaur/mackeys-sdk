import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  BacklightOptions,
  CustomLayout,
  FinishId,
  KeyEvent,
  LayoutId,
  TopCaseGeometry,
  TrackpadController,
  TrackpadPhase,
  buildKeyboard,
  cssColor,
  getFinish,
  injectStyles,
  isEditableTarget,
  keyboardTheme,
  lidModel,
  parseStyle,
  reactStyle,
  topCase,
  topCaseStyles,
  trackpad,
  trackpadShadows,
  trackpadStyles,
  gradientCss,
  grad2,
  shadowsCss
} from '@mackeys/core';
import { IdleOff, SoundProp, useKeyboardController, useStableId, useTrackpadController } from './hooks';
import { Keys } from './Keys';

const css = (m: Record<string, string>) => reactStyle(m) as CSSProperties;
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const useStyles = () => useIso(() => injectStyles(), []);

export interface Backlight extends BacklightOptions {
  /** Switch the light off after inactivity: 'never', '5s', '10s', '30s', '1m', '5m', or ms. */
  idleOff?: IdleOff;
}

export interface MacKeyboardProps {
  finish?: FinishId;
  layout?: LayoutId | 'custom';
  custom?: Partial<CustomLayout>;
  backlight?: Backlight;
  /** Recorded click sounds. Default true. */
  sound?: SoundProp;
  /**
   * Where physical key presses come from: `focus` (a key of this keyboard has focus, default),
   * `window` (every key press on the page), or `none`.
   */
  capture?: 'focus' | 'window' | 'none';
  /** Keys to show as pressed, by id (`KeyA`, `MetaLeft` ...). */
  highlight?: readonly string[];
  /** Uniform scale. Default 1 (1 key = 64 px). */
  scale?: number;
  /** Tilt the device back, as on a desk. */
  view?: 'top-down' | 'angled';
  onKeyDown?: (e: KeyEvent) => void;
  onKeyUp?: (e: KeyEvent) => void;
  className?: string;
  style?: CSSProperties;
}

function Scaled({ w, h, scale = 1, view, className, style, children, label }: { w: number; h: number; scale?: number; view?: 'top-down' | 'angled'; className?: string; style?: CSSProperties; children: ReactNode; label?: string }) {
  return (
    <div className={className} role={label ? 'img' : undefined} aria-label={label} style={{ position: 'relative', width: w * scale, height: h * scale, ...style }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          transformOrigin: '0 0',
          transform: (scale !== 1 ? 'scale(' + scale + ')' : '') + (view === 'angled' ? ' perspective(2600px) rotateX(32deg) scale(.96)' : '') || undefined
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Grain({ opacity, freq }: { opacity: number; freq: number }) {
  const id = useStableId('mk-grain');
  return (
    <svg className="mk-grain" width="100%" height="100%" style={{ opacity }} aria-hidden="true">
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={'url(#' + id + ')'} />
    </svg>
  );
}

interface DeckProps {
  tc: TopCaseGeometry;
  finish: FinishId;
  children: ReactNode;
  trackpadSlot?: ReactNode;
}

function Deck({ tc, children, trackpadSlot }: DeckProps) {
  const s = topCaseStyles(tc);
  return (
    <>
      <div aria-hidden="true" style={css(s.side)} />
      <div aria-hidden="true" style={css(s.deck)} />
      <div aria-hidden="true" style={css(s.grainBox)}>
        <Grain opacity={tc.grain} freq={0.95} />
      </div>
      {s.hinge && (
        <>
          <div aria-hidden="true" style={css(s.hinge.bar)} />
          <div aria-hidden="true" style={css(s.hinge.left)} />
          <div aria-hidden="true" style={css(s.hinge.right)} />
        </>
      )}
      {trackpadSlot}
      {s.notch && (
        <>
          <div aria-hidden="true" style={css(s.notch.lip)} />
          <div aria-hidden="true" style={css(s.notch.scoop)} />
        </>
      )}
      {s.grilles.map((g, i) => (
        <div key={i} aria-hidden="true" style={css(g)} />
      ))}
      <div aria-hidden="true" style={css(s.dim)} />
      <div style={css(s.well)}>{children}</div>
    </>
  );
}

function useWindowKeys(enabled: boolean, controller: { handleKeyDown: (e: KeyboardEvent) => boolean; handleKeyUp: (e: KeyboardEvent) => void; releaseAll: () => void }) {
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      // Typing in a text field, select or slider stays with the page.
      if (isEditableTarget(e.target)) return;
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
  }, [enabled, controller]);
}

function useDevice(props: MacKeyboardProps, parts: 'full' | 'keyboard') {
  const { finish = 'pro-space-black', layout = 'en-us', custom } = props;
  const customKey = custom ? JSON.stringify(custom) : '';
  const geometry = useMemo(() => buildKeyboard({ finish, layout, custom }), [finish, layout, customKey]);
  const [controller, state] = useKeyboardController({ keys: geometry.keys, sound: props.sound, idleOff: props.backlight?.idleOff, onKeyDown: props.onKeyDown, onKeyUp: props.onKeyUp });
  const bl = { ...props.backlight, idle: state.idle };
  const theme = keyboardTheme(finish, bl);
  const tc = topCase(finish, geometry, { parts, backlight: bl });
  useWindowKeys(props.capture === 'window', controller);
  return { geometry, controller, state, theme, tc, finish: geometry.finish };
}

/** A Mac keyboard on its deck: MacBook Pro, Air, Neo or iMac Magic Keyboard, by finish. */
export function MacKeyboard(props: MacKeyboardProps) {
  useStyles();
  const d = useDevice(props, 'keyboard');
  const name = getFinish(d.finish).name;
  return (
    <Scaled w={d.tc.width} h={d.tc.height + 10} scale={props.scale} view={props.view} className={props.className} style={props.style}>
      <Deck tc={d.tc} finish={d.finish}>
        <Keys
          geometry={d.geometry}
          theme={d.theme}
          state={d.state}
          controller={d.controller}
          highlight={props.highlight}
          focusKeys={props.capture !== 'none' && props.capture !== 'window'}
          label={name + ' keyboard, ' + props.layout + ' layout. Click or type to press keys.'}
        />
      </Deck>
    </Scaled>
  );
}

export interface MacTrackpadProps {
  finish?: FinishId;
  sound?: SoundProp;
  /** Hold time before a click becomes a force click. Default 500 ms. */
  forceDelayMs?: number;
  scale?: number;
  onPress?: () => void;
  onForceClick?: () => void;
  onRelease?: () => void;
  className?: string;
  style?: CSSProperties;
}

function TrackpadButton({ controller, phase, label, style, grain }: { controller: TrackpadController; phase: TrackpadPhase; label: string; style: CSSProperties; grain: number }) {
  const cls = 'mk-tp' + (phase === 'down' ? ' mk-dn' : phase === 'force' ? ' mk-dn mk-force' : '');
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      style={style}
      onPointerDown={(e) => {
        if (e.button > 0) return;
        controller.press('pointer');
      }}
      onPointerUp={() => controller.release('pointer')}
      onPointerLeave={() => controller.release('pointer')}
      onPointerCancel={() => controller.release('pointer')}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!e.repeat) controller.press('keyboard');
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') controller.release('keyboard');
      }}
      // A key held when focus moves away never sends its key up.
      onBlur={() => controller.release('keyboard')}
    >
      <Grain opacity={grain} freq={1.1} />
    </button>
  );
}

/** A standalone Force Touch trackpad. Click it, or hold it for a force click. */
export function MacTrackpad(props: MacTrackpadProps) {
  useStyles();
  const tp = trackpad(props.finish ?? 'pro-space-black');
  const s = trackpadStyles(tp);
  const [controller, phase] = useTrackpadController(props);
  return (
    <Scaled w={tp.width} h={tp.height + tp.sideDepth} scale={props.scale} className={props.className} style={props.style}>
      <div style={css(s.root)}>
        <div aria-hidden="true" style={css(s.side)} />
        <TrackpadButton controller={controller} phase={phase} label={tp.label} style={css(s.pad)} grain={tp.grain} />
      </div>
    </Scaled>
  );
}

export interface MacBookProps extends MacKeyboardProps, Omit<MacTrackpadProps, 'finish' | 'sound' | 'scale' | 'className' | 'style'> {
  /** Show the open lid with its screen behind the keyboard. Default true. */
  lid?: boolean;
}

// The open lid leans toward the viewer, so its top edge projects wider than the base.
const LID_SPACE = 200;
const LID_SIDE = 120;

function Lid({ finish, width, height }: { finish: FinishId; width: number; height: number }) {
  const m = lidModel(finish, height);
  const id = useStableId('mk-lid');
  return (
    <div aria-hidden="true" className="mk-lid" style={{ position: 'absolute', left: 0, width, top: -height, height, transform: 'perspective(4200px) rotateX(-80deg)', transformOrigin: '50% 100%' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '20px 20px 12px 12px', background: m.lid, boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.4), 0 0 0 1px rgba(0,0,0,.3)' }} />
      <div style={{ position: 'absolute', top: 3, bottom: 3, left: 2, right: 2, borderRadius: '17px 17px 9px 9px', background: '#050506', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.12)' }} />
      <div style={{ position: 'absolute', left: 6, right: 6, top: 14, bottom: 18, borderRadius: '10px 10px 2px 2px', overflow: 'hidden', background: m.wall }}>
        <svg width="100%" height="100%" viewBox="0 0 1000 650" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, display: 'block' }}>
          <defs>
            <filter id={id + 'b'} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id={id + 's'} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <linearGradient id={id + 'A'} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={m.ribbon.a} stopOpacity="0.55" />
              <stop offset="0.5" stopColor={m.ribbon.a} stopOpacity="1" />
              <stop offset="1" stopColor={m.ribbon.hi} stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <g filter={'url(#' + id + 's)'}>
            <path d="M-60 600C170 470 330 380 490 420S790 560 1060 230L1060 330C820 680 600 600 470 520S200 600 -60 680Z" fill={m.ribbon.b} opacity="0.35" />
          </g>
          <g filter={'url(#' + id + 'b)'}>
            <path d="M300 -30C450 110 520 210 700 225S950 150 1060 255L1060 300C900 265 760 320 615 300S420 160 300 -30Z" fill={m.ribbon.c} opacity="0.85" />
            <path d="M-60 520C150 380 300 250 480 300S780 520 1060 110L1060 165C820 620 600 560 470 470S200 520 -60 565Z" fill={'url(#' + id + 'A)'} />
            <path d="M-60 545C170 440 322 330 482 365S762 520 1060 140L1060 158C802 560 602 500 482 430S182 515 -60 555Z" fill={m.ribbon.b} opacity="0.95" />
          </g>
          <path d="M-60 520C150 380 300 250 480 300S780 520 1060 110" fill="none" stroke="#f4fbff" strokeOpacity="0.9" strokeWidth="5" filter={'url(#' + id + 'b)'} />
          <path d="M300 -30C450 110 520 210 700 225S950 150 1060 255" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="3" filter={'url(#' + id + 'b)'} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%), linear-gradient(180deg, rgba(0,0,0,.14) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 80%, rgba(0,0,0,.18) 100%)' }} />
        <div className="mk-menubar" style={{ color: m.ink, background: m.barBg }}>
          <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>Finder</span>
            {['File', 'Edit', 'View', 'Go', 'Window', 'Help'].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
          <span style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            <span className="mk-wifi" />
            <span className="mk-bat">
              <span />
            </span>
            <span className="mk-search" />
            <span className="mk-cc">
              <span />
              <span />
            </span>
            <span>Tue 9:41</span>
          </span>
        </div>
        <div className="mk-widgets">
          <div className="mk-widget" style={{ background: m.widgetBg, color: m.ink, boxShadow: m.widgetShadow }}>
            <span className="mk-temp">14°</span>
            <span className="mk-sun" />
          </div>
          <div className="mk-widget" style={{ background: m.widgetBg, color: m.ink, boxShadow: m.widgetShadow }}>
            <span className="mk-ring" />
            <span className="mk-temp">49%</span>
          </div>
        </div>
        <div className="mk-dock" style={{ background: m.dockBg }}>
          {m.apps.map((a, i) => (
            <span key={i} className="mk-app" style={{ background: a.bg }}>
              <span className="mk-gl" style={css(parseStyle(a.glyph))} />
            </span>
          ))}
          <span className="mk-dock-sep" />
          <span className="mk-app" style={{ background: 'linear-gradient(160deg, #f2f2f4 0%, #c9cbd1 100%)' }} />
        </div>
        <div className="mk-glass" />
        <div className="mk-glimmer" />
      </div>
      <div style={{ position: 'absolute', left: '50%', top: 3, width: 108, height: 22, marginLeft: -54, borderRadius: '0 0 9px 9px', background: '#050506' }} />
      <div style={{ position: 'absolute', left: '50%', top: 9, width: 7, height: 7, marginLeft: -3.5, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #2a3550 0%, #0b0d14 60%)' }} />
    </div>
  );
}

/**
 * A whole MacBook top case: keyboard, Force Touch trackpad and, by default, the open lid.
 * Magic Keyboard finishes render the keyboard only.
 */
export function MacBook(props: MacBookProps) {
  useStyles();
  const d = useDevice(props, 'full');
  const [tpc, phase] = useTrackpadController({ sound: props.sound, forceDelayMs: props.forceDelayMs, onPress: props.onPress, onForceClick: props.onForceClick, onRelease: props.onRelease });
  const f = getFinish(d.finish);
  const showLid = (props.lid ?? true) && d.tc.full;
  const top = showLid ? LID_SPACE : 0;
  const side = showLid ? LID_SIDE : 0;
  const tp = d.tc.trackpad;
  return (
    <Scaled w={d.tc.width + 2 * side} h={d.tc.height + 10 + top} scale={props.scale} view={props.view} className={props.className} style={props.style}>
      <div style={{ position: 'absolute', left: side, top, width: d.tc.width, height: d.tc.height }}>
        {showLid && <Lid finish={d.finish} width={d.tc.width} height={d.tc.height} />}
        <Deck
          tc={d.tc}
          finish={d.finish}
          trackpadSlot={
            tp && (
              <TrackpadButton
                controller={tpc}
                phase={phase}
                label="Force Touch trackpad. Click, or press and hold for a force click."
                grain={0}
                style={{ left: tp.x, top: tp.y, width: tp.w, height: tp.h, borderRadius: tp.radius, background: gradientCss(grad2(f.pad)), boxShadow: shadowsCss(trackpadShadows(d.finish)) }}
              />
            )
          }
        >
          <Keys
            geometry={d.geometry}
            theme={d.theme}
            state={d.state}
            controller={d.controller}
            highlight={props.highlight}
            focusKeys={props.capture !== 'none' && props.capture !== 'window'}
            label={f.name + ' keyboard. Click or type to press keys.'}
          />
        </Deck>
      </div>
    </Scaled>
  );
}

/** The page color the canvas puts behind a device (near black in a dark room). */
export function stageColor(finish: FinishId, backlight?: BacklightOptions) {
  return cssColor(topCase(finish, buildKeyboard({ finish }), { backlight }).pageBackground);
}
