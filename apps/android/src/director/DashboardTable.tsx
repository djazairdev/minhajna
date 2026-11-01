// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes' progress as D-Dashboard draws it on the PC (#569, R-7.6-08,
// answer 591): a table with a column for each figure, so they compare down a
// column and a keyboard or screen reader moves cell by cell, as the chart's
// table does (ChartFigure.tsx). Its head names the class, the subject, the
// teacher, the place in the plan, the pace, how far the class reached, and the
// sessions not held, closures' and others' apart; each row's class is its row
// header. A row without figures says why in one cell across the figures'
// columns, which says it spans them (dashboard-text.ts).

import type { DashboardCourse, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { paceText, personName, positionText, reachedText, waitingText } from './dashboard-text';

const FIGURES = ['position', 'pace', 'reached', 'closure', 'other'] as const;

export type DashboardTableProps = {
  readonly school: DemoSchool;
  readonly courses: readonly DashboardCourse[];
  /** A subject's name in the interface's language. */
  readonly subject: (code: string) => string;
};

/** The progress view's table, one row for each class and subject shown. */
export function DashboardTable({ school, courses, subject }: DashboardTableProps) {
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
  return (
    <View
      testID="dashboard-table"
      role="table"
      focusable
      accessibilityLabel={t('demo.dashboard.progress')}
      style={styles.table}
    >
      <View role="row" style={styles.row}>
        {cell('class', t('demo.dashboard.column.class'), 'columnheader')}
        {cell('subject', t('demo.dashboard.column.subject'), 'columnheader')}
        {cell('teacher', t('demo.dashboard.column.teacher'), 'columnheader')}
        {FIGURES.map((one) => cell(one, t(`demo.dashboard.column.${one}`), 'columnheader'))}
      </View>
      {courses.map((course) => {
        const waiting = waitingText(t, school, course);
        const standing = course.standing;
        return (
          <View
            key={`${course.classId}-${course.subject}-${course.teacher?.id ?? ''}`}
            testID={`dashboard-row-${course.classId}-${course.subject}`}
            role="row"
            style={[styles.row, styles.ruled]}
          >
            {cell('class', course.className, 'rowheader')}
            {cell('subject', subject(course.subject), 'cell')}
            {cell(
              'teacher',
              course.teacher === null ? t('demo.dashboard.noTeacher') : personName(course.teacher),
              'cell',
            )}
            {waiting !== null || standing === null
              ? cell('waiting', waiting ?? '', 'cell', FIGURES.length)
              : [
                  cell('position', positionText(t, standing), 'cell'),
                  cell('pace', paceText(t, standing), 'cell'),
                  cell('reached', t('demo.dashboard.percent', { percent: reachedText(standing) }), 'cell'),
                  cell('closure', String(standing.notHeld.closure), 'cell'),
                  cell('other', String(standing.notHeld.other), 'cell'),
                ]}
          </View>
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
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  cell: { minWidth: 0, paddingVertical: spacing['space-8'], paddingHorizontal: spacing['space-8'] },
  head: { backgroundColor: colors.well },
  label: { ...typography.label, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
});
