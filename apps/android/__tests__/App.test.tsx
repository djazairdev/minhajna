// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { ScrollViewProps, TextProps } from 'react-native';
import { Welcome } from '../src/navigation/Welcome';
import { fontFamilyForWeight } from '../src/design/fonts';
import { colors, fontFamilies, typography } from '../src/design/tokens';
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
  const texts = tree!.root.findAllByType(Text);
  expect(texts.map((node): unknown => node.props.children)).toEqual([
    text.name,
    text.tagline,
    text.welcome.line,
    text.language.label,
    text.language.ar,
    text.language.fr,
    text.language.en,
    text.welcome.noAccount,
    text.welcome.offline,
    text.welcome.onPhone,
  ]);

  const scroll = tree!.root.findByType(ScrollView).props as ScrollViewProps;
  expect(StyleSheet.flatten(scroll.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
  const style = (at: number) => StyleSheet.flatten((texts[at].props as TextProps).style);
  expect(style(0)).toMatchObject({ ...typography.brand, lineHeight: undefined, color: colors.chalk });
  expect(style(1)).toMatchObject({ fontFamily: typography.tagline.fontFamily, color: colors.chalk });
  expect(style(5)).toMatchObject({
    fontFamily: fontFamilyForWeight(fontFamilies.latin, '500'),
    writingDirection: 'ltr',
  });
  for (const node of texts) {
    const props = node.props as TextProps;
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.numberOfLines).toBeUndefined();
    expect(props.maxFontSizeMultiplier).toBeUndefined();
  }
});
