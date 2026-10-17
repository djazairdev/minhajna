// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// WeekGrid (#133): days across in the reading direction, slots down, each
// cell named by its day, slot and class, 48dp when it can be pressed,
// columns that grow at 200% text instead of shrinking it, and a dashed
// outline on a clash. Made-up weeks.

import { LocaleDirContext } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import type { PressableProps, TextProps, TextStyle, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { WeekGrid, type WeekGridCell, type WeekGridDay, type WeekGridSlot } from '../src/components/WeekGrid';
import { colors } from '../src/design/tokens';
import { weekGridTexts } from '../src/gallery/week-grid-texts';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const window = { width: 360, height: 800, scale: 2, fontScale: 1 };
beforeEach(() => jest.mocked(useWindowDimensions).mockReturnValue(window));

const text = weekGridTexts.ar;
const days: WeekGridDay[] = text.days.map((label, at) => ({ key: String(at), label }));
const slots: WeekGridSlot[] = [
  { key: 'm1', label: 'ص1', spoken: 'الحصة 1 صباحاً', first: true },
  { key: 'm2', label: 'ص2', spoken: 'الحصة 2 صباحاً' },
  { key: 'a1', label: 'م1', spoken: 'الحصة 1 مساءً', first: true },
];
const week: Record<string, WeekGridCell> = {
  '0:m1': { label: '4م1', kind: 'class' },
  '1:m2': { label: '4م2', kind: 'class' },
  '2:a1': { label: text.own, kind: 'own' },
};
const cellName = (day: WeekGridDay, slot: WeekGridSlot, cell: WeekGridCell) =>
  `${day.label}، ${slot.spoken}: ${cell?.label ?? text.empty}`;

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
});

async function render(onPressCell?: (day: WeekGridDay, slot: WeekGridSlot) => void, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <WeekGrid
          testID="week"
          days={days}
          slots={slots}
          cell={(day, slot) => week[`${day.key}:${slot.key}`] ?? null}
          cellName={cellName}
          cellHint={text.hint}
          onPressCell={onPressCell}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

const buttons = () =>
  tree.root
    .findAll((node) => typeof (node.props as PressableProps).onPress === 'function', { deep: false })
    .map((node) => node.props as PressableProps & { testID: string });
const named = () =>
  tree.root
    .findAll((node) => (node.props as ViewProps).accessible === true, { deep: false })
    .map((node) => String((node.props as ViewProps).accessibilityLabel));
const flat = (style: unknown): TextStyle => StyleSheet.flatten(style as TextStyle) ?? {};

test('shows each class on its subject colour, and names every cell by day, slot and class', async () => {
  await render();
  expect(named()).toHaveLength(15);
  expect(named()).toContain('الأحد، الحصة 1 صباحاً: 4م1');
  expect(named()).toContain(`الإثنين، الحصة 1 صباحاً: ${text.empty}`);
  expect(buttons()).toHaveLength(0);
  const chip = tree.root.findAllByType(Text).find((node) => node.props.children === '4م1');
  expect(flat((chip?.props as TextProps).style).color).toBe(colors['on-subject']);
  const own = tree.root.findAll(
    (node) => (node.props as ViewProps).accessibilityLabel === `الثلاثاء، الحصة 1 مساءً: ${text.own}`,
    {
      deep: false,
    },
  )[0];
  expect(flat((own.props as ViewProps).style).backgroundColor).toBe(colors.soft);
  expect(accessibilityProblems(tree.root)).toEqual([]);
});

test.each(['rtl', 'ltr'] as const)('presses a cell, each a 48dp button with its name (%s)', async (direction) => {
  const onPress = jest.fn();
  await render(onPress, direction);
  expect(buttons()).toHaveLength(15);
  const cell = buttons().find((button) => button.testID === 'week-3-a1');
  expect(cell?.accessibilityLabel).toBe(`الأربعاء، الحصة 1 مساءً: ${text.empty}`);
  expect(cell?.accessibilityHint).toBe(text.hint);
  await ReactTestRenderer.act(() => {
    cell?.onPress?.({} as never);
  });
  expect(onPress).toHaveBeenCalledWith(days[3], slots[2]);
  expect(flat(tree.root.findByType(ScrollView).props.style)).toMatchObject({ direction });
  expect(accessibilityProblems(tree.root)).toEqual([]);
});

test('grows its columns and rows at 200% text and scrolls sideways, keeping its text size and no line limit', async () => {
  jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale: 2 });
  await render(jest.fn());
  expect(tree.root.findByType(ScrollView).props.horizontal).toBe(true);
  const head = tree.root.findAllByType(Text).find((node) => node.props.children === 'الأحد');
  expect(flat((head?.parent?.props as ViewProps).style).minWidth).toBe(104);
  const heights = buttons().map(
    (button) => flat(button.style instanceof Function ? button.style({ pressed: false }) : button.style).minHeight,
  );
  expect(new Set(heights).size).toBe(1);
  expect(heights[0]).toBeGreaterThan(48);
  for (const node of tree.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.adjustsFontSizeToFit).toBeUndefined();
    expect(flat(props.style)).not.toHaveProperty('height');
  }
});

test('gives every cell of a row one height, so a long class name widens its day instead of breaking', async () => {
  week['3:m1'] = { label: 'القسم التجريبي', kind: 'class' };
  try {
    await render();
    const cells = tree.root.findAll((node) => (node.props as ViewProps).accessible === true, { deep: false });
    const heights = cells.map((node) => flat((node.props as ViewProps).style).minHeight);
    expect(new Set(heights).size).toBe(1);
    const day = cells.find((node) => String((node.props as ViewProps).accessibilityLabel).includes('القسم التجريبي'));
    expect(flat((day?.parent?.props as ViewProps).style)).toMatchObject({ flexGrow: 1, minWidth: 52 });
    expect(flat((day?.props as ViewProps).style)).not.toHaveProperty('width');
  } finally {
    delete week['3:m1'];
  }
});

test('outlines a clashing cell, dashed, so the clash is seen without colour', async () => {
  week['4:m2'] = { label: '4م1\n4م2', kind: 'class', clash: true };
  try {
    await render();
    const style = (label: string) =>
      flat(
        (
          tree.root.findAll((node) => String((node.props as ViewProps).accessibilityLabel).includes(label), {
            deep: false,
          })[0].props as ViewProps
        ).style,
      );
    expect(style('4م1\n4م2')).toMatchObject({
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors['notice-line'],
    });
    expect(style('الأحد، الحصة 1 صباحاً')).not.toHaveProperty('borderStyle');
  } finally {
    delete week['4:m2'];
  }
});
