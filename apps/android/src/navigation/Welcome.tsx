// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../design/tokens';
import text from '../text/ar.json';

export function Welcome({ children }: { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    // The tab bar, not the page, owns the bottom inset.
    <View style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.name} accessibilityRole="header">
          {text.name}
        </Text>
        <Text style={styles.tagline}>{text.tagline}</Text>
        <Text style={styles.latinName}>{text.latinName}</Text>
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
  // Ruqaa's own ascent/descent avoids clipping its lower dots at 200% text.
  name: { ...typography.brand, lineHeight: undefined, color: colors.chalk, textAlign: 'center' },
  tagline: { ...typography.tagline, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-12'] },
  latinName: {
    ...typography['body-latin'],
    color: colors.chalk,
    textAlign: 'center',
    writingDirection: 'ltr',
    marginTop: spacing['space-12'],
  },
});
