// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import design from '../../../docs/design/system/tokens.json';
import { colors, fontFamilies, typography, spacing, radius, shadows, sizes } from '../src/design/tokens';

// Read the export only in tests: the app ships native values, not the canvas's
// documentation or a runtime dependency on files outside the Android project.
test('exports every colour, resolving the design aliases', () => {
  const source = new Map(design.color.tokens.map(({ name, value }) => [name, value]));
  function resolve(name: string, seen: string[] = []): string {
    if (seen.includes(name)) throw new Error(`Circular colour alias: ${name}`);
    const value = source.get(name);
    if (value === undefined) throw new Error(`Unknown colour alias: ${name}`);
    const alias = /^\{([^}]+)\}$/.exec(value);
    return alias ? resolve(alias[1], [...seen, name]) : value;
  }
  expect(colors).toEqual(Object.fromEntries(design.color.tokens.map(({ name }) => [name, resolve(name)])));
});

test('uses the first font in each web stack as the native family', () => {
  expect(fontFamilies).toEqual(
    Object.fromEntries(
      Object.entries(design.type.families).map(([name, stack]) => [
        name,
        stack.split(',')[0].replaceAll('"', '').trim(),
      ]),
    ),
  );
});

test('exports every type style with native sizes, absolute line heights and string weights', () => {
  const families: Record<string, string> = fontFamilies;
  const expected = Object.fromEntries(
    design.type.groups.flatMap((group) =>
      group.styles.map((style) => {
        const fontSize = Number(style.fontSize.replace(/px$/, ''));
        return [
          style.name,
          {
            fontFamily: families[('family' in style ? style.family : undefined) ?? group.family],
            fontSize,
            lineHeight:
              typeof style.lineHeight === 'number'
                ? fontSize * style.lineHeight
                : Number(style.lineHeight.replace(/px$/, '')),
            fontWeight: String(style.fontWeight),
          },
        ];
      }),
    ),
  );
  expect(typography).toEqual(expected);
});

test.each([
  ['spacing', spacing, design.spacing.tokens],
  ['radius', radius, design.radius.tokens],
  ['size', sizes, design.size.tokens],
] as const)('exports every %s as a native number', (_name, actual, source) => {
  for (const { value } of source) expect(value).toMatch(/^\d+(?:\.\d+)?px$/);
  expect(actual).toEqual(Object.fromEntries(source.map(({ name, value }) => [name, Number(value.replace(/px$/, ''))])));
});

test('exports every shadow for the native boxShadow property', () => {
  expect(shadows).toEqual(Object.fromEntries(design.shadow.tokens.map(({ name, value }) => [name, value])));
});
