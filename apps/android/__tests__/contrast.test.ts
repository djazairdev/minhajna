// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { colorRoles, colors } from '../src/design/tokens';

type Rgb = readonly [number, number, number];

// Test-only support for the palette's #RRGGBB and rgba() formats. Never assume
// white behind transparency: resolve each layer onto its actual opaque ground.
// https://www.w3.org/TR/compositing-1/#simplealphacompositing
function on(color: string, ground?: Rgb): Rgb {
  if (/^#[\da-f]{6}$/i.test(color)) {
    return [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ];
  }
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+)\s*\)$/.exec(color);
  if (!rgba || !ground) throw new Error(`Unsupported colour or missing opaque ground: ${color}`);
  const red = Number(rgba[1]);
  const green = Number(rgba[2]);
  const blue = Number(rgba[3]);
  const alpha = Number(rgba[4]);
  if ([red, green, blue].some((channel) => channel > 255)) throw new Error(`Invalid colour: ${color}`);
  return [
    red * alpha + ground[0] * (1 - alpha),
    green * alpha + ground[1] * (1 - alpha),
    blue * alpha + ground[2] * (1 - alpha),
  ];
}

// WCAG 2.2 relative luminance and contrast, not a brightness approximation.
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function luminance(rgb: Rgb): number {
  const linear = rgb.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: Rgb, background: Rgb): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('contrast calculation', () => {
  test('gives 21:1 for black and white in either order, and 1:1 for identical colours', () => {
    const black = on('#000000');
    const white = on('#FFFFFF');
    expect(contrast(black, white)).toBe(21);
    expect(contrast(white, black)).toBe(21);
    expect(contrast(on(colors.paper), on(colors.paper))).toBe(1);
  });

  test('does not round a near miss up to the text minimum', () => {
    const ratio = contrast(on('#777777'), on('#FFFFFF'));
    expect(ratio).toBeCloseTo(4.4780894536, 10);
    expect(ratio).toBeLessThan(4.5);
  });

  test('uses the linear sRGB branch for dark channels', () => {
    expect(luminance(on('#0A0A0A'))).toBeCloseTo(10 / 255 / 12.92, 12);
  });

  test.each([
    ['#FF0000', 0.2126],
    ['#00FF00', 0.7152],
    ['#0000FF', 0.0722],
  ] as const)('uses the WCAG luminance weight for %s', (color, expected) => {
    expect(luminance(on(color))).toBeCloseTo(expected, 12);
  });

  test('composites alpha before linearising, without rounding the channels', () => {
    expect(on('rgba(255,0,0,.5)', on('#0000FF'))).toEqual([127.5, 0, 127.5]);
    expect(on('rgba(255,0,0,0)', on(colors.board))).toEqual(on(colors.board));
    expect(on('rgba(255,0,0,1)', on(colors.board))).toEqual(on('#FF0000'));
  });

  test('refuses unsupported colours and transparency without a ground', () => {
    expect(() => on('white')).toThrow('Unsupported colour');
    expect(() => on('rgba(255,255,255,.5)')).toThrow('missing opaque ground');
    expect(() => on('rgba(256,0,0,.5)', on(colors.sheet))).toThrow('Invalid colour');
  });
});

// All text uses the ordinary-text minimum, including the small attribution.
// https://www.w3.org/TR/WCAG22/#contrast-minimum
describe.each(['paper', 'sheet'] as const)('text on %s', (groundName) => {
  test.each(['ink', 'ink2', 'pencil'] as const)('%s reaches 4.5:1', (foregroundName) => {
    const ground = on(colors[groundName]);
    expect(contrast(on(colors[foregroundName], ground), ground)).toBeGreaterThanOrEqual(4.5);
  });
});

test('chalk text on board reaches 4.5:1', () => {
  const ground = on(colors.board);
  expect(contrast(on(colors.chalk, ground), ground)).toBeGreaterThanOrEqual(4.5);
});

// Map attribution has a translucent backing on the sheet and its dot pattern.
// Include paper too so moving the map onto the page does not weaken the text.
test.each(['sheet', 'map-dots', 'paper'] as const)(
  'map attribution on map-label-ground over %s reaches 4.5:1',
  (canvasName) => {
    const ground = on(colors['map-label-ground'], on(colors[canvasName]));
    expect(contrast(on(colorRoles.mapAttribution, ground), ground)).toBeGreaterThanOrEqual(4.5);
  },
);

// https://www.w3.org/TR/WCAG22/#non-text-contrast
describe.each(['paper', 'sheet'] as const)('non-text parts on %s', (groundName) => {
  test.each(['controlBorder', 'mapLink'] as const)('%s reaches 3:1', (role) => {
    const ground = on(colors[groundName]);
    expect(contrast(on(colorRoles[role], ground), ground)).toBeGreaterThanOrEqual(3);
  });

  test('focus ring reaches 3:1', () => {
    const ground = on(colors[groundName]);
    expect(contrast(on(colors.focus, ground), ground)).toBeGreaterThanOrEqual(3);
  });
});

test('sidebar control border on board reaches 3:1 after compositing', () => {
  const ground = on(colors.board);
  expect(contrast(on(colorRoles.boardControlBorder, ground), ground)).toBeGreaterThanOrEqual(3);
});

test('focus ring on board reaches 3:1', () => {
  const ground = on(colors.board);
  expect(contrast(on(colors['focus-on-board'], ground), ground)).toBeGreaterThanOrEqual(3);
});

test('the accessible roles use the design accessibility table’s proposed fixes', () => {
  expect(colorRoles).toEqual({
    controlBorder: colors['book-edge'],
    mapLink: colors['book-edge'],
    mapAttribution: colors.ink2,
    boardControlBorder: colors['chalk-40'],
  });
});

// Guard the failure cases too: accidentally ignoring alpha would let chalk-35
// pass, and omitting gamma correction would distort the other measurements.
test.each([
  ['control border', colors.rule, colors.sheet, 3],
  ['map connection', colors['map-edge'], colors.sheet, 3],
  ['map attribution', colors['map-label'], colors['map-label-ground'], 4.5],
  ['sidebar control border', colors['chalk-35'], colors.board, 3],
] as const)('detects the canvas’s known failing %s', (_name, foreground, background, minimum) => {
  const ground = on(background, on(colors.sheet));
  expect(contrast(on(foreground, ground), ground)).toBeLessThan(minimum);
});
