// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Three figures side by side (#131, Stats), such as present, absent and
// late, each with its label, and a line where a figure could surprise, such
// as «تأخر، لا يُحسب غياباً». Figures use Western digits. Each figure is read
// as one: the number, then its label.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

export type Stat = { readonly value: number; readonly label: string; readonly id: string };

export function Stats({ items, testID }: { items: readonly Stat[]; testID?: string }) {
  const { direction } = useLocale();
  return (
    <View testID={testID} style={[styles.row, { direction }]}>
      {items.map((item) => (
        <View
          key={item.id}
          testID={testID === undefined ? undefined : `${testID}-${item.id}`}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
          style={styles.cell}
        >
          <Text style={[styles.value, { writingDirection: direction }]}>{String(item.value)}</Text>
          <Text style={[styles.label, { writingDirection: direction }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing['space-8'] },
  cell: {
    flex: 1,
    minWidth: 0,
    gap: spacing['space-2'],
    paddingVertical: spacing['space-10'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  value: { ...typography.stat, color: colors.ink, textAlign: 'start' },
  label: { ...typography.caption, color: colors.ink2, textAlign: 'start' },
});
