// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A chart with the table of its figures (#597): where the app draws charts, the
// chart is drawn with its axes mirrored for right to left only, and the screen
// reader skips it for the table under it; on a PC the table is one keyboard
// stop, named for the chart; on Android each row is one element that says its
// category and each series' name and figure, held-back ones in words, and the
// header row is skipped; the table has a header row of the series and a row for
// each category; where there is no drawing kit, as on the phone, the table
// stands alone; a figure is written to one decimal, with Latin digits and the
// language's decimal mark, and a series with one decimal writes it on every
// figure; a series that misses a category is refused; and the gallery shows it
// under ChartKey, in every language. The figures are made up.

import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { Drawing, type ChartSpec, type DrawingKit } from '../src/drawing/drawing-kit';
import { ChartFigure } from '../src/drawing/ChartFigure';
import { chartFigureTexts } from '../src/gallery/chart-figure-texts';
import { entries } from '../src/gallery/entries';
import { samples } from '../src/gallery/samples';
import { formatFigure } from '../src/text/figures';
import { catalogues, i18n, type Language } from '../src/text/i18n';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const drawn: ChartSpec[] = [];
const kit: DrawingKit = {
  Chart: ({ spec }) => {
    drawn.push(spec);
    return <View testID="drawn-chart" />;
  },
  Map: () => null,
};
const spec: Omit<ChartSpec, 'rightToLeft'> = {
  kind: 'bar',
  label: 'Made-up progress',
  categories: ['Class A', 'Class B'],
  series: [
    { name: 'Latest', values: [62, null] },
    { name: 'Earlier', values: [48, 52] },
  ],
};

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  drawn.length = 0;
  jest.restoreAllMocks();
  await i18n.changeLanguage('ar');
});

async function render(node: React.ReactNode, direction: 'rtl' | 'ltr', drawing: DrawingKit | null) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <Drawing.Provider value={drawing}>
        <LocaleDirContext.Provider value={direction}>{node}</LocaleDirContext.Provider>
      </Drawing.Provider>,
    );
  });
}

const host = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0];
const byRole = (role: string) =>
  tree!.root.findAll((node) => node.props.role === role && typeof node.type === 'string');
const words = (node: ReactTestRenderer.ReactTestInstance) =>
  node.findAllByType(Text).map((one) => one.props.children as string);

test.each(['rtl', 'ltr'] as const)(
  'draws the chart, mirrored only right to left, and the table under it (%s)',
  async (direction) => {
    await render(<ChartFigure testID="figure" categoryLabel="Class" spec={spec} />, direction, kit);
    expect(drawn.at(-1)).toEqual({ ...spec, rightToLeft: direction === 'rtl' });
    const hidden = tree!.root.findAll((node) => node.props.importantForAccessibility === 'no-hide-descendants');
    expect(hidden[0]?.findAllByProps({ testID: 'drawn-chart' }).length).toBeGreaterThan(0);
    expect(host('figure-table').props).toMatchObject({ role: 'table', focusable: false });
  },
);

test('makes the table one keyboard stop on a PC, named for the chart', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<ChartFigure testID="figure" categoryLabel="Class" spec={spec} />, 'ltr', kit);
  expect(host('figure-table').props).toMatchObject({ focusable: true, accessibilityLabel: 'Made-up progress' });
  expect(byRole('row').some((row) => row.props.accessible === true)).toBe(false);
  expect(byRole('row')[0]?.props).toMatchObject({ importantForAccessibility: 'auto' });
});

test('says each row as one element on Android, the header row skipped', async () => {
  await render(<ChartFigure testID="figure" categoryLabel="Class" spec={spec} />, 'rtl', kit);
  const [head, ...rows] = byRole('row');
  expect(head?.props).toMatchObject({ importantForAccessibility: 'no-hide-descendants' });
  const { separator, colon, heldBack } = catalogues.ar.chart;
  const said = (category: string, figures: [string, string][]) =>
    [category, ...figures.map(([name, value]) => `${name}${colon}${value}`)].join(separator);
  expect(rows.map((one): unknown[] => [one.props.accessible, one.props.accessibilityLabel])).toEqual([
    [
      true,
      said('Class A', [
        ['Latest', '62'],
        ['Earlier', '48'],
      ]),
    ],
    [
      true,
      said('Class B', [
        ['Latest', heldBack],
        ['Earlier', '52'],
      ]),
    ],
  ]);
});

test('writes a figure to one decimal, with Latin digits and the language decimal mark', () => {
  expect([formatFigure(62.5, 'ar'), formatFigure(62.5, 'fr'), formatFigure(62.5, 'en')]).toEqual([
    '62,5',
    '62,5',
    '62.5',
  ]);
  expect([formatFigure(71, 'ar'), formatFigure(71, 'ar', true)]).toEqual(['71', '71,0']);
  expect([formatFigure((2 / 3) * 100, 'fr'), formatFigure(0.1 + 0.2, 'en')]).toEqual(['66,7', '0.3']);
});

test('writes the table: series as columns, a row per category, a held-back figure in words', async () => {
  await render(<ChartFigure testID="figure" categoryLabel="Class" spec={spec} />, 'rtl', null);
  expect(tree!.root.findAllByProps({ testID: 'drawn-chart' })).toHaveLength(0);
  const rows = byRole('row').map(words);
  expect(rows).toEqual([
    ['Class', 'Latest', 'Earlier'],
    ['Class A', '62', '48'],
    ['Class B', catalogues.ar.chart.heldBack, '52'],
  ]);
  expect(byRole('columnheader')).toHaveLength(3);
  expect(byRole('rowheader').map(words)).toEqual([['Class A'], ['Class B']]);
  expect(byRole('cell')).toHaveLength(4);
});

test('refuses a series that misses a category', async () => {
  const broken = { ...spec, series: [{ name: 'Latest', values: [62] }] };
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(render(<ChartFigure categoryLabel="Class" spec={broken} />, 'rtl', null)).rejects.toThrow(RangeError);
});

test.each(['ar', 'fr', 'en'] as const)(
  'shows its samples under ChartKey in the gallery (%s)',
  async (language: Language) => {
    await ReactTestRenderer.act(async () => {
      await i18n.changeLanguage(language);
    });
    const entry = entries.find((one) => one.name === 'ChartKey')!;
    expect(entry.design).toBe('docs/design/system/components/ChartKey/README.md');
    await render(entry.render(samples[language], language), language === 'ar' ? 'rtl' : 'ltr', null);
    const texts = chartFigureTexts[language];
    expect(words(host('chart-figure-bars-table'))).toContain(catalogues[language].chart.heldBack);
    expect(words(host('chart-figure-lines-table'))).toEqual(
      expect.arrayContaining([texts.earlier, ...texts.categories]),
    );
  },
);

test('writes every figure of a series with one decimal once one has it', async () => {
  const shares = { ...spec, series: [{ name: 'Latest', values: [62.5, 70] }, ...spec.series.slice(1)] };
  await render(<ChartFigure testID="figure" categoryLabel="Class" spec={shares} />, 'rtl', null);
  expect(byRole('cell').map(words)).toEqual([['62,5'], ['48'], ['70,0'], ['52']]);
  const { separator, colon } = catalogues.ar.chart;
  expect(byRole('row')[2]?.props.accessibilityLabel).toBe(
    ['Class B', `Latest${colon}70,0`, `Earlier${colon}52`].join(separator),
  );
});
