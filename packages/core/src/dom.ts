// Helpers for DOM renderers (React, Svelte, plain DOM): one stylesheet, CSS variables and inline styles.
import { getFinish, FinishId } from './data';
import type { KeyCap, KeyIcon, Legend } from './keyboard';
import type { KeyboardTheme, TopCaseGeometry, TrackpadGeometry } from './theme';
import { Gradient, Shadow, cssColor, cssGradient, cssShadows } from './util';

export type StyleMap = Record<string, string>;

/** Input types that take no typed text, so key capture can still use their keys. */
const PLAIN_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'reset', 'submit']);

/**
 * True when a key event's target edits text or uses the keys itself: a text input, a textarea, a select,
 * a range slider or contenteditable. Window key capture leaves those events to the page.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as (HTMLElement & { type?: string }) | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !PLAIN_INPUTS.has((el.type || 'text').toLowerCase());
  return el.isContentEditable === true || el.getAttribute?.('contenteditable') === 'true';
}

export const FONT_STACK = 'system-ui, -apple-system, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif';

/** The stylesheet every DOM renderer injects once. All selectors start with `mk-`. */
export const MACKEYS_CSS = `
.mk-kbd{position:relative}
.mk-k{position:absolute;box-sizing:border-box;margin:0;padding:0;border:0;cursor:pointer;color:var(--mk-lc);text-shadow:var(--mk-ls);font-family:${FONT_STACK};font-weight:400;line-height:1;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none;background:radial-gradient(125% 110% at 50% 100%,var(--mk-f1) 0%,var(--mk-f0) 100%);box-shadow:inset 0 0 0 1px var(--mk-ol),inset 0 1.8px 0 var(--mk-hl),var(--mk-lk);transition:transform 95ms cubic-bezier(.2,.75,.3,1),filter 95ms ease-out,box-shadow 95ms ease-out,color 600ms ease,text-shadow 600ms ease}
.mk-k.mk-dn,.mk-k:active{transform:translateY(.45px) scale(.986);filter:brightness(var(--mk-pb));box-shadow:inset 0 0 0 1px var(--mk-ol),var(--mk-lk);transition-duration:26ms}
.mk-k:focus{outline:none}
.mk-k:focus-visible{outline:2px solid #0a84ff;outline-offset:2px}
.mk-l{position:absolute;white-space:nowrap;line-height:1}
.mk-ic{position:absolute;display:block;overflow:visible;filter:var(--mk-icf)}
.mk-led{position:absolute;border-radius:50%;background:var(--mk-dot);transition:background-color 120ms ease-out,box-shadow 120ms ease-out}
.mk-led.mk-on{background:var(--mk-led-on);box-shadow:var(--mk-led-glow)}
.mk-home{position:absolute;border-radius:1px;background:var(--mk-hb)}
.mk-tid{position:absolute;left:50%;top:50%;border-radius:50%;filter:var(--mk-tidf);transition:filter 600ms ease}
.mk-tid::after{content:"";position:absolute;border-radius:50%}
.mk-tid-dark{background:conic-gradient(from 0deg,#5a5a5e 0deg,#48484c 60deg,#3a3a3d 140deg,#444448 215deg,#3a3a3d 290deg,#5a5a5e 360deg);box-shadow:0 0 0 .5px rgba(0,0,0,.65)}
.mk-tid-dark::after{inset:.7px;background:#1b1b1d;box-shadow:inset 0 .8px 1px rgba(0,0,0,.45)}
.mk-tid-light{background:#c4c4c8;box-shadow:0 0 0 .6px rgba(60,60,66,.55)}
.mk-tid-light::after{inset:1.1px;background:#eeeef0;box-shadow:inset 0 0 0 .5px rgba(70,70,76,.45),inset 0 1px 1px rgba(0,0,0,.06)}
.mk-tid-flush{background:var(--mk-f1);box-shadow:inset 0 1px 1px rgba(0,0,0,.10),inset 0 -.8px 0 rgba(255,255,255,.6),0 .6px 0 rgba(255,255,255,.5),0 -.4px 0 rgba(0,0,0,.08)}
.mk-tid-flush::after{content:none}
.mk-k.mk-iso,.mk-k.mk-iso.mk-dn,.mk-k.mk-iso:active{background:transparent;box-shadow:none}
.mk-isoshape{position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1px var(--mk-isosh))}
.mk-isoshape .mk-fc{stroke:var(--mk-ol)}
.mk-isoshape .mk-hl{stroke:var(--mk-hl)}
.mk-tp{position:absolute;margin:0;padding:0;border:0;cursor:default;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:transform 140ms cubic-bezier(.2,.8,.3,1),filter 140ms ease-out}
.mk-tp:focus{outline:none}
.mk-tp::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 0 rgba(0,0,0,0);transition:box-shadow 140ms ease-out}
.mk-tp.mk-dn{transform:translateY(1px);filter:brightness(.97);transition-duration:35ms}
.mk-tp.mk-dn::after{box-shadow:inset 0 1px 5px rgba(0,0,0,.22);transition-duration:35ms}
.mk-tp.mk-force{transform:translateY(1.8px);filter:brightness(.94)}
.mk-tp.mk-force::after{box-shadow:inset 0 2px 9px rgba(0,0,0,.32)}
.mk-tp:focus-visible{outline:2px solid #0a84ff;outline-offset:2px}
.mk-grain{position:absolute;inset:0;display:block;mix-blend-mode:overlay;pointer-events:none}
.mk-lid .mk-menubar{position:absolute;left:0;right:0;top:0;height:30px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;justify-content:space-between;font-family:${FONT_STACK};font-size:14px;font-weight:500;line-height:1;opacity:.8}
.mk-lid .mk-bat{position:relative;display:inline-block;width:24px;height:12px;box-sizing:border-box;border:1.5px solid currentColor;border-radius:4px;opacity:.95}
.mk-lid .mk-bat span{position:absolute;left:1.5px;top:1.5px;bottom:1.5px;width:48%;border-radius:1.5px;background:currentColor}
.mk-lid .mk-bat::after{content:"";position:absolute;right:-4px;top:3px;width:2px;height:4px;border-radius:0 1px 1px 0;background:currentColor}
.mk-lid .mk-wifi{display:inline-block;width:16px;height:16px;border-radius:16px 16px 0 0;background:conic-gradient(from -45deg at 50% 100%,currentColor 0 90deg,transparent 0);clip-path:polygon(50% 100%,0 0,100% 0);opacity:.95;margin-top:2px}
.mk-lid .mk-search{display:inline-block;width:10px;height:10px;box-sizing:border-box;border:1.8px solid currentColor;border-radius:50%;position:relative}
.mk-lid .mk-search::after{content:"";position:absolute;right:-4px;bottom:-3px;width:5px;height:1.8px;background:currentColor;transform:rotate(45deg)}
.mk-lid .mk-cc{display:inline-flex;flex-direction:column;gap:2px}
.mk-lid .mk-cc span{display:block;width:16px;height:5px;border-radius:3px;border:1.4px solid currentColor;box-sizing:border-box}
.mk-lid .mk-dock{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:3px;padding:5px 6px;border-radius:13px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),0 3px 10px rgba(0,0,0,.12)}
.mk-lid .mk-app{display:flex;align-items:center;justify-content:center;width:22px;height:42px;border-radius:7px;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 2px rgba(0,0,0,.25)}
.mk-lid .mk-gl{display:block;box-sizing:border-box;transform:scale(.8,1.5)}
.mk-lid .mk-dock-sep{display:block;width:1px;height:34px;background:rgba(255,255,255,.45);margin:0 2px}
.mk-lid .mk-widgets{position:absolute;left:34px;top:52px;display:flex;flex-direction:column;gap:10px}
.mk-lid .mk-widget{width:100px;height:104px;box-sizing:border-box;padding:11px 12px;border-radius:20px;display:flex;flex-direction:column;justify-content:space-between;font-family:${FONT_STACK}}
.mk-lid .mk-temp{font-size:34px;font-weight:400;line-height:1;letter-spacing:-.02em}
.mk-lid .mk-sun{display:block;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,#ffd84d 0 45%,rgba(255,216,77,0) 47%),conic-gradient(from 0deg,#ffd84d 0 6%,transparent 0 12.5%,#ffd84d 0 18.5%,transparent 0 25%,#ffd84d 0 31%,transparent 0 37.5%,#ffd84d 0 43.5%,transparent 0 50%,#ffd84d 0 56%,transparent 0 62.5%,#ffd84d 0 68.5%,transparent 0 75%,#ffd84d 0 81%,transparent 0 87.5%,#ffd84d 0 93.5%,transparent 0);align-self:flex-end}
.mk-lid .mk-ring{display:block;width:40px;height:40px;box-sizing:border-box;border-radius:50%;border:4px solid #30d158;border-right-color:rgba(160,160,165,.45);border-bottom-color:rgba(160,160,165,.45);transform:rotate(-45deg)}
.mk-lid .mk-glass{position:absolute;inset:0;background:linear-gradient(155deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.02) 28%,rgba(255,255,255,0) 45%);pointer-events:none}
.mk-lid .mk-glimmer{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.mk-lid .mk-glimmer::before{content:"";position:absolute;top:-40%;width:9%;height:180%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.14) 35%,rgba(255,255,255,.38) 50%,rgba(255,255,255,.14) 65%,rgba(255,255,255,0) 100%);transform:rotate(18deg);left:66%;opacity:.14}
`;

const STYLE_ID = 'mackeys-css';

/** Adds the stylesheet to a document once. Safe to call on every mount; does nothing on the server. */
export function injectStyles(doc: Document | undefined = typeof document !== 'undefined' ? document : undefined) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = MACKEYS_CSS;
  doc.head.appendChild(el);
}

const px = (n: number) => n + 'px';
const glowList = (g: { blur: number; color: string }[]) => (g.length ? g.map((s) => '0 0 ' + s.blur + 'px ' + cssColor(s.color)).join(', ') : 'none');

/** CSS variables for the keyboard root element. */
export function themeVars(t: KeyboardTheme, lightKeys: boolean): StyleMap {
  return {
    '--mk-f0': cssColor(t.face0),
    '--mk-f1': cssColor(t.face1),
    '--mk-ol': cssColor(t.outline),
    '--mk-hl': cssColor(t.highlight),
    '--mk-lc': cssColor(t.legend),
    '--mk-ls': glowList(t.legendGlow),
    '--mk-icf': t.iconGlow.length ? t.iconGlow.map((s) => 'drop-shadow(0 0 ' + s.blur + 'px ' + cssColor(s.color) + ')').join(' ') : 'none',
    '--mk-lk': cssShadows(t.capShadows),
    '--mk-dot': cssColor(t.capsLedOff),
    '--mk-led-on': cssColor(t.capsLedOn),
    '--mk-led-glow': glowList(t.capsLedGlow),
    '--mk-hb': cssColor(t.homeBar),
    '--mk-tidf': t.touchIdBrightness === 1 ? 'none' : 'brightness(' + t.touchIdBrightness + ')',
    '--mk-pb': String(t.pressedBrightness),
    '--mk-isosh': lightKeys ? 'rgba(0,0,0,.14)' : 'rgba(0,0,0,.4)'
  };
}

export function keyStyle(k: KeyCap): StyleMap {
  return { left: px(k.x), top: px(k.y), width: px(k.w), height: px(k.h), 'border-radius': px(k.radius) };
}

export function legendStyle(l: Legend): StyleMap {
  const s: StyleMap = { top: px(l.top), 'font-size': px(l.size) };
  if (l.tracking) s['letter-spacing'] = l.tracking + 'em';
  if (l.align === 'center') {
    s.left = '0';
    s.right = '0';
    s['text-align'] = 'center';
  } else s[l.align] = px(l.inset);
  return s;
}

export function iconStyle(i: KeyIcon): StyleMap {
  return { left: px(i.x), top: px(i.y), width: px(i.w), height: px(i.h) };
}

export function rectStyle(r: { x: number; y: number; w: number; h: number }): StyleMap {
  return { left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) };
}

export function touchIdStyle(d: number): StyleMap {
  return { width: px(d), height: px(d), margin: px(-d / 2) + ' 0 0 ' + px(-d / 2) };
}

export const radiusCss = (r: [number, number, number, number]) => r.map(px).join(' ');
export const gradientCss = (g: Gradient, angle = 180) => cssGradient(g, angle);
export const shadowsCss = (s: Shadow[]) => cssShadows(s);

/** Styles for every part of a top case. */
export function topCaseStyles(tc: TopCaseGeometry) {
  const r = radiusCss(tc.radius);
  return {
    root: { position: 'relative', width: px(tc.width), height: px(tc.height) } as StyleMap,
    side: { position: 'absolute', left: '0', right: '0', top: '10px', height: px(tc.height), 'border-radius': r, background: gradientCss(tc.side), 'box-shadow': shadowsCss(tc.sideShadows) } as StyleMap,
    deck: { position: 'absolute', left: '0', top: '0', width: px(tc.width), height: px(tc.height), 'border-radius': r, background: gradientCss(tc.deck), 'box-shadow': shadowsCss(tc.deckShadows) } as StyleMap,
    grainBox: { position: 'absolute', left: '0', top: '0', width: px(tc.width), height: px(tc.height), 'border-radius': r, overflow: 'hidden', 'pointer-events': 'none' } as StyleMap,
    dim: { position: 'absolute', left: '0', top: '0', width: px(tc.width), height: px(tc.height), 'border-radius': r, background: '#000', opacity: String(tc.dim), 'pointer-events': 'none', transition: 'opacity 300ms ease' } as StyleMap,
    well: {
      position: 'absolute',
      left: px(tc.well.x),
      top: px(tc.well.y),
      width: px(tc.well.w),
      height: px(tc.well.h),
      'box-sizing': 'border-box',
      padding: px(tc.well.pad),
      'border-radius': px(tc.well.radius),
      background: cssColor(tc.well.fill),
      'box-shadow': shadowsCss(tc.well.shadows),
      transition: 'background-color 300ms ease'
    } as StyleMap,
    grilles: tc.grilles.map(
      (g) =>
        ({
          position: 'absolute',
          left: px(g.x),
          top: px(g.y),
          width: px(g.w),
          height: px(g.h),
          'border-radius': '3px',
          'background-image': 'radial-gradient(circle,' + cssColor(g.dot) + ' ' + g.dotRadius + 'px,transparent ' + (g.dotRadius + 0.3) + 'px)',
          'background-size': g.pitch + 'px ' + g.pitch + 'px',
          'background-position': 'center'
        }) as StyleMap
    ),
    hinge: tc.hinge
      ? {
          bar: { position: 'absolute', left: px(tc.hinge.x), width: px(tc.hinge.w), top: '0', height: px(tc.hinge.h), 'border-radius': '0 0 3px 3px', background: 'linear-gradient(180deg, #000 0%, #0b0b0c 100%)' } as StyleMap,
          left: { position: 'absolute', left: px(tc.hinge.x), width: px(tc.hinge.barrelW), top: '0', height: px(tc.hinge.h), 'border-radius': '0 0 2px 3px', background: gradientCss(tc.hinge.barrel) } as StyleMap,
          right: { position: 'absolute', left: px(tc.hinge.x + tc.hinge.w - tc.hinge.barrelW), width: px(tc.hinge.barrelW), top: '0', height: px(tc.hinge.h), 'border-radius': '0 0 3px 2px', background: gradientCss(tc.hinge.barrel) } as StyleMap
        }
      : null,
    notch: tc.notch
      ? {
          lip: { position: 'absolute', left: px(tc.notch.x), top: px(tc.notch.y), width: px(tc.notch.w), height: px(tc.notch.h), 'border-radius': '0 0 5px 5px', background: gradientCss(tc.notch.fill), 'box-shadow': 'inset 4px 0 3px -2px rgba(0,0,0,.35), inset -4px 0 3px -2px rgba(0,0,0,.35)' } as StyleMap,
          scoop: { position: 'absolute', left: px(tc.notch.x), top: px(tc.notch.y - 6), width: px(tc.notch.w), height: '6px', 'border-radius': '50% 50% 0 0 / 100% 100% 0 0', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,' + tc.notch.scoopOpacity + ') 100%)' } as StyleMap
        }
      : null
  };
}

export function trackpadStyles(tp: TrackpadGeometry) {
  return {
    root: { position: 'relative', width: px(tp.width), height: px(tp.height + tp.sideDepth) } as StyleMap,
    side: { position: 'absolute', left: '0', right: '0', top: px(tp.sideDepth), height: px(tp.height), 'border-radius': px(tp.radius), background: gradientCss(tp.side), 'box-shadow': shadowsCss(tp.sideShadows) } as StyleMap,
    pad: { left: '0', top: '0', width: px(tp.width), height: px(tp.height), 'border-radius': px(tp.radius), overflow: 'hidden', background: gradientCss(tp.surface), 'box-shadow': shadowsCss(tp.shadows) } as StyleMap
  };
}

// ---- Lid (MacBook screen) -----------------------------------------------------------------------

export interface LidModel {
  height: number;
  lid: string;
  wall: string;
  ribbon: { a: string; hi: string; b: string; c: string };
  ink: string;
  barBg: string;
  widgetBg: string;
  widgetShadow: string;
  dockBg: string;
  apps: { bg: string; glyph: string }[];
}

const APPS: [string, string][] = [
  ['linear-gradient(180deg, #ffffff 0%, #e4e8ef 100%)', 'width: 16px; height: 14px; border-radius: 3px; background: linear-gradient(90deg, #2d7cf6 50%, #9fd0ff 50%);'],
  ['linear-gradient(180deg, #6fd3ff 0%, #1f7cff 100%)', 'width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.95);'],
  ['linear-gradient(180deg, #7cf08a 0%, #23b14d 100%)', 'width: 14px; height: 10px; border-radius: 6px; background: rgba(255,255,255,.95);'],
  ['linear-gradient(180deg, #ffffff 0%, #eceff3 100%)', 'width: 14px; height: 15px; border-radius: 3px; background: linear-gradient(180deg, #ff3b30 0 30%, #ffffff 30%); box-shadow: inset 0 0 0 1px #d6d9df;'],
  ['linear-gradient(180deg, #ffd84d 0%, #ff9f0a 100%)', 'width: 6px; height: 16px; border-radius: 3px; background: rgba(255,255,255,.95); transform: rotate(35deg);'],
  ['linear-gradient(180deg, #ff8a80 0%, #ff3b30 100%)', 'width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,.95);'],
  ['linear-gradient(180deg, #fffbe6 0%, #f4e6a6 100%)', 'width: 14px; height: 3px; border-radius: 2px; background: #c9a227; box-shadow: 0 5px 0 #d9b94a, 0 -5px 0 #c9a227;'],
  ['linear-gradient(180deg, #d7a8ff 0%, #8e44ff 100%)', 'width: 14px; height: 14px; border-radius: 4px; border: 2.5px solid rgba(255,255,255,.9);'],
  ['linear-gradient(180deg, #5ee0d0 0%, #10a39a 100%)', 'width: 12px; height: 12px; background: rgba(255,255,255,.95); clip-path: polygon(50% 0, 100% 100%, 0 100%);'],
  ['linear-gradient(180deg, #3a3a40 0%, #141417 100%)', 'width: 14px; height: 9px; border-radius: 2px; border: 2px solid #4cd964;'],
  ['linear-gradient(180deg, #ffffff 0%, #e9ecf1 100%)', 'width: 14px; height: 14px; border-radius: 50%; background: conic-gradient(#ff3b30 0 25%, #ffcc00 0 50%, #34c759 0 75%, #007aff 0);'],
  ['linear-gradient(180deg, #9be7ff 0%, #2bb7f0 100%)', 'width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.9); border-top-color: transparent;']
];

export function lidModel(finish: FinishId | string, height: number): LidModel {
  const f = getFinish(finish);
  const rib = f.ribbon;
  const darkInk = !!rib[3];
  return {
    height,
    lid: 'linear-gradient(180deg, ' + f.lid[0] + ' 0%, ' + f.lid[1] + ' 45%, ' + f.lid[2] + ' 100%)',
    wall: f.wall,
    ribbon: { a: rib[0], hi: rib[1], b: rib[2], c: rib[4] || rib[0] },
    ink: darkInk ? '#ffffff' : '#111114',
    barBg: darkInk ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.12)',
    widgetBg: darkInk ? 'rgba(255,255,255,.16)' : 'rgba(40,30,20,.12)',
    widgetShadow: darkInk ? 'inset 0 0 0 1px rgba(255,255,255,.28), 0 4px 12px rgba(0,0,0,.18)' : 'inset 0 0 0 1px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.5), 0 4px 12px rgba(0,0,0,.12)',
    dockBg: darkInk ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.26)',
    apps: APPS.map(([bg, glyph]) => ({ bg, glyph }))
  };
}

/** Converts a `prop: value; ...` style string to a map. */
export function parseStyle(s: string): StyleMap {
  const out: StyleMap = {};
  s.split(';').forEach((d) => {
    const i = d.indexOf(':');
    if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  });
  return out;
}

/** Converts a style map to a `style` attribute string. */
export function styleString(m: StyleMap): string {
  return Object.entries(m)
    .map(([k, v]) => k + ':' + v)
    .join(';');
}

/** Converts kebab-case keys to camelCase, for React (custom properties keep their dashes). */
export function reactStyle(m: StyleMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) out[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return out;
}
