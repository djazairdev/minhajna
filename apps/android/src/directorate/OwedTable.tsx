// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the system owes teachers, as M-Totals draws it (#598, R-7.9-05, answer
// 629): a table with a row for each subject the directorate holds, its name the
// row's header, and a column for each figure, teachers, schools, cover given,
// vacant posts, weekly hours without a teacher and sessions lost to closures,
// so they compare down a column, as the dashboard's table does
// (DashboardTable.tsx). A hidden figure says so in one cell across the
// figures' columns, which says it spans them. The last row is the server's
// figure over every subject, whose teachers are at least that many, as a
// teacher may teach several subjects; the server's floors keep it from showing
// a hidden row by subtraction.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { DirectorateFigures, Figure } from './totals-read';

const FIGURES = ['teachers', 'schools', 'cover', 'vacantPosts', 'hoursWithoutTeacher', 'closed'] as const;

export type OwedTableProps = {
  readonly figures: DirectorateFigures;
  /** A subject's name in the interface's language. */
  readonly subject: (code: string) => string;
};

/** The owed tab's table, one row for each subject and one over every subject. */
export function OwedTable({ figures, subject }: OwedTableProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const cell = (key: string, words: string, role: 'columnheader' | 'rowheader' | 'cell', span = 1) => (
    <View
      key={key}
      role={role}
      {...(span > 1 ? ({ 'aria-colspan': span } as object) : {})}
      style={[styles.cell, { flex: span }, role === 'columnheader' && styles.head]}
    >
      <Text style={[role === 'cell' ? styles.value : styles.label, align]}>{words}</Text>
    </View>
  );
  const row = (key: string, name: string, figure: Figure | null, all = false) => (
    <View key={key} testID={all ? 'owed-all' : `owed-row-${key}`} role="row" style={[styles.row, styles.ruled]}>
      {cell('name', name, 'rowheader')}
      {figure === null
        ? cell('hidden', t('demo.totals.hidden'), 'cell', FIGURES.length)
        : FIGURES.map((one) =>
            cell(
              one,
              all && one === 'teachers' ? t('demo.totals.atLeast', { figure: figure[one] }) : String(figure[one]),
              'cell',
            ),
          )}
    </View>
  );
  return (
    <View testID="owed-table" role="table" focusable accessibilityLabel={t('demo.totals.owed')} style={styles.table}>
      <View role="row" style={styles.row}>
        {cell('subject', t('demo.totals.column.subject'), 'columnheader')}
        {FIGURES.map((one) => cell(one, t(`demo.totals.column.${one}`), 'columnheader'))}
      </View>
      {figures.subjects.map(([code, figure]) => row(code, subject(code), figure))}
      {row('', t('demo.totals.all'), figures.all, true)}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  cell: { minWidth: 0, paddingVertical: spacing['space-8'], paddingHorizontal: spacing['space-8'] },
  head: { backgroundColor: colors.well },
  label: { ...typography.label, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
});
