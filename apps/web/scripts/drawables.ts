// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The phone app's drawn images on the web (#250): each Android vector
// drawable in res/drawable, the line icons, the chalk and the mark, written
// as an SVG of the same name, so the app's `{ uri: 'icon_offline' }` finds
// it. Only what the drawables use is read: the vector's size and viewport,
// paths with their fill and stroke, and groups moved by a translation.
// Any other element, attribute, text or value in a vector, such as
// autoMirrored, stops the build rather than drawing it wrong; each value is
// checked before it goes into the SVG.

/** The attributes each element may carry, which the SVG draws. */
const DRAWN: Readonly<Record<string, ReadonlySet<string>>> = {
  vector: new Set(['width', 'height', 'viewportWidth', 'viewportHeight']),
  path: new Set(['pathData', 'fillColor', 'strokeColor', 'strokeWidth', 'strokeLineCap', 'strokeLineJoin']),
  group: new Set(['translateX', 'translateY']),
};

/** Refuses an `android:` attribute the element's SVG would not draw. */
function checkAttributes(tag: string, attributes: string): void {
  for (const [, name] of attributes.matchAll(/android:(\w+)=/gu))
    if (name === undefined || DRAWN[tag]?.has(name) !== true)
      throw new Error(`A vector's <${tag}> android:${name ?? ''} is not drawn on the web`);
}

/** A number as an attribute holds it, refused otherwise. */
function number(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/u.test(value)) throw new Error(`Not a number: ${JSON.stringify(value)}`);
  return value;
}

/** The value of `android:name` in the element's attributes, or undefined. */
function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`android:${name}="([^"]*)"`, 'u').exec(attributes)?.[1];
}

/** An Android colour, #RGB, #RRGGBB or #AARRGGBB, as an SVG colour and its opacity. */
export function svgColour(colour: string): { colour: string; opacity: number } {
  const hex = colour.slice(1);
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.test(hex)) throw new Error(`Colour ${colour}`);
  if (hex.length !== 8) return { colour, opacity: 1 };
  return { colour: `#${hex.slice(2)}`, opacity: Math.round((parseInt(hex.slice(0, 2), 16) / 255) * 1000) / 1000 };
}

function paint(attributes: string, kind: 'fill' | 'stroke'): string {
  const value = attribute(attributes, `${kind}Color`);
  if (value === undefined) return kind === 'fill' ? ' fill="none"' : '';
  const { colour, opacity } = svgColour(value);
  return ` ${kind}="${colour}"${opacity === 1 ? '' : ` ${kind}-opacity="${opacity}"`}`;
}

/** One of the words an attribute may hold, refused otherwise. */
function word(value: string | undefined, words: readonly string[]): string | undefined {
  if (value !== undefined && !words.includes(value)) throw new Error(`Not one of ${words.join(', ')}: ${value}`);
  return value;
}

function path(attributes: string): string {
  const d = attribute(attributes, 'pathData');
  if (d === undefined) throw new Error('A path without pathData');
  if (!/^[\d\s.,+\-eEMmLlHhVvCcSsQqTtAaZz]+$/u.test(d)) throw new Error(`Path data ${JSON.stringify(d)}`);
  const stroke = attribute(attributes, 'strokeWidth');
  const width = stroke === undefined ? undefined : number(stroke);
  const cap = word(attribute(attributes, 'strokeLineCap'), ['butt', 'round', 'square']);
  const join = word(attribute(attributes, 'strokeLineJoin'), ['miter', 'round', 'bevel']);
  return (
    `<path d="${d}"${paint(attributes, 'fill')}${paint(attributes, 'stroke')}` +
    `${width === undefined ? '' : ` stroke-width="${width}"`}${cap === undefined ? '' : ` stroke-linecap="${cap}"`}` +
    `${join === undefined ? '' : ` stroke-linejoin="${join}"`}/>`
  );
}

/** One piece of a vector's body: a comment, a tag with its parts, or the text between. */
const TOKEN = /(<!--[\s\S]*?--!?>)|<(\/?)(\w+)\b([^<>]*?)(\/?)>|([^<]+)|([\s\S])/gu;

/** The SVG element for one tag of the vector's body, with `depth` the groups open around it. */
function element(close: string, tag: string, attributes: string, alone: string, depth: number): string {
  if (tag !== 'path' && tag !== 'group') throw new Error(`A vector's <${tag}> is not drawn on the web`);
  checkAttributes(tag, attributes);
  if (tag === 'path') return path(attributes);
  if (alone === '/') throw new Error('A group that closes itself');
  if (close === '/' && depth === 0) throw new Error('A group closed that is not open');
  if (close === '/') return '</g>';
  const x = number(attribute(attributes, 'translateX') ?? '0');
  const y = number(attribute(attributes, 'translateY') ?? '0');
  return `<g transform="translate(${x} ${y})">`;
}

/** The SVG of an Android vector drawable, or null when the file is not a vector. */
export function vectorToSvg(xml: string): string | null {
  const vector = /<vector\b([^>]*)>([\s\S]*)<\/vector>/u.exec(xml);
  if (vector === null) return null;
  const [, head = '', body = ''] = vector;
  checkAttributes('vector', head);
  const size = (name: string) => number(attribute(head, name)?.replace(/dp$/u, '') ?? '');
  let depth = 0;
  const parts = [...body.matchAll(TOKEN)].map(
    ([, comment, close = '', tag, attributes = '', alone = '', text, other]) => {
      if (comment !== undefined) return '';
      if (tag !== undefined) {
        const svg = element(close, tag, attributes, alone, depth);
        if (tag === 'group') depth += close === '/' ? -1 : 1;
        return svg;
      }
      if (text !== undefined && text.trim() === '') return '';
      throw new Error(`A vector holds ${JSON.stringify(text ?? other)}, which is not drawn on the web`);
    },
  );
  if (depth !== 0) throw new Error('A group left open');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size('width')}" height="${size('height')}" ` +
    `viewBox="0 0 ${size('viewportWidth')} ${size('viewportHeight')}">${parts.join('')}</svg>\n`
  );
}
