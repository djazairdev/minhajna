// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

/** The count is a translated phrase with Western digits, including its unit; pluralisation belongs to the screen. */
export type SectionHeaderProps = {
  readonly label: string;
  readonly count?: string;
  readonly action?: ReactNode;
  readonly testID?: string;
};

/** A quiet header that reads its count once and leaves any trailing action independently reachable. */
export function SectionHeader({ label, count, action, testID }: SectionHeaderProps) {
  const { direction } = useLocale();
  const textDirection = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} style={[styles.row, { direction }]}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={count === undefined ? label : `${label}. ${count}`}
        style={[styles.label, textDirection]}
      >
        {label}
      </Text>
      {count !== undefined && (
        <Text
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.count, textDirection]}
        >
          {count}
        </Text>
      )}
      {action != null && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-16'],
    paddingTop: spacing['space-12'],
    paddingBottom: spacing['space-6'],
  },
  label: { ...typography.label, color: colors.ink2, flexGrow: 1, flexShrink: 1, flexBasis: '40%', minWidth: 0 },
  count: { ...typography.label, color: colors.ink2, maxWidth: '100%' },
  action: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', marginStart: 'auto' },
});
