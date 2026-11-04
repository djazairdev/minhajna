// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Insights-compare's table (#623, answer 700): on a phone, each row said whole
// as one, the heading left out, a median over the plan bold and said so, a dash
// said in words; on a PC, a table of rows and cells, each cell said alone.
// French decimals take a comma, and at large text or on a narrow screen each
// title stands above its numbers. Every row is made up.

import type { CompareRow } from '@minhajna/core';
import { Platform, StyleSheet, useWindowDimensions, type TextStyle } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { CompareTable } from '../src/insights/CompareTable';
import { i18n } from '../src/text/i18n';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const rows: CompareRow[] = [
  { item: 'a', title: 'First made-up item', planned: 2, median: 2.5, mine: 3, over: true },
  { item: 'b', title: 'Second made-up item', planned: 2, median: null, mine: null, over: false },
];
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(async () => {
  await i18n.changeLanguage('en');
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 2 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

const draw = async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<CompareTable className="4AM1" rows={rows} />);
  });
};
const host = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0];

test('on a phone, each row is said whole, its heading left out', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await draw();
  expect(host('insights-compare-row-a').props.accessibilityLabel).toBe(
    'First made-up item: plan 2, median 2.5, more than the plan, 4AM1 3',
  );
  expect(host('insights-compare-row-b').props.accessibilityLabel).toBe(
    'Second made-up item: plan 2, median not shown, 4AM1 not taught',
  );
  const heading = tree!.root.findAll((node) => node.props.importantForAccessibility === 'no-hide-descendants');
  expect(heading.length).toBeGreaterThan(0);
  const style = (id: string) => StyleSheet.flatten(host(id).props.style as TextStyle);
  expect(style('insights-compare-median-a')?.fontWeight).toBe('700');
  expect(style('insights-compare-median-b')?.fontWeight).not.toBe('700');
  expect(host('insights-compare-median-b').props.children).toBe('–');
});

test('on a PC, a table says each cell alone', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await draw();
  expect(tree!.root.findAll((node) => node.props.role === 'row' && typeof node.type === 'string')).toHaveLength(3);
  expect(host('insights-compare-row-a').props.accessible).toBe(false);
  expect(host('insights-compare-median-a').props.accessibilityLabel).toBe('2.5, more than the plan');
  expect(host('insights-compare-median-b').props.accessibilityLabel).toBe('not shown');
});

test('French decimals take a comma', async () => {
  await i18n.changeLanguage('fr');
  await draw();
  expect(host('insights-compare-median-a').props.children).toBe('2,5');
});

test('at large text or on a narrow screen each title stands above its numbers; else beside them', async () => {
  await draw();
  const title = () =>
    StyleSheet.flatten(
      tree!.root.findAll((node) => node.props.role === 'rowheader' && typeof node.type === 'string')[0].props
        .style as TextStyle,
    );
  expect(title()?.width).toBe('100%');
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
  await draw();
  expect(title()?.width).toBeUndefined();
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 320, height: 800, scale: 2, fontScale: 1 });
  await draw();
  expect(title()?.width).toBe('100%');
});
