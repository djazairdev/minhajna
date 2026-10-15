// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { ScrollViewProps, TextProps } from 'react-native';
import { Welcome } from '../src/navigation/Welcome';
import { colors, spacing, typography } from '../src/design/tokens';
import text from '../src/text/ar.json';

// Jest has no native side: the library's own mock gives fixed insets.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

test('shows all three bundled families without limiting enlarged text', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Welcome />);
  });
  const shown = tree!.root.findAllByType(Text).map((node): unknown => node.props.children);
  expect(shown).toEqual([text.name, text.tagline, text.latinName]);

  const scroll = tree!.root.findByType(ScrollView).props as ScrollViewProps;
  expect(StyleSheet.flatten(scroll.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
  const textStyles = tree!.root.findAllByType(Text).map((node) => StyleSheet.flatten((node.props as TextProps).style));
  expect(textStyles).toEqual([
    { ...typography.brand, lineHeight: undefined, color: colors.chalk, textAlign: 'center' },
    { ...typography.tagline, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-12'] },
    {
      ...typography['body-latin'],
      color: colors.chalk,
      textAlign: 'center',
      writingDirection: 'ltr',
      marginTop: spacing['space-12'],
    },
  ]);
  for (const node of tree!.root.findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.numberOfLines).toBeUndefined();
    expect(props.maxFontSizeMultiplier).toBeUndefined();
  }
});
