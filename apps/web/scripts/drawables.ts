// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The phone app's drawn images on the web (#250): each Android vector
// drawable in res/drawable, the line icons, the chalk and the mark, written
// as an SVG of the same name, so the app's `{ uri: 'icon_offline' }` finds
// it. Only what the drawables use is read: the vector's size and viewport,
// paths with their fill and stroke, and groups moved by a translation.
// Any other element or attribute in a vector, such as autoMirrored, stops
// the build rather than drawing it wrong.

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

function path(attributes: string): string {
  const d = attribute(attributes, 'pathData');
  if (d === undefined) throw new Error('A path without pathData');
  const width = attribute(attributes, 'strokeWidth');
  const cap = attribute(attributes, 'strokeLineCap');
  const join = attribute(attributes, 'strokeLineJoin');
  return (
    `<path d="${d}"${paint(attributes, 'fill')}${paint(attributes, 'stroke')}` +
    `${width === undefined ? '' : ` stroke-width="${width}"`}${cap === undefined ? '' : ` stroke-linecap="${cap}"`}` +
    `${join === undefined ? '' : ` stroke-linejoin="${join}"`}/>`
  );
}

/** The SVG of an Android vector drawable, or null when the file is not a vector. */
export function vectorToSvg(xml: string): string | null {
  const vector = /<vector\b([^>]*)>([\s\S]*)<\/vector>/u.exec(xml);
  if (vector === null) return null;
  const [, head = '', body = ''] = vector;
  checkAttributes('vector', head);
  const size = (name: string) => attribute(head, name)?.replace(/dp$/u, '');
  const parts = body
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<(\/?)(\w+)\b([^>]*?)\/?>/gu, (_, close, tag, attributes) => {
      if (tag === 'path' || tag === 'group') checkAttributes(tag as string, attributes as string);
      if (tag === 'path') return path(attributes as string);
      if (tag === 'group' && close === '/') return '</g>';
      if (tag === 'group') {
        const x = attribute(attributes as string, 'translateX') ?? '0';
        const y = attribute(attributes as string, 'translateY') ?? '0';
        return `<g transform="translate(${x} ${y})">`;
      }
      throw new Error(`A vector's <${tag as string}> is not drawn on the web`);
    });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size('width')}" height="${size('height')}" ` +
    `viewBox="0 0 ${attribute(head, 'viewportWidth')} ${attribute(head, 'viewportHeight')}">${parts.trim()}</svg>\n`
  );
}
