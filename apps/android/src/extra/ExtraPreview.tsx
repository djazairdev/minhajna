// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The row a session outside the timetable will take on the texts book's
// page for supervised or additional lessons (#219, R-3.8-26): its number,
// the subject, the kind, the date and the time, and nothing else. TalkBack
// reads the row as one sentence, each value after its column's name.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type ExtraPreviewProps = {
  readonly className: string;
  readonly number: number;
  readonly subject: string;
  readonly kind: string;
  readonly day: string;
  readonly time: string;
};

const COLUMNS = ['number', 'subject', 'type', 'day', 'hours'] as const;

const WIDTHS = { number: 0.6, subject: 1.4, type: 1.1, day: 1.5, hours: 1.6 } as const;

export function ExtraPreview({ className, number, subject, kind, day, time }: ExtraPreviewProps) {
  const t = useText();
  const { direction } = useLocale();
  const values = [String(number), subject, kind, day, time];
  const spoken = COLUMNS.map((column, index) => `${t(`extra.${column}`)} ${values[index]}`).join('، ');
  return (
    <View style={[styles.box, { direction }]}>
      <Text style={[styles.caption, { writingDirection: direction, textAlign: 'start' }]}>
        {t('extra.preview', { class: className })}
      </Text>
      <View testID="extra-preview" accessible accessibilityLabel={spoken} style={styles.table}>
        <View style={[styles.row, styles.head]}>
          {COLUMNS.map((column) => (
            <Text key={column} style={[styles.cell, styles.headText, { flex: WIDTHS[column] }]}>
              {t(`extra.${column}`)}
            </Text>
          ))}
        </View>
        <View style={styles.row}>
          {values.map((value, index) => (
            <Text key={COLUMNS[index]} style={[styles.cell, { flex: WIDTHS[COLUMNS[index] ?? 'number'] }]}>
              {value}
            </Text>
          ))}
        </View>
      </View>
      <Text style={[styles.caption, { writingDirection: direction, textAlign: 'start' }]}>
        {t('extra.previewNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing['space-8'] },
  table: { borderWidth: 1, borderColor: colors.ink2, borderRadius: radius['radius-tag'], overflow: 'hidden' },
  row: { flexDirection: 'row' },
  head: { backgroundColor: colors.line },
  cell: {
    ...typography.small,
    color: colors.ink,
    flex: 1,
    paddingVertical: spacing['space-6'],
    paddingHorizontal: spacing['space-4'],
    textAlign: 'center',
  },
  headText: { fontWeight: '700' },
  caption: { ...typography.caption, color: colors.ink2 },
});
