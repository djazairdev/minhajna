// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ما يتغيّر» for a day that adds sessions (#219, Calendar-add-sessions):
// the day, the weekday it follows and its sessions; where they go, as plan
// sessions or on the page for additional lessons; the closure it makes up
// for, whose sessions stay lost; and, for a make-up day, each class's spare
// sessions before the exams, before and after; and, for a support or
// revision day, when a session has no time yet for the page. Facts only
// (R-3.1-15).

import {
  addedSessions,
  makeContext,
  sessionsBetween,
  slotKey,
  weekday,
  type CalendarEntry,
  type Context,
  type FollowedEntry,
  type Session,
  type Slot,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData, type AppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { isolate } from '../week/grid-labels';
import { dayName } from '../today/DayMark';
import { spareChanges } from './add-sessions-rules';

type Translate = ReturnType<typeof useText>;

type Labelled = { readonly courseId: string; readonly groupId: string; readonly slot: Slot };

/** «4م1 · 08:00», with the group and the A or B week when they matter. */
export function sessionLabel(
  t: Translate,
  data: Pick<AppData, 'state' | 'bells' | 'calendar'>,
  one: Labelled | FollowedEntry,
  day: Session['day'],
): string {
  const entry = 'entry' in one ? one.entry : one;
  const course = data.state.courses.get(entry.courseId);
  const schoolClass = course && data.state.classes.get(course.classId);
  const school = schoolClass && data.state.schools.get(schoolClass.schoolId);
  const time = sessionTime(data, school, entry.slot, day);
  const group = schoolClass?.groups.find((candidate) => candidate.id === entry.groupId);
  const slot = t(entry.slot.half === 'morning' ? 'week.slotMorning' : 'week.slotAfternoon', {
    index: entry.slot.index,
  });
  const weeks =
    'entry' in one && one.entry.weeks !== 'every' ? t(one.entry.weeks === 'A' ? 'week.weekA' : 'week.weekB') : null;
  return [
    schoolClass?.name ?? '—',
    time?.from ?? slot,
    group !== undefined && group.kind !== 'whole' ? group.name : null,
    weeks,
  ]
    .filter((part) => part !== null)
    .join('\u00a0·\u00a0');
}

function spareText(t: Translate, spare: number): string {
  if (spare === 0) return t('addSessions.spareNone');
  return spare > 0
    ? t('count.sessions', { count: spare })
    : t('addSessions.spareShort', { sessions: t('count.sessions', { count: -spare }) });
}

export function AddSessionsChanges({ context, entry }: { readonly context: Context; readonly entry: CalendarEntry }) {
  const t = useText();
  const { direction } = useLocale();
  const data = useAppData();
  const language = currentLanguage();
  const withDay = makeContext(context.ref, {
    ...context.state,
    calendar: [...context.state.calendar.filter((one) => one.id !== entry.id), entry],
  });
  const sessions =
    entry.adds === 'make-up'
      ? sessionsBetween(withDay, entry.from, entry.to).filter((session) => session.added === entry.id)
      : addedSessions(withDay, entry.from, entry.to, ['support', 'revision'])
          .map((one) => one.session)
          .filter((session) => session.added === entry.id);
  const untimed =
    entry.adds !== 'make-up' &&
    sessions.some((session) => {
      const schoolClass = data.state.classes.get(session.classId);
      const school = schoolClass && data.state.schools.get(schoolClass.schoolId);
      return sessionTime(data, school, session.slot, session.day) === null;
    });
  const periods = [
    ...new Map(
      sessions.map((session) => [`${session.classId}/${slotKey(session.slot)}/${session.groupId}`, session]),
    ).values(),
  ];
  const closure = context.state.calendar.concat(context.ref.calendar).find((one) => one.id === entry.replaces);
  const spares =
    entry.adds === 'make-up'
      ? spareChanges(context, withDay, [...new Set(sessions.map((session) => session.courseId))], data.today())
      : [];
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const summary = t('addSessions.summary', {
    day: dayName(t, entry.from, language, data.profile),
    weekday: t(`week.days.${entry.follows ?? weekday(entry.from)}`),
    sessions: t('count.sessions', { count: periods.length }),
    list: periods
      .map((session) => isolate(sessionLabel(t, data, session, session.day)))
      .join(t('addSessions.separator')),
  });
  return (
    <View testID="add-changes" accessible style={styles.card}>
      <Text style={[styles.label, align]}>{t('addSessions.changes')}</Text>
      <Text style={[styles.body, align]}>{summary}</Text>
      <Text style={[styles.body, align]}>
        {t(entry.adds === 'make-up' ? 'addSessions.makeUpLine' : 'addSessions.supportLine')}
      </Text>
      {untimed && (
        <Text testID="add-untimed" style={[styles.caption, align]}>
          {t('addSessions.untimed')}
        </Text>
      )}
      {closure !== undefined && (
        <Text style={[styles.caption, align]}>
          {t('addSessions.replacesLine', {
            closure: [localized(closure.name), dayName(t, closure.from, language, data.profile)]
              .map(isolate)
              .join(t('addSessions.separator')),
          })}
        </Text>
      )}
      {spares.length > 0 && (
        <View testID="add-spare" style={styles.spares}>
          <Text style={[styles.caption, align]}>{t('addSessions.spare')}</Text>
          {spares.map((spare) => (
            <Text key={spare.courseId} style={[styles.caption, align]}>
              {t('addSessions.spareLine', {
                name: isolate(data.state.classes.get(spare.classId)?.name ?? '—'),
                before: spareText(t, spare.before),
                after: spareText(t, spare.after),
              })}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-16'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.soft,
  },
  spares: { gap: spacing['space-4'] },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  caption: { ...typography.caption, color: colors.ink2 },
});
