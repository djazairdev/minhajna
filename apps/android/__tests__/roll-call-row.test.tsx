// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// RollCallRow and Stats (#131): each toggle state with its spoken name and
// state, the late toggle's second sign, the marked row's shade, the 64×48
// toggles and 56dp row, the figures following the marks, a virtualised
// class of 45 made-up pupils, both directions, and text that grows to 200%.

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { RollCallRow } from '../src/components/RollCallRow';
import { Icon } from '../src/design/Icon';
import { colors } from '../src/design/tokens';
import { RollCallSamples } from '../src/gallery/roll-call-samples';
import { madeUpClass, rollCallTexts } from '../src/gallery/roll-call-texts';
import { samples } from '../src/gallery/samples';
import { catalogues, i18n, type Language } from '../src/text/i18n';

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  await i18n.changeLanguage('ar');
});

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

const toggle = (id: string) =>
  tree.root.findAll(
    (node) =>
      node.props.testID === id &&
      node.props.accessibilityRole === 'checkbox' &&
      typeof (node.props as PressableProps).onPress === 'function',
  )[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (toggle(id).props as PressableProps).onPress?.({} as never);
  });
};
const flat = (node: ReactTestRenderer.ReactTestInstance) => {
  const style = (node.props as PressableProps).style;
  return StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style) ?? {};
};

test('each toggle says its state and the pupil, and reports the change', async () => {
  const onAbsent = jest.fn();
  const onLate = jest.fn();
  const row = (absent: boolean, late: boolean) => (
    <RollCallRow
      testID="r"
      number={4}
      name="مختلق آية"
      absent={absent}
      late={late}
      onAbsent={onAbsent}
      onLate={onLate}
    />
  );
  await render(row(false, false), 'rtl');
  expect(toggle('r-absent').props.accessibilityLabel).toBe('غياب: مختلق آية');
  expect(toggle('r-late').props.accessibilityState).toEqual({ checked: false });
  expect(tree.root.findAllByType(Icon)).toHaveLength(0);
  await press('r-absent');
  expect(onAbsent).toHaveBeenCalledWith(true);
  await press('r-late');
  expect(onLate).toHaveBeenCalledWith(true);

  await ReactTestRenderer.act(() =>
    tree.update(<LocaleDirContext.Provider value="rtl">{row(true, false)}</LocaleDirContext.Provider>),
  );
  expect(toggle('r-absent').props.accessibilityState).toEqual({ checked: true });
  expect(flat(toggle('r-absent'))).toMatchObject({ backgroundColor: colors.board, width: 64, minHeight: 48 });
  await press('r-absent');
  expect(onAbsent).toHaveBeenLastCalledWith(false);

  await ReactTestRenderer.act(() =>
    tree.update(<LocaleDirContext.Provider value="rtl">{row(false, true)}</LocaleDirContext.Provider>),
  );
  expect(flat(toggle('r-late'))).toMatchObject({ backgroundColor: colors.hi, borderColor: colors['late-edge'] });
  expect(tree.root.findAllByType(Icon)).toHaveLength(1);
  const shaded = tree.root
    .findAllByType(View)
    .find((node) => StyleSheet.flatten((node.props as ViewProps).style)?.minHeight === 56);
  expect(StyleSheet.flatten((shaded?.props as ViewProps).style)).toMatchObject({ backgroundColor: colors['alt-day'] });
});

describe.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('%s, %s', (language, direction) => {
  test('the class of 45 is virtualised, named, and its figures follow the marks', async () => {
    await i18n.changeLanguage(language);
    const text = rollCallTexts[language];
    await render(<RollCallSamples sample={samples[language]} language={language} />, direction);
    expect(madeUpClass(text)).toHaveLength(45);
    expect((tree.root.findByType(FlatList).props as { data: readonly string[] }).data).toHaveLength(45);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    const figure = (id: string) =>
      tree.root.findAll(
        (node) => node.props.testID === `stats-${id}` && typeof node.props.accessibilityLabel === 'string',
      )[0]?.props.accessibilityLabel as string;
    expect(figure('absent')).toBe(`1 ${text.absent}`);
    await press('roll-1-absent');
    expect(figure('absent')).toBe(`2 ${text.absent}`);
    expect(figure('present')).toBe(`43 ${text.present}`);
    await press('roll-1-late');
    expect(figure('absent')).toBe(`1 ${text.absent}`);
    expect(figure('late')).toBe(`2 ${text.late}`);
  });

  test('text grows to 200%: no fixed text height and no line limit', async () => {
    await i18n.changeLanguage(language);
    await render(<RollCallSamples sample={samples[language]} language={language} />, direction);
    for (const node of tree.root.findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(StyleSheet.flatten(props.style)?.height).toBeUndefined();
    }
  });
});
