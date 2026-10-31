// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's teachers (#570, answers 596 and 598), in the order the core gives:
// on the PC a table, the teacher, the subject, how they work and where their
// code stands in their columns, each teacher's name the row's header and the
// button that opens their panel; on the phone one line for each, a single
// button saying all four. The teacher chosen is said selected on the phone and
// current on the PC, and marked by an edge as well as its colour.

import type { Day, IssueRow } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { personName } from './dashboard-text';
import { accessText, statusText } from './issue-text';

export type IssueListProps = {
  readonly rows: readonly IssueRow[];
  readonly chosen: string | null;
  readonly subject: (code: string) => string;
  readonly dayText: (day: Day) => string;
  readonly onChoose: (teacherId: string) => void;
};

const COLUMNS = ['teacher', 'subject', 'access', 'status'] as const;

/** The teachers shown, each opening its panel. */
export function IssueList({ rows, chosen, subject, dayText, onChoose }: IssueListProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const words = (row: IssueRow) => [
    personName(row.teacher),
    subject(row.teacher.subject),
    accessText(t, row),
    statusText(t, row, dayText),
  ];
  if (!onPc())
    return (
      <View style={styles.card}>
        {rows.map((row) => {
          const [name, ...rest] = words(row);
          return (
            <Pressable
              key={row.teacher.id}
              testID={`issue-row-${row.teacher.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: chosen === row.teacher.id }}
              onPress={() => onChoose(row.teacher.id)}
              style={[styles.line, chosen === row.teacher.id && [styles.chosen, styles.mark]]}
            >
              <Text style={[styles.label, align]}>{name}</Text>
              <Text style={[styles.value, align]}>{rest.join(' · ')}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  const cell = (key: string, text: string, role: 'columnheader' | 'cell') => (
    <View key={key} role={role} style={[styles.cell, role === 'columnheader' && styles.head]}>
      <Text style={[role === 'cell' ? styles.value : styles.label, align]}>{text}</Text>
    </View>
  );
  return (
    <View testID="issue-table" role="table" accessibilityLabel={t('demo.pages.codes')} style={styles.card}>
      <View role="row" style={styles.row}>
        {COLUMNS.map((one) => cell(one, t(`demo.issue.column.${one}`), 'columnheader'))}
      </View>
      {rows.map((row) => {
        const [name = '', ...rest] = words(row);
        return (
          <View
            key={row.teacher.id}
            role="row"
            style={[styles.row, styles.ruled, chosen === row.teacher.id && [styles.chosen, styles.mark]]}
          >
            <View role="rowheader" style={styles.cell}>
              <Pressable
                testID={`issue-row-${row.teacher.id}`}
                accessibilityRole="button"
                {...({ 'aria-current': chosen === row.teacher.id ? 'true' : undefined } as object)}
                onPress={() => onChoose(row.teacher.id)}
              >
                <Text style={[styles.label, align]}>{name}</Text>
              </Pressable>
            </View>
            {rest.map((text, at) => cell(COLUMNS[at + 1], text, 'cell'))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  cell: { flex: 1, minWidth: 0, paddingVertical: spacing['space-8'], paddingHorizontal: spacing['space-8'] },
  head: { backgroundColor: colors.well },
  line: { paddingVertical: spacing['space-8'], paddingHorizontal: spacing['space-16'], gap: spacing['space-2'] },
  chosen: { backgroundColor: colors.well },
  mark: { borderStartWidth: 4, borderStartColor: colors.ink },
  label: { ...typography.label, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
});
