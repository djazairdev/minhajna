// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rows of «كشف النقاط» (#240, Marks-book, P-Marks, answers 458 and 459): a
// head with «الاسم واللقب», each part and «المعدل», then a row for each pupil
// with their number on the list, name, primary's months under it, each part
// and the average, read by TalkBack as one line. A row opens the pupil's
// value sheet. With large text the parts go under the name, so nothing is
// cut.

import type { BookRow, GradeBook } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { cellText, partLabel, partValue, rowLabel } from './book-rules';

export type BookTableProps = {
  readonly book: GradeBook;
  readonly rows: readonly BookRow[];
  readonly nameOf: (pupilId: string) => string;
  readonly monthsOf: (row: BookRow) => string;
  readonly onOpen: (row: BookRow, ref: ViewInstance | null) => void;
};

export function BookTable({ book, rows, nameOf, monthsOf, onOpen }: BookTableProps) {
  const t = useText();
  const { direction } = useLocale();
  const stacked = useWindowDimensions().fontScale >= 1.5;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const averaged = book.formula !== null;
  const cells = (row: BookRow) => [
    ...book.parts.map((part) => ({ key: part, label: partLabel(t, part), text: cellText(t, partValue(row, part)) })),
    ...(averaged ? [{ key: 'average', label: t('marks.book.average'), text: cellText(t, row.average) }] : []),
  ];
  return (
    <View testID="book-table" style={styles.table}>
      {!stacked && (
        <View testID="book-head" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.row}>
          <Text style={[styles.head, styles.grow, align]}>{t('marks.book.name')}</Text>
          {book.parts.map((part) => (
            <Text key={part} style={[styles.head, styles.cell]}>
              {partLabel(t, part)}
            </Text>
          ))}
          {averaged && <Text style={[styles.head, styles.cell]}>{t('marks.book.average')}</Text>}
        </View>
      )}
      {rows.map((row) => {
        const name = nameOf(row.pupilId);
        const months = monthsOf(row);
        let target: ViewInstance | null = null;
        return (
          <Pressable
            key={row.pupilId}
            ref={(node) => {
              target = node;
            }}
            testID={`book-row-${row.pupilId}`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={rowLabel(t, book, row, name, months)}
            onPress={() => onOpen(row, target)}
            style={({ pressed }) => [styles.row, styles.line, pressed && styles.pressed]}
          >
            <View style={styles.grow}>
              <Text style={[styles.name, align]}>{`${row.number}. ${isolate(name)}`}</Text>
              {months !== '' && <Text style={[styles.note, align]}>{months}</Text>}
              {stacked && (
                <Text style={[styles.note, align]}>
                  {cells(row)
                    .map((cell) => `${cell.label} ${cell.text}`)
                    .join(' · ')}
                </Text>
              )}
            </View>
            {!stacked &&
              cells(row).map((cell) => (
                <Text key={cell.key} style={[cell.key === 'average' ? styles.average : styles.value, styles.cell]}>
                  {cell.text}
                </Text>
              ))}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    paddingHorizontal: spacing['space-8'],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-4'], paddingVertical: spacing['space-8'] },
  line: { minHeight: sizes.target, minWidth: sizes.target, borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.paper },
  grow: { flex: 1, gap: spacing['space-2'] },
  cell: { width: 48, textAlign: 'center', writingDirection: 'ltr' },
  head: { ...typography.caption, color: colors.ink2 },
  name: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  value: { ...typography.body, color: colors.ink },
  average: { ...typography.label, color: colors.ink },
});
