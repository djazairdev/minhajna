// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The tab bar owns the bottom inset on tab pages; startup/refusal pages own it
// when standalone. Ruqaa's native ascent/descent preserves lower dots at 200%.

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../design/tokens';
import text from '../text/ar.json';

/** Shares the offline brand page between navigation previews and safe startup/refusal states. */
export function Welcome({
  children,
  standalone = false,
  referenceRefused = false,
  historyRefused = false,
}: {
  children?: ReactNode;
  standalone?: boolean;
  referenceRefused?: boolean;
  historyRefused?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: standalone ? insets.bottom : 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.name} accessibilityRole="header">
          {text.name}
        </Text>
        <Text style={styles.tagline}>{text.tagline}</Text>
        <Text style={styles.latinName}>{text.latinName}</Text>
        {referenceRefused && (
          <Text style={styles.notice} accessibilityRole="alert">
            {text.referenceRefused}
          </Text>
        )}
        {historyRefused && (
          <Text style={styles.notice} accessibilityRole="alert">
            {text.historyRefused}
          </Text>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.board },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['space-20'],
  },
  name: { ...typography.brand, lineHeight: undefined, color: colors.chalk, textAlign: 'center' },
  tagline: { ...typography.tagline, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-12'] },
  latinName: {
    ...typography['body-latin'],
    color: colors.chalk,
    textAlign: 'center',
    writingDirection: 'ltr',
    marginTop: spacing['space-12'],
  },
  notice: { ...typography.body, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-20'] },
});
