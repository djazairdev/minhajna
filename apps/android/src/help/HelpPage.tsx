// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from 'react';
import { useLocale } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';

/** Inner Help pages scroll at 200%, with their own insets and interface direction. */
export function HelpPage({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-20'],
          paddingLeft: insets.left + spacing['space-20'],
          paddingRight: insets.right + spacing['space-20'],
        },
      ]}
    >
      {children}
    </ScrollView>
  );
}

/** A wrapping, labelled 48 dp entry, shared only by the small Help/licences slice. */
export function HelpRow({
  label,
  detail,
  onPress,
  link = false,
  testID,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  link?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={link ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      style={styles.row}
    >
      <Text style={helpStyles.heading}>{label}</Text>
      {detail !== undefined && (
        <Text selectable={link} style={helpStyles.body}>
          {detail}
        </Text>
      )}
    </Pressable>
  );
}

/** Interface text and verbatim licence paragraphs, without scaling limits. */
export const helpStyles = StyleSheet.create({
  heading: { ...typography.h3, color: colors.ink, textAlign: 'auto' },
  body: { ...typography.body, color: colors.ink2, textAlign: 'auto' },
  notice: { ...typography['body-latin'], color: colors.ink, textAlign: 'auto', writingDirection: 'auto' },
});

const styles = StyleSheet.create({
  page: { flexGrow: 1, gap: spacing['space-16'], paddingTop: spacing['space-20'] },
  row: {
    minHeight: sizes.target,
    padding: spacing['space-14'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
    gap: spacing['space-4'],
  },
});
