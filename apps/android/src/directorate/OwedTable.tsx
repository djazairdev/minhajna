// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the system owes teachers, as M-Totals draws it (#598, R-7.9-05, answer
// 629) and N-Totals (#599, answer 630): a table with a row for each subject the
// directorate holds, or each wilaya, its name the row's header, and a column
// for each figure, teachers, schools, cover given, vacant posts, weekly hours
// without a teacher and sessions lost to closures, so they compare down a
// column, as the dashboard's table does (DashboardTable.tsx). A hidden figure
// says so in one cell across the figures' columns, which says it spans them.
// The last row is the server's figure over every subject, or the nation's; a
// figure over every subject says its teachers are at least that many, as a
// teacher may teach several subjects; the server's floors keep the last row
// from showing a hidden one by subtraction.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { DirectorateFigures, Figure } from './totals-read';

/** A row of the table: its key, the name heading it, its figure, and whether its teachers are a lower bound. */
export interface OwedRow {
  readonly key: string;
  readonly name: string;
  readonly figure: Figure | null;
  readonly atLeast?: boolean;
}

/** The directorate's rows: one for each subject, and one over every subject. */
export function subjectRows(figures: DirectorateFigures, subject: (code: string) => string, all: string): OwedRow[] {
  const rows = figures.subjects.map(([code, figure]) => ({ key: code, name: subject(code), figure }));
  return [...rows, { key: '', name: all, figure: figures.all, atLeast: true }];
}

const FIGURES = ['teachers', 'schools', 'cover', 'vacantPosts', 'hoursWithoutTeacher', 'closed'] as const;

export type OwedTableProps = {
  readonly rows: readonly OwedRow[];
  /** The first column's heading, such as the subject or the wilaya. */
  readonly first: string;
  /** Each row's test ID is this, a hyphen and its key, and the last row's this and -all. */
  readonly testID: string;
};

/** The owed tab's table, one row for each subject or wilaya and a last one over them. */
export function OwedTable({ rows, first, testID }: OwedTableProps) {
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
  const row = ({ key, name, figure, atLeast = false }: OwedRow, last: boolean) => (
    <View key={key} testID={last ? `${testID}-all` : `${testID}-${key}`} role="row" style={[styles.row, styles.ruled]}>
      {cell('name', name, 'rowheader')}
      {figure === null
        ? cell('hidden', t('demo.totals.hidden'), 'cell', FIGURES.length)
        : FIGURES.map((one) =>
            cell(
              one,
              atLeast && one === 'teachers' ? t('demo.totals.atLeast', { figure: figure[one] }) : String(figure[one]),
              'cell',
            ),
          )}
    </View>
  );
  return (
    <View testID="owed-table" role="table" focusable accessibilityLabel={t('demo.totals.owed')} style={styles.table}>
      <View role="row" style={styles.row}>
        {cell('first', first, 'columnheader')}
        {FIGURES.map((one) => cell(one, t(`demo.totals.column.${one}`), 'columnheader'))}
      </View>
      {rows.map((one, at) => row(one, at === rows.length - 1))}
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
