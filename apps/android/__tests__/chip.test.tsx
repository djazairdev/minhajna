// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { ChipGroup, type ChipGroupProps } from '../src/components/Chip';
import { SetupSteps } from '../src/components/SetupSteps';
import { fontFamilyForWeight } from '../src/design/fonts';
import { colors, fontFamilies, sizes } from '../src/design/tokens';
import { chipTexts } from '../src/gallery/chip-texts';

const text = chipTexts.ar;
type Level = 'primary' | 'middle' | 'secondary';
const levels = (['primary', 'middle', 'secondary'] as const).map((value, at) => ({ value, label: text.levels[at] }));

let tree: ReactTestRenderer.ReactTestRenderer;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree.unmount());
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

function chips() {
  return tree.root
    .findAll(
      (node) =>
        typeof (node.props as PressableProps).onPress === 'function' &&
        (node.props as PressableProps).accessibilityRole !== undefined,
      { deep: false },
    )
    .map((node) => node.props as PressableProps);
}

async function press(at: number) {
  await ReactTestRenderer.act(() => {
    chips()[at].onPress?.({} as never);
  });
}

function group(props: Partial<ChipGroupProps<Level>> = {}) {
  return (
    <ChipGroup
      testID="level"
      label={text.level}
      choices={levels}
      selected={'middle'}
      onSelect={jest.fn()}
      {...(props as object)}
    />
  );
}

describe.each(['rtl', 'ltr'] as const)('ChipGroup (%s)', (direction) => {
  test('offers one choice as labelled radios, 48dp each, and reports the pressed value', async () => {
    const onSelect = jest.fn();
    await render(group({ onSelect }), direction);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(chips().map((chip) => [chip.testID, chip.accessibilityRole, chip.accessibilityState?.checked])).toEqual([
      ['level-primary', 'radio', false],
      ['level-middle', 'radio', true],
      ['level-secondary', 'radio', false],
    ]);
    const row = tree.root.findAll((node) => (node.props as ViewProps).accessibilityRole === 'radiogroup')[0];
    expect((row.props as ViewProps).accessibilityLabel).toBe(text.level);
    for (const chip of chips()) {
      const style = StyleSheet.flatten(typeof chip.style === 'function' ? chip.style({ pressed: false }) : chip.style);
      expect(style).toMatchObject({ minHeight: sizes.target, minWidth: sizes.target });
    }
    await press(2);
    expect(onSelect).toHaveBeenCalledWith('secondary');
  });

  test('offers several as checkboxes, adding and removing in the choices’ order, with its hint', async () => {
    const onSelect = jest.fn();
    await render(
      <ChipGroup
        testID="level"
        multiple
        label={text.level}
        hint={text.levelHint}
        choices={levels}
        selected={['secondary']}
        onSelect={onSelect}
      />,
      direction,
    );
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(chips().map((chip) => [chip.accessibilityRole, chip.accessibilityState?.checked])).toEqual([
      ['checkbox', false],
      ['checkbox', false],
      ['checkbox', true],
    ]);
    expect(tree.root.findAll((node) => (node.props as ViewProps).accessibilityRole === 'radiogroup')).toEqual([]);
    expect(tree.root.findAllByType(Text).map((node) => (node.props as TextProps).children)).toContain(text.levelHint);
    await press(0);
    expect(onSelect).toHaveBeenLastCalledWith(['primary', 'secondary']);
    await press(2);
    expect(onSelect).toHaveBeenLastCalledWith([]);
  });

  test('ends with a «more» button that is not a choice and selects nothing', async () => {
    const onSelect = jest.fn();
    const onMore = jest.fn();
    await render(
      <ChipGroup
        testID="level"
        multiple
        label={text.level}
        choices={levels}
        selected={[]}
        onSelect={onSelect}
        more={{ label: text.more, onPress: onMore }}
      />,
      direction,
    );
    expect(accessibilityProblems(tree.root)).toEqual([]);
    expect(chips().map((chip) => [chip.testID, chip.accessibilityRole, chip.accessibilityState])).toEqual([
      ['level-primary', 'checkbox', { checked: false }],
      ['level-middle', 'checkbox', { checked: false }],
      ['level-secondary', 'checkbox', { checked: false }],
      ['level-more', 'button', undefined],
    ]);
    await press(3);
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

test('draws the chosen chip on the board, with chalk text, and the others on the sheet', async () => {
  await render(group());
  const styles = chips().map((chip) =>
    StyleSheet.flatten(typeof chip.style === 'function' ? chip.style({ pressed: false }) : chip.style),
  );
  expect(styles.map((style) => style?.backgroundColor)).toEqual([colors.sheet, colors.board, colors.sheet]);
  const names = tree.root.findAllByType(Text).slice(1, 4);
  expect(names.map((name) => StyleSheet.flatten((name.props as TextProps).style)?.color)).toEqual([
    colors.ink,
    colors.chalk,
    colors.ink,
  ]);
});

test('keeps a name in another script in its own font and direction, and never limits enlarged text', async () => {
  await render(
    <ChipGroup
      label={text.level}
      choices={[
        { value: 'ar', label: 'العربية', script: 'arabic' },
        { value: 'fr', label: 'Français', script: 'latin' },
        { value: 'long', label: text.long },
      ]}
      selected="ar"
      onSelect={jest.fn()}
    />,
  );
  const names = tree.root.findAllByType(Text).map((node) => node.props as TextProps);
  expect(StyleSheet.flatten(names[1].style)).toMatchObject({ writingDirection: 'rtl' });
  expect(StyleSheet.flatten(names[2].style)).toMatchObject({
    fontFamily: fontFamilyForWeight(fontFamilies.latin, '500'),
    writingDirection: 'ltr',
  });
  expect(StyleSheet.flatten(names[3].style)).not.toHaveProperty('writingDirection');
  for (const name of names) {
    expect(name.numberOfLines).toBeUndefined();
    expect(name.allowFontScaling).not.toBe(false);
  }
});

test.each([
  [1, 5],
  [3, 5],
  [5, 5],
])('draws step %s of %s for sighted users only', async (reached, count) => {
  await render(<SetupSteps testID="steps" count={count} reached={reached} />);
  const hosts = tree.root.findAll((node) => typeof node.type === 'string');
  const bar = hosts[0].props as ViewProps;
  expect(bar.testID).toBe('steps');
  expect(bar.importantForAccessibility).toBe('no-hide-descendants');
  expect(bar.accessibilityElementsHidden).toBe(true);
  const segments = hosts.slice(1).map((node) => StyleSheet.flatten((node.props as ViewProps).style)?.backgroundColor);
  expect(segments).toEqual(Array.from({ length: count }, (_, step) => (step < reached ? colors.board : colors.line)));
});
