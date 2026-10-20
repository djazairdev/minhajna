// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, type CalendarImpact, type Session } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { sessionLabel } from '../extra/AddSessionsChanges';
import { useAppData } from '../storage/AppData';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';

/** Before/after facts only; omitted packs and unknown exam dates are not filled with invented figures. */
export function Impact({ impact }: { impact: CalendarImpact }) {
  const t = useText();
  const data = useAppData();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const status = (session: Session | null) =>
    [
      session === null
        ? ''
        : data.state.classes.get(session.classId)?.groups.find((one) => one.id === session.groupId)?.name,
      t(`calendarView.edit.status.${session === null ? 'none' : (session.calendar ?? 'open')}`),
    ]
      .filter(Boolean)
      .join(' · ');
  return (
    <View testID="calendar-impact" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.edit.preview')}
      </Text>
      <Text style={[styles.body, align]}>{t('calendarView.edit.affected', { count: impact.changes.length })}</Text>
      {impact.changes.map(({ before, after }) => {
        const session = (after ?? before)!;
        return (
          <Text key={session.key} style={[styles.body, align]}>
            {t('calendarView.edit.changeLine', {
              day: formatDay(session.day),
              session: sessionLabel(t, data, session, session.day),
              before: status(before),
              after: status(after),
            })}
          </Text>
        );
      })}
      <Text style={[styles.sub, align]}>{t('calendarView.edit.recorded', { count: impact.recorded })}</Text>
      {impact.courses.map((course) => (
        <Text key={course.courseId} style={[styles.sub, align]}>
          {t('calendarView.edit.capacity', {
            class: data.state.classes.get(data.state.courses.get(course.courseId)!.classId)!.name,
            day: formatDay(course.after.before),
            before: course.before.gives,
            after: course.after.gives,
            needs: course.after.needs,
            basis:
              course.after.basis === 'term-end'
                ? t('calendarView.edit.termEnd')
                : t(`settings.confidence.${course.after.confidence!}`),
          })}
        </Text>
      ))}
      {impact.courses.map((course) => (
        <Text key={`td-${course.courseId}`} style={[styles.sub, align]}>
          {t('calendarView.groups.tdCapacity', {
            day: formatDay(course.after.before),
            gives: course.after.td.gives,
            items: course.after.td.items,
          })}
        </Text>
      ))}
    </View>
  );
}
