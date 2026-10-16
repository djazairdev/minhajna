// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The brand page, shared by the startup and refusal states and the navigation
// previews. On a tab page the tab bar owns the bottom inset; a standalone page
// owns it itself.

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

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
  const t = useText();
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
          {t('name')}
        </Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
        <Text style={styles.latinName}>{t('latinName')}</Text>
        {referenceRefused && (
          <Text style={styles.notice} accessibilityRole="alert">
            {t('referenceRefused')}
          </Text>
        )}
        {historyRefused && (
          <Text style={styles.notice} accessibilityRole="alert">
            {t('historyRefused')}
          </Text>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

// The logo's board and chalk colours (docs/design/system).
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.board },
  // A scrollable, padded page keeps the fonts readable at 200% text, without
  // shrinking the type or limiting the number of lines.
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['space-20'],
  },
  // The canvas's 1.15 line box clips Ruqaa's lower dots on Android, especially
  // at 200%. Let the bundled font's own ascent and descent set this line box.
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
