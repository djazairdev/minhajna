// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A stack screen's bar, which the teacher app's TopBar and the dashboard's
// reader mode draw (answer 856), and the navigator's colours from the design's
// tokens. The Back arrow is a shape, not a bidi-sensitive glyph: Android
// mirrors neutral text. Its end border resolves to physical left in RTL before
// rotation. The caller gives the line under the title, if any.

import { DefaultTheme, useLocale } from '@react-navigation/native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

/** The navigator's colours, from the design's tokens. */
export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.sheet,
    text: colors.ink,
    border: colors.line,
    primary: colors.ink,
  },
};

export type StackBarProps = NativeStackHeaderProps & {
  /** The lines under the title. */
  readonly subtitle?: ReactNode;
  /** What Back does instead of going back, as on a first screen with nothing behind it. */
  readonly onBack?: () => void;
};

/** Provides a labelled, RTL-aware Back control and a scalable two-line heading. */
export function StackBar({ navigation, options, subtitle, onBack }: StackBarProps) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, direction },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('navigation.back')}
          onPress={() => (onBack === undefined ? navigation.goBack() : onBack())}
          style={styles.back}
        >
          <View
            testID="back-icon"
            importantForAccessibility="no"
            style={[styles.arrow, { transform: [{ rotate: direction === 'rtl' ? '135deg' : '225deg' }] }]}
          />
        </Pressable>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {options.title}
          </Text>
          {subtitle}
        </View>
        <View style={styles.back}>{options.headerRight?.({ canGoBack: true })}</View>
      </View>
    </View>
  );
}

/** A line under a bar's title. */
export const barSubtitle = StyleSheet.create({
  line: { ...typography['bar-subtitle'], color: colors.ink2, textAlign: 'center' },
}).line;

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.sheet,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.bar,
    paddingHorizontal: spacing['space-8'],
  },
  back: { width: sizes.target, minHeight: sizes.target, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 12, height: 12, borderTopWidth: 2, borderEndWidth: 2, borderColor: colors.ink },
  heading: { flex: 1, paddingVertical: spacing['space-8'] },
  title: { ...typography['bar-title'], color: colors.ink, textAlign: 'center' },
});
