// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One pupil's value sheet in «كشف النقاط» (#240, Marks-book-value, answers
// 457 and 458): the average as the book shows it, in two decimals, and in
// full; each part both ways; the formula with the pupil's values in full;
// whether the average reaches the threshold, with the rank; and «تبرير نقطة
// التقويم», which opens the pupil's justification.

import { fullMark, type BookRow, type GradeBook } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { RefObject } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { cellText, formulaWith, partLabel, partValue, verdictLine } from './book-rules';

export type BookValueProps = {
  readonly book: GradeBook;
  /** The pupil's row, or null while the sheet is closed. */
  readonly row: BookRow | null;
  readonly name: string;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
  readonly onClose: () => void;
  readonly onJustify: (pupilId: string) => void;
};

export function BookValue({ book, row, name, returnFocusRef, onClose, onJustify }: BookValueProps) {
  const t = useText();
  return (
    <BottomSheet
      testID="book-value"
      visible={row !== null}
      title={name}
      context={row === null ? '' : t('marks.book.value.context', { n: row.number })}
      reassurance={t('marks.book.value.reassurance')}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
    >
      {row !== null && <ValueBody book={book} row={row} onJustify={onJustify} />}
    </BottomSheet>
  );
}

function ValueBody({ book, row, onJustify }: Pick<BookValueProps, 'book' | 'onJustify'> & { row: BookRow }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const full = (value: number | 'absent' | null) => (typeof value === 'number' ? fullMark(value) : cellText(t, value));
  const lines = [
    ...book.parts.map((part) => ({ key: part, label: partLabel(t, part), value: partValue(row, part) })),
    ...(book.formula === null ? [] : [{ key: 'average', label: t('marks.book.average'), value: row.average }]),
  ];
  const formula = formulaWith(t, book, row);
  return (
    <>
      {row.average !== null && (
        <View testID="book-value-pair" accessible style={styles.pair}>
          <View style={styles.grow}>
            <Text style={[styles.note, align]}>{t('marks.book.value.shown')}</Text>
            <Text style={[styles.big, align]}>{cellText(t, row.average)}</Text>
          </View>
          <View style={styles.grow}>
            <Text style={[styles.note, align]}>{t('marks.book.value.full')}</Text>
            <Text style={[styles.big, align]}>{fullMark(row.average)}</Text>
          </View>
        </View>
      )}
      <View style={styles.table}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.row}>
          <Text style={[styles.note, styles.grow, align]}>{t('marks.book.value.part')}</Text>
          <Text style={[styles.note, styles.cell]}>{t('marks.book.value.inBook')}</Text>
          <Text style={[styles.note, styles.cell]}>{t('marks.book.value.whole')}</Text>
        </View>
        {lines.map((line) => (
          <View
            key={line.key}
            testID={`book-value-${line.key}`}
            accessible
            accessibilityLabel={`${line.label}: ${cellText(t, line.value)}${t('marks.book.comma')}${full(line.value)}`}
            style={styles.row}
          >
            <Text style={[styles.label, styles.grow, align]}>{line.label}</Text>
            <Text style={[styles.body, styles.cell]}>{cellText(t, line.value)}</Text>
            <Text style={[styles.body, styles.cell]}>{full(line.value)}</Text>
          </View>
        ))}
      </View>
      {formula !== null && (
        <Text testID="book-value-formula" style={[styles.body, styles.formula]}>
          {formula}
        </Text>
      )}
      <Text testID="book-value-verdict" style={[styles.body, align]}>
        {verdictLine(t, book, row)}
      </Text>
      <Button
        testID="book-value-justify"
        variant="line"
        label={t('marks.book.value.justify')}
        onPress={() => onJustify(row.pupilId)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing['space-12'] },
  grow: { flex: 1, gap: spacing['space-2'] },
  table: { gap: spacing['space-4'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  cell: { width: 72, textAlign: 'center', writingDirection: 'ltr' },
  big: { ...typography.stat, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  formula: { writingDirection: 'ltr', textAlign: 'center' },
});
