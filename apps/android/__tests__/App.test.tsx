// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import type { TextProps, ViewProps } from 'react-native';
import App from '../App';
import { colors, spacing } from '../src/design/tokens';
import text from '../src/text/ar.json';

// Jest has no native side: the library's own mock gives fixed insets.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

test('shows the name and the tagline in Arabic', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  const shown = tree!.root.findAllByType(Text).map((node): unknown => node.props.children);
  expect(shown).toEqual([text.name, text.tagline]);

  // The token refactor must not change the existing welcome screen's layout.
  const screen = tree!.root.findByType(View).props as ViewProps;
  expect(StyleSheet.flatten(screen.style)).toMatchObject({ backgroundColor: colors.board });
  const textStyles = tree!.root.findAllByType(Text).map((node) => StyleSheet.flatten((node.props as TextProps).style));
  expect(textStyles).toEqual([
    { color: colors.chalk, fontSize: 40, fontWeight: '700' },
    { color: colors.chalk, fontSize: 18, marginTop: spacing['space-12'] },
  ]);
});
