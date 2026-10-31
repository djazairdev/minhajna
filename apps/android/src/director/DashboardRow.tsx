// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A row of the director's dashboard (#569, answer 591), as one element for
// TalkBack: the class and subject, the teacher the timetable names or the
// vacant post, and one line for the chosen view. A joined class with figures
// gives its place in the plan, its delay, the buffer used and the sessions not
// held, the calendar's and others' apart, or the sessions awaiting
// confirmation; a class without them says why (dashboard-text.ts). On a PC the
// progress view is a table instead (DashboardTable.tsx).

import type { DashboardCourse, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { delayText, personName, positionText, waitingText } from './dashboard-text';

export type DashboardRowProps = {
  readonly school: DemoSchool;
  readonly course: DashboardCourse;
  /** The subject's name in the interface's language. */
  readonly subject: string;
  readonly view: 'progress' | 'awaiting';
};

/** One class and subject, with what the chosen view says of it. */
export function DashboardRow({ school, course, subject, view }: DashboardRowProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const standing = course.standing;
  const line =
    waitingText(t, school, course) ??
    (standing === null
      ? ''
      : view === 'awaiting'
        ? t('demo.dashboard.awaiting', { count: standing.awaiting })
        : t('demo.dashboard.standing', {
            position: positionText(t, standing.statement),
            delay: delayText(t, standing.statement),
            buffer: standing.statement.delay.bufferUsed,
            calendar: standing.statement.notHeld.calendar,
            other: standing.statement.notHeld.other,
          }));
  return (
    <View testID={`dashboard-row-${course.classId}-${course.subject}`} accessible style={styles.row}>
      <Text style={[styles.head, align]}>{`${course.className} · ${subject}`}</Text>
      <Text style={[styles.small, align]}>
        {course.teacher === null ? t('demo.dashboard.noTeacher') : personName(course.teacher)}
      </Text>
      <Text style={[styles.small, align]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing['space-8'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing['space-2'],
  },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
