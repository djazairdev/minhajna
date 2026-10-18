// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import { Text, View } from 'react-native';
import type { PressableProps, TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { Badge } from '../src/components/Badge';
import { Facts } from '../src/components/Facts';
import { entries } from '../src/gallery/entries';
import { factsTexts } from '../src/gallery/facts-texts';
import { samples, fill } from '../src/gallery/samples';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

test.each(
  (['ar', 'fr', 'en'] as const).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('translated gallery states stay local (%s, %s)', async (language, direction) => {
  const selected = entries.filter((entry) => ['Badge', 'RowLink', 'Facts'].includes(entry.name));
  expect(selected.map((entry) => entry.name)).toEqual(['Badge', 'RowLink', 'Facts']);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        <View>
          {selected.map((entry) => (
            <View key={entry.name}>{entry.render(samples[language], language)}</View>
          ))}
        </View>
      </LocaleDirContext.Provider>,
    );
  });
  expect(tree!.root.findAllByType(Badge)).toHaveLength(4);
  const summary = tree!.root.findAllByType(Facts).find((node) => node.props.kept);
  expect(summary?.props.kept).toHaveLength(4);
  expect(summary?.props.notKeptLabel).toBe(factsTexts[language].notKept);
  const count = () =>
    (tree!.root.findAllByType(Text).find((node) => node.props.testID === 'row-link-activations')!.props as TextProps)
      .children;
  expect(count()).toBe(fill(samples[language].activations, { count: 0 }));
  for (const id of ['row-link-short', 'row-link-long']) {
    const props = tree!.root.findAll((node) => node.props.testID === id && node.props.accessibilityRole === 'button', {
      deep: false,
    })[0].props as PressableProps;
    await ReactTestRenderer.act(() => {
      props.onPress?.({} as never);
    });
  }
  expect(count()).toBe(fill(samples[language].activations, { count: 2 }));
  const disabled = tree!.root.findAll(
    (node) => node.props.testID === 'row-link-disabled' && node.props.accessibilityRole === 'button',
    { deep: false },
  )[0].props as PressableProps;
  expect(disabled.onPress).toBeUndefined();
  expect(disabled.accessibilityState).toEqual({ disabled: true });
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
