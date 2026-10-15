// A small element factory for the DOM renderer. SVG tags get the SVG namespace.
import { StyleMap, styleString } from '@mackeys/core';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'defs', 'radialGradient', 'linearGradient', 'stop', 'filter', 'feTurbulence', 'feColorMatrix', 'feGaussianBlur', 'rect', 'g']);

export type Attrs = Record<string, string | number | boolean | StyleMap | null | undefined>;
export type Child = Node | string | null | undefined | false;

/** Creates an element. `style` takes a string or a style map; `false`, `null` and `undefined` attributes are left out. */
export function h<T extends Element = HTMLElement>(doc: Document, tag: string, attrs: Attrs = {}, children: Child[] = []): T {
  const el = SVG_TAGS.has(tag) ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    el.setAttribute(k, k === 'style' && typeof v === 'object' ? styleString(v) : v === true ? '' : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
  return el as unknown as T;
}

/** Sets the whole inline style of an element from a style map. */
export function setStyle(el: Element, m: StyleMap) {
  el.setAttribute('style', styleString(m));
}

let seq = 0;
/** A unique id for SVG references inside one view. */
export const uid = (prefix: string) => prefix + '-' + (++seq).toString(36);
