// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Insights-compare's page (#623, answer 700): the comparison being ready is
// said on a phone as the page's opening is, once; a place not begun says so,
// and a middle half whose low end has not begun says how far it goes. Every
// figure is made up.

import type { InsightsSending } from '@minhajna/core';
import { AccessibilityInfo, Platform, Text, useWindowDimensions, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { reference } from '../jest/world-calendar';
import { InsightsCompare } from '../src/insights/InsightsCompare';
import type { ClassCompare } from '../src/insights/use-class-compare';
import type { Figure } from '../src/observatory/figures-read';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const words = catalogues.en.demo.insights.compare;
const figure: Figure = {
  classes: 30,
  teachers: 12,
  schools: 4,
  reached: { low: 0, median: 200, high: 400 },
  items: [],
};
const ready = (place: {
  mine: string | null;
  median: string | null;
  low: string | null;
  high: string | null;
}): ClassCompare => ({
  kind: 'ready',
  sending: { grade: '4am', subject: 'arabic' } as InsightsSending,
  scope: 'wilaya',
  figure,
  comparison: { rows: [], changes: [], place },
  scaled: false,
});
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const page = (compare: ClassCompare) => (
  <InsightsCompare
    className="4AM1"
    compare={compare}
    reference={reference}
    date=""
    term={1}
    onAgain={() => undefined}
    onClose={() => undefined}
  />
);
const draw = async (compare: ClassCompare) => {
  await ReactTestRenderer.act(async () => {
    if (tree === undefined) tree = ReactTestRenderer.create(page(compare));
    else tree.update(page(compare));
    await settle();
  });
  await ReactTestRenderer.act(async () => {
    await settle();
  });
};
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

test('on a phone, the comparison being ready is said once, as the opening is', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const said = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await draw({ kind: 'reading' });
  expect(said).toHaveBeenCalledTimes(1);
  const full = ready({ mine: 'Made-up item', median: 'Made-up item', low: 'Made-up item', high: 'Made-up item' });
  await draw(full);
  await draw(full);
  expect(said.mock.calls.map(([words_]) => words_).slice(1)).toEqual([words.ready]);
});

test('a place not begun says so, and a middle half with no low end says how far it goes', async () => {
  await draw(ready({ mine: null, median: 'Made-up item', low: null, high: 'Later made-up item' }));
  expect(texts()).toContain(words.place.notBegun);
  expect(texts()).toContain('Up to Later made-up item');
  await draw(ready({ mine: null, median: null, low: null, high: null }));
  expect(texts().filter((text) => text === words.place.notBegun)).toHaveLength(3);
});
