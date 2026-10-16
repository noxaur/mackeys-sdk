// The open MacBook lid as one static HTML string. It is decoration only (aria-hidden), so DOM renderers
// without a template language (plain DOM, Vue render functions) insert it as it is.
import type { FinishId } from './data';
import { lidModel, parseStyle, styleString } from './dom';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The lid markup. `id` prefixes the SVG filter and gradient ids; make it unique per lid. */
export function lidHtml(finish: FinishId, width: number, height: number, id: string): string {
  const m = lidModel(finish, height);
  const widget = 'background:' + m.widgetBg + ';color:' + m.ink + ';box-shadow:' + m.widgetShadow;
  const apps = m.apps.map((a) => `<span class="mk-app" style="${esc('background:' + a.bg)}"><span class="mk-gl" style="${esc(styleString(parseStyle(a.glyph)))}"></span></span>`).join('');
  const menu = ['File', 'Edit', 'View', 'Go', 'Window', 'Help'].map((t) => `<span>${t}</span>`).join('');
  return `<div aria-hidden="true" class="mk-lid" style="position:absolute;left:0;width:${width}px;top:${-height}px;height:${height}px;transform:perspective(4200px) rotateX(-80deg);transform-origin:50% 100%">
<div style="${esc('position:absolute;inset:0;border-radius:20px 20px 12px 12px;background:' + m.lid + ';box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.4), 0 0 0 1px rgba(0,0,0,.3)')}"></div>
<div style="position:absolute;top:3px;bottom:3px;left:2px;right:2px;border-radius:17px 17px 9px 9px;background:#050506;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.12)"></div>
<div style="${esc('position:absolute;left:6px;right:6px;top:14px;bottom:18px;border-radius:10px 10px 2px 2px;overflow:hidden;background:' + m.wall)}">
<svg width="100%" height="100%" viewBox="0 0 1000 650" preserveAspectRatio="none" style="position:absolute;inset:0;display:block">
<defs>
<filter id="${id}b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
<linearGradient id="${id}A" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${esc(m.ribbon.a)}" stop-opacity="0.55"/>
<stop offset="0.5" stop-color="${esc(m.ribbon.a)}" stop-opacity="1"/>
<stop offset="1" stop-color="${esc(m.ribbon.hi)}" stop-opacity="0.5"/>
</linearGradient>
</defs>
<g filter="url(#${id}s)"><path d="M-60 600C170 470 330 380 490 420S790 560 1060 230L1060 330C820 680 600 600 470 520S200 600 -60 680Z" fill="${esc(m.ribbon.b)}" opacity="0.35"/></g>
<g filter="url(#${id}b)">
<path d="M300 -30C450 110 520 210 700 225S950 150 1060 255L1060 300C900 265 760 320 615 300S420 160 300 -30Z" fill="${esc(m.ribbon.c)}" opacity="0.85"/>
<path d="M-60 520C150 380 300 250 480 300S780 520 1060 110L1060 165C820 620 600 560 470 470S200 520 -60 565Z" fill="url(#${id}A)"/>
<path d="M-60 545C170 440 322 330 482 365S762 520 1060 140L1060 158C802 560 602 500 482 430S182 515 -60 555Z" fill="${esc(m.ribbon.b)}" opacity="0.95"/>
</g>
<path d="M-60 520C150 380 300 250 480 300S780 520 1060 110" fill="none" stroke="#f4fbff" stroke-opacity="0.9" stroke-width="5" filter="url(#${id}b)"/>
<path d="M300 -30C450 110 520 210 700 225S950 150 1060 255" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="3" filter="url(#${id}b)"/>
</svg>
<div style="position:absolute;inset:0;background:radial-gradient(120% 95% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%), linear-gradient(180deg, rgba(0,0,0,.14) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 80%, rgba(0,0,0,.18) 100%)"></div>
<div class="mk-menubar" style="${esc('color:' + m.ink + ';background:' + m.barBg)}">
<span style="display:flex;gap:14px;align-items:center"><span style="font-weight:700">Finder</span>${menu}</span>
<span style="display:flex;gap:13px;align-items:center"><span class="mk-wifi"></span><span class="mk-bat"><span></span></span><span class="mk-search"></span><span class="mk-cc"><span></span><span></span></span><span>Tue 9:41</span></span>
</div>
<div class="mk-widgets">
<div class="mk-widget" style="${esc(widget)}"><span class="mk-temp">14°</span><span class="mk-sun"></span></div>
<div class="mk-widget" style="${esc(widget)}"><span class="mk-ring"></span><span class="mk-temp">49%</span></div>
</div>
<div class="mk-dock" style="${esc('background:' + m.dockBg)}">${apps}<span class="mk-dock-sep"></span><span class="mk-app" style="background:linear-gradient(160deg, #f2f2f4 0%, #c9cbd1 100%)"></span></div>
<div class="mk-glass"></div>
<div class="mk-glimmer"></div>
</div>
<div style="position:absolute;left:50%;top:3px;width:108px;height:22px;margin-left:-54px;border-radius:0 0 9px 9px;background:#050506"></div>
<div style="position:absolute;left:50%;top:9px;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:radial-gradient(circle at 35% 35%, #2a3550 0%, #0b0d14 60%)"></div>
</div>`;
}
