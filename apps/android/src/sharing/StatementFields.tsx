// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The statement's fields as the Share screen frames them (#438): a label
// beside its value and notes, one field to a row, read by TalkBack as one
// line each; at enlarged text the label goes above its value, as two
// columns would leave each too narrow.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import type { StatementLine } from './statement-lines';

export function StatementFields({ lines }: { readonly lines: readonly StatementLine[] }) {
  const { direction } = useLocale();
  const { fontScale } = useWindowDimensions();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const stacked = fontScale >= 1.5;
  return (
    <View testID="statement-fields" style={[styles.frame, { direction }]}>
      {lines.map(({ id, label, lines: [value, ...notes] }, index) => (
        <View
          key={id}
          testID={`statement-${id}`}
          accessible
          accessibilityLabel={[label, value, ...notes].join('. ')}
          style={[styles.row, stacked && styles.stacked, index > 0 && styles.ruled]}
        >
          <Text style={[styles.label, !stacked && styles.labelColumn, align]}>{label}</Text>
          <View style={styles.value}>
            <Text style={[styles.text, align]}>{value}</Text>
            {notes.map((note) => (
              <Text key={note} style={[styles.note, align]}>
                {note}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1.5, borderColor: colors.pencil, borderRadius: radius['radius-control'] },
  row: { flexDirection: 'row', gap: spacing['space-12'], padding: spacing['space-12'], minHeight: 48 },
  stacked: { flexDirection: 'column', gap: spacing['space-4'] },
  ruled: { borderTopWidth: 1, borderTopColor: colors.line },
  label: { ...typography.label, color: colors.ink },
  labelColumn: { width: '35%' },
  value: { flex: 1, gap: spacing['space-2'] },
  text: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
