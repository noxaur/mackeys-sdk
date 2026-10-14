// Colors and lighting for key caps, the keyboard well and the top case, including the backlight model.
import { FinishId, MODELS, ModelId, getFinish } from './data';
import { Color, Gradient, Rect, Shadow, color, grad2, parseColor, rgba, shadow } from './util';
import { KeyboardGeometry } from './keyboard';

export type Room = 'daylight' | 'dark';

export interface BacklightOptions {
  /** The backlight switch. Only MacBook Pro and Air have a backlight. Default false. */
  on?: boolean;
  /** Brightness in sixteenths, 0 to 16, as macOS steps it. Default 12. */
  level?: number;
  /** The room: daylight lowers the eye's exposure, so the same light reads weaker. Default daylight. */
  room?: Room;
  /** How much light spills out around each cap, 0 to 1. Default 0.5. */
  bleed?: number;
  /** Light color. Default `#f2f5ff`. */
  color?: string;
  /** True while the idle timer has switched the light off. */
  idle?: boolean;
}

export interface TextGlow {
  blur: number;
  color: Color;
}

export interface KeyboardTheme {
  /** Key cap face: a radial gradient (125% x 110% at bottom center) from `face1` at the center to `face0` at the edge. */
  face0: Color;
  face1: Color;
  /** 1 px inner outline of every cap. */
  outline: Color;
  /** 1.8 px inner highlight along the top edge of every cap. */
  highlight: Color;
  /** Outer shadows of every cap (drop shadow, and backlight bleed when lit). */
  capShadows: Shadow[];
  legend: Color;
  /** Glow around legend text when the backlight is on. */
  legendGlow: TextGlow[];
  /** Glow around icon legends when the backlight is on. */
  iconGlow: TextGlow[];
  /** Brightness factor for a pressed key (1 = unchanged). */
  pressedBrightness: number;
  /** Caps lock LED off and on. */
  capsLedOff: Color;
  capsLedOn: Color;
  capsLedGlow: TextGlow[];
  homeBar: Color;
  /** Touch ID ring style. */
  touchId: 'dark' | 'light' | 'flush';
  /** Brightness factor for the Touch ID button (dimmed in a dark room). */
  touchIdBrightness: number;
  /** Lit backlight level after the room's exposure, 0 to 1. */
  glow: number;
}

const DEFAULT_GLOW = '#f2f5ff';

function lightRgb(c?: string): [number, number, number] {
  let hx = String(c ?? DEFAULT_GLOW);
  try {
    const p = parseColor(hx);
    return [p.r, p.g, p.b];
  } catch {
    hx = hx.replace('#', '').padEnd(6, 'f').slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(hx.substr(i, 2), 16) || 0) as [number, number, number];
  }
}

/** Backlight level after the room's exposure, 0 to 1. Zero on models with no backlight. */
export function backlightGlow(finish: FinishId | string, bl: BacklightOptions = {}): number {
  const f = getFinish(finish);
  const backlit = f.model === 'pro' || f.model === 'air';
  const on = backlit && !!bl.on && !bl.idle;
  const raw = Number.isFinite(bl.level as number) ? (bl.level as number) : 12;
  const step = Math.max(0, Math.min(16, Math.round(raw)));
  const g = on ? step / 16 : 0;
  // One light source: the keyboard emits the same light in any room. Daylight lights everything else and the
  // eye adapts to it (lower exposure), so the same light reads weaker.
  const E = bl.room === 'dark' ? 1 : 0.42;
  return g * E;
}

const clamp01 = (v: number | undefined, d: number) => Math.max(0, Math.min(1, Number.isFinite(v as number) ? (v as number) : d));

export function keyboardTheme(finish: FinishId | string, bl: BacklightOptions = {}): KeyboardTheme {
  const f = getFinish(finish);
  const lightKeys = f.model === 'neo' || f.model === 'mk';
  const backlit = !lightKeys;
  const dark = bl.room === 'dark';
  const e = backlightGlow(finish, bl);
  const bleed = clamp01(bl.bleed, 0.5);
  const LC = lightRgb(bl.color);
  const glowA = (a: number) => rgba(LC[0], LC[1], LC[2], Math.max(0, a));
  const addLight = (base: number[], k: number) => rgba(...(base.map((v, i) => Math.min(255, Math.round(v + LC[i] * k))) as [number, number, number]));

  const t: KeyboardTheme = lightKeys
    ? {
        face0: color(f.kf!),
        face1: darken(f.kf!, 0.965),
        outline: color('rgba(0,0,0,.8)'),
        highlight: color('rgba(255,255,255,.5)'),
        capShadows: [shadow(0, 1, 1.5, 0, 'rgba(0,0,0,.14)')],
        legend: color(f.kl!),
        legendGlow: [],
        iconGlow: [],
        pressedBrightness: 0.93,
        capsLedOff: color('rgba(0,0,0,.36)'),
        capsLedOn: color('#3ddc5c'),
        capsLedGlow: [],
        homeBar: color(f.kl!),
        touchId: f.model === 'neo' ? 'flush' : 'light',
        touchIdBrightness: 1,
        glow: 0
      }
    : {
        face0: color('#1c1c1e'),
        face1: color('#2e2e30'),
        outline: color('#050506'),
        highlight: color('rgba(255,255,255,.15)'),
        capShadows: [shadow(0, 1, 1.5, 0, 'rgba(0,0,0,.5)')],
        legend: color('#dcdcdf'),
        legendGlow: [],
        iconGlow: [],
        pressedBrightness: 0.84,
        capsLedOff: color('#8e8e93'),
        capsLedOn: color('#3ddc5c'),
        capsLedGlow: [],
        homeBar: color('rgba(222,222,226,.55)'),
        touchId: 'dark',
        touchIdBrightness: 1,
        glow: e
      };
  t.capsLedGlow = [
    { blur: 2, color: color('rgba(61,220,92,.9)') },
    { blur: 6, color: color('rgba(61,220,92,.45)') }
  ];
  if (backlit && dark) {
    t.face0 = color('#0b0b0c');
    t.face1 = color('#141416');
    t.highlight = color('rgba(255,255,255,.03)');
    t.capsLedOff = color('#2c2c2e');
    t.homeBar = color('rgba(60,60,64,.6)');
    t.touchIdBrightness = 0.32;
  }
  if (backlit && e > 0) {
    // Legends: the light shining through the cut-out print, added to what the room already shows.
    t.legend = addLight(dark ? [40, 40, 43] : [220, 220, 223], Math.pow(e, 0.6));
    t.legendGlow = [
      { blur: 0.6, color: glowA(0.9 * e) },
      { blur: 2, color: glowA(0.55 * e) },
      { blur: 5, color: glowA(0.25 * e) }
    ];
    t.iconGlow = [
      { blur: 0.6, color: glowA(0.85 * e) },
      { blur: 2.5, color: glowA(0.4 * e) }
    ];
    // Light spilling out around each cap: a bright rim at the edge and a softer pool in the gap.
    t.capShadows = [
      shadow(0, 0, 1 + 1.5 * bleed, 0, glowA(0.95 * e * bleed)),
      shadow(0, 0, 3 + 5 * bleed, 0, glowA(0.45 * e * bleed)),
      shadow(0, 1, 1.5, 0, 'rgba(0,0,0,.6)')
    ];
    t.face1 = addLight(dark ? [20, 20, 22] : [46, 46, 48], 0.05 * e * bleed);
  }
  return t;
}

function darken(hex: string, k: number): Color {
  const p = parseColor(hex);
  return rgba(Math.round(p.r * k), Math.round(p.g * k), Math.round(p.b * k), 1);
}

// ---- Top case -----------------------------------------------------------------------------------

export interface TopCaseOptions {
  /** `full` = the whole MacBook top case with trackpad, hinge and front notch; `keyboard` = the keyboard deck only. */
  parts?: 'full' | 'keyboard';
  backlight?: BacklightOptions;
}

export interface TopCaseGeometry {
  model: ModelId;
  full: boolean;
  width: number;
  height: number;
  /** Corner radii: top-left, top-right, bottom-right, bottom-left. */
  radius: [number, number, number, number];
  deck: Gradient;
  deckShadows: Shadow[];
  /** The base under the deck, offset 10 px down: the visible side wall. */
  side: Gradient;
  sideShadows: Shadow[];
  /** Opacity of the aluminium grain overlay (fractal noise, overlay blend). */
  grain: number;
  /** Black overlay on the deck in a dark room. */
  dim: number;
  well: Rect & { radius: number; pad: number; fill: Color; shadows: Shadow[] };
  /** Origin of the keyboard inside the top case. */
  keyboard: { x: number; y: number };
  grilles: (Rect & { dot: Color; pitch: number; dotRadius: number })[];
  trackpad: (Rect & { radius: number }) | null;
  hinge: { x: number; w: number; h: number; barrelW: number; barrel: Gradient } | null;
  /** The finger notch at the front edge. */
  notch: { x: number; y: number; w: number; h: number; fill: Gradient; scoopOpacity: number } | null;
  /** Page background behind the device, as on the canvas. */
  pageBackground: Color;
}

export function topCase(finish: FinishId | string, kb: KeyboardGeometry, opts: TopCaseOptions = {}): TopCaseGeometry {
  const f = getFinish(finish);
  const M = MODELS[f.model];
  const full = opts.parts === 'full' && f.model !== 'mk';
  const bl = opts.backlight || {};
  const backlit = f.model === 'pro' || f.model === 'air';
  const dark = bl.room === 'dark';
  const e = backlightGlow(finish, bl);
  const bleed = clamp01(bl.bleed, 0.5);
  const LC = lightRgb(bl.color);
  const wellGlow = backlit && e > 0 ? 0.07 * e * bleed : 0;
  const isPro = f.model === 'pro';
  const pad = M.wellPad;
  const W = M.W;
  const kbX = (W - kb.width) / 2;
  const wellH = kb.height + 2 * pad;
  const H = full || f.model === 'mk' ? M.H : M.kbY * 2 + kb.height;
  const r = full || f.model === 'mk' ? M.radius : ([22, 22, 22, 22] as [number, number, number, number]);
  const addLight = (base: number[], k: number) => rgba(...(base.map((v, i) => Math.min(255, Math.round(v + LC[i] * k))) as [number, number, number]));
  const edge = f.edge;
  const wellFill = isPro
    ? addLight(dark ? [6, 6, 7] : [18, 20, 22], wellGlow)
    : f.model === 'air' && wellGlow > 0
      ? rgba(LC[0], LC[1], LC[2], wellGlow)
      : color('transparent');
  const wellShadows =
    f.model === 'mk'
      ? []
      : isPro
        ? [shadow(0, 0, 0, 1, '#000', true), shadow(0, 1, 3, 0, 'rgba(0,0,0,.8)', true), shadow(0, 0, 0, 1, edge)]
        : [
            shadow(0, 1.5, 2.5, 0, 'rgba(0,0,0,' + (f.dark ? '.45' : '.16') + ')', true),
            shadow(0, 0, 0, 1, 'rgba(0,0,0,' + (f.dark ? '.28' : '.07') + ')', true),
            shadow(0, -1, 0, 0, edge, true),
            shadow(0, 1, 0, 0, edge),
            shadow(0, -1, 0, 0, 'rgba(0,0,0,' + (f.dark ? '.18' : '.05') + ')')
          ];
  const lid = f.lid;
  return {
    model: f.model,
    full,
    width: W,
    height: H,
    radius: r,
    deck: grad2(f.deck),
    deckShadows: [shadow(0, 0, 0, 1, edge, true), shadow(0, -1, 1, 0, 'rgba(0,0,0,' + (f.dark ? '.35' : '.06') + ')', true)],
    side: grad2(f.side),
    sideShadows: [shadow(0, 1, 1, 0, 'rgba(0,0,0,.22)'), shadow(0, 12, 24, 0, 'rgba(0,0,0,.10)'), shadow(0, 40, 70, -26, 'rgba(0,0,0,.40)')],
    grain: isPro && f.dark ? 0.25 : 0.14,
    dim: backlit && dark ? 0.8 : 0,
    well: { x: kbX - pad, y: M.kbY - pad, w: kb.width + 2 * pad, h: wellH, radius: 12, pad, fill: wellFill, shadows: wellShadows },
    keyboard: { x: kbX, y: M.kbY },
    grilles: M.grille
      ? [
          { x: 5, y: M.kbY + 7, w: 45, h: wellH - 28, dot: color(f.dot), pitch: 3.3, dotRadius: 0.75 },
          { x: W - 5 - 45, y: M.kbY + 7, w: 45, h: wellH - 28, dot: color(f.dot), pitch: 3.3, dotRadius: 0.75 }
        ]
      : [],
    trackpad: full ? { x: (W - M.padW) / 2, y: M.padY, w: M.padW, h: M.padH, radius: 9 } : null,
    hinge: full
      ? {
          x: M.hingeX,
          w: W - 2 * M.hingeX,
          h: 14,
          barrelW: 52,
          barrel: { stops: [{ color: color(lid[1]), at: 0 }, { color: color(lid[2]), at: 0.7 }, { color: color(f.dark ? '#141315' : f.side[1]), at: 1 }] }
        }
      : null,
    notch: full
      ? {
          x: W / 2 - 88,
          y: H,
          w: 176,
          h: 10,
          fill: { stops: [{ color: color(lid[2]), at: 0 }, { color: color(lid[1]), at: 0.6 }, { color: color(lid[0]), at: 1 }] },
          scoopOpacity: f.dark ? 0.35 : 0.1
        }
      : null,
    pageBackground: color(backlit && dark ? '#060607' : '#f2f2f2')
  };
}

// ---- Trackpad -----------------------------------------------------------------------------------

export interface TrackpadGeometry {
  width: number;
  height: number;
  radius: number;
  surface: Gradient;
  side: Gradient;
  /** Depth of the visible side under the glass. */
  sideDepth: number;
  shadows: Shadow[];
  sideShadows: Shadow[];
  grain: number;
  label: string;
}

/** The standalone Force Touch trackpad of a MacBook finish (Magic Keyboard finishes fall back to Space Black). */
export function trackpad(finish: FinishId | string): TrackpadGeometry {
  let f = getFinish(finish);
  if (f.model === 'mk') f = getFinish('pro-space-black');
  const w = f.model === 'neo' ? 390.5 : f.model === 'pro' ? 437 : 432.5;
  const h = f.model === 'neo' ? 243.5 : f.model === 'pro' ? 272.7 : 270.1;
  return {
    width: w,
    height: h,
    radius: 10,
    surface: grad2(f.pad),
    side: grad2(f.side),
    sideDepth: 6,
    shadows: [shadow(0, 0, 0, 1, f.edge), shadow(0, 0, 0, 1, 'rgba(0,0,0,' + (f.dark ? '.55' : '.13') + ')', true), shadow(0, 2, 0, 0, f.edge, true)],
    sideShadows: [shadow(0, 1, 1, 0, 'rgba(0,0,0,.2)'), shadow(0, 10, 20, 0, 'rgba(0,0,0,.10)'), shadow(0, 30, 50, -18, 'rgba(0,0,0,.38)')],
    grain: f.model === 'pro' && f.dark ? 0.25 : 0.14,
    label: f.name + ' Force Touch trackpad. Click, or press and hold for a force click.'
  };
}

/** Shadows of the built-in trackpad inside a MacBook top case (same as the standalone one). */
export function trackpadShadows(finish: FinishId | string): Shadow[] {
  const f = getFinish(finish);
  return [shadow(0, 0, 0, 1, f.edge), shadow(0, 0, 0, 1, 'rgba(0,0,0,' + (f.dark ? '.55' : '.13') + ')', true), shadow(0, 2, 0, 0, f.edge, true)];
}
