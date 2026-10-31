// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's classes in the school's space, as the director sees them, in a
// demo world (#584, School-mine, §3.9, R-3.9-08, answer 612), opened from a
// joined school's card under the band, its title said as School-join says it:
// as it opens it reads the teacher's channel (week-sign-session.ts), as
// Week-sign does; the term that holds the world's date, from its first day to
// that date, or that none does, or that the school has no calendar, and nothing
// is counted; the weekly teaching hours in the standing timetable in force;
// each course of that timetable or with a signed week this term, in the
// school's order of classes, headed by its class and subject, with its weekly
// sessions and hours in that timetable, and, once a week of it is signed this
// term, how many of its sessions were held as planned, await confirmation, were
// not held for the calendar or for another cause, counted at each week's
// version in force (course-delivery.ts, school-mine-session.ts), the dates of
// its last signed week, up to the world's date, and that plan progress and the
// threshold day come with a plan pack, or else that no week of it is signed
// this term; between terms no course is listed; that awaiting confirmation is
// no absence, is never printed and never leaves the screen, and that the space
// keeps no confirmation day, ranking, colours for people or clock times; and
// buttons that open the term report (SchoolMineReport.tsx) and Week-sign, whose
// ways back return here; what it reads comes from useMineTerm.ts. A problem
// reading is shown in the catalogue's words, said off a PC, with a way to read
// again.

import {
  addDays,
  compareDays,
  type CourseDelivery,
  type Day,
  type PartSession,
  type SchoolJoined,
  type Subject,
  type Weekday,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { hoursOf } from '../timetable/teacher-session';
import { hoursText } from '../timetable/version-text';
import { isolate } from './grid-labels';
import { classPlace, type MineCalendar } from './school-mine-session';
import { useSaid } from './useSaid';
import { WeekPage } from './WeekPage';
import { useMineTerm } from './useMineTerm';
import { courseKey, subjectCode } from './week-sign-session';

/** A course on the page: its sessions in the standing timetable in force, and its delivery this term if any. */
type Row = {
  readonly class: string;
  readonly subject: string;
  readonly sessions: readonly PartSession[];
  readonly delivery?: CourseDelivery;
};

const COLLATOR = new Intl.Collator('ar', { numeric: true });

export type SchoolMineProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** What School-join said as the page opened, its title. */
  readonly said: string;
  readonly workingDays?: readonly Weekday[];
  /** The country's subjects, which give each timetable subject its code. */
  readonly subjects?: readonly Subject[];
  /** The joined school's calendar, without which no term is known. */
  readonly mine?: MineCalendar;
  /** Opens Week-sign. */
  readonly onSign: () => void;
  /** Opens the term report. */
  readonly onReport: () => void;
};

/** The teacher's classes as the director sees them: the term so far, course by course, from the signed weeks. */
export function SchoolMine(props: SchoolMineProps) {
  const { world, dayText, onClose, said, workingDays = [0, 1, 2, 3, 4], subjects = [] } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { say, region } = useSaid(said, 'mine-said');
  const { channel, reading, problem, load, term, sessions, classes, deliveries } = useMineTerm(props, say);
  const keyOf = (one: { class: string; subject: string }) =>
    courseKey({ ...one, code: subjectCode(subjects, one.subject) });
  const rows = new Map<string, Row>();
  const row = (one: { class: string; subject: string }) =>
    rows.get(keyOf(one)) ?? { class: one.class, subject: one.subject, sessions: [] };
  for (const one of deliveries) rows.set(keyOf(one), { ...row(one), delivery: one });
  for (const one of sessions) rows.set(keyOf(one), { ...row(one), sessions: [...row(one).sessions, one] });
  const place = classPlace(classes);
  const order = (name: string) => place(name) ?? Infinity;
  const shown =
    term === null
      ? []
      : [...rows.values()].sort(
          (a, b) =>
            order(a.class) - order(b.class) ||
            COLLATOR.compare(a.class, b.class) ||
            COLLATOR.compare(a.subject, b.subject),
        );
  const last = workingDays.at(-1) ?? 4;
  const weekEnd = (from: Day) => {
    const end = addDays(from, (last - (workingDays[0] ?? 0) + 7) % 7);
    return compareDays(end, world.date) < 0 ? end : world.date;
  };
  const course = (one: { class: string; subject: string }) => `${isolate(one.class)} · ${isolate(one.subject)}`;
  const counts = (one: CourseDelivery) =>
    [
      ['held', one.held],
      ['awaiting', one.awaiting],
      ['calendar', one.calendar],
      ['other', one.other],
    ] as const;
  return (
    <WeekPage
      testID="mine"
      date={world.date}
      region={region}
      title={t('demo.mine.title')}
      subtitle={t('demo.mine.subtitle', { date: dayText(world.date) })}
      onBack={onClose}
    >
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {reading ? t('demo.weekSign.steps.reading') : ''}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="mine-again" variant="line" label={t('demo.weekSign.again')} onPress={load} />
        </View>
      )}
      <Text style={[styles.body, align]}>
        {props.mine === undefined
          ? t('demo.mine.noCalendar')
          : term === null
            ? t('demo.mine.noTerm')
            : t('demo.mine.term', { number: term.number, from: dayText(term.from), to: dayText(world.date) })}
      </Text>
      {channel !== null && channel.parts.length === 0 && (
        <Text style={[styles.body, align]}>{t('demo.weekSign.noTimetable')}</Text>
      )}
      {sessions.length > 0 && (
        <Text style={[styles.small, align]}>{t('demo.mine.hours', { hours: hoursText(t, hoursOf(sessions)) })}</Text>
      )}
      {shown.map((row) => (
        <View
          key={keyOf(row)}
          testID={row.delivery === undefined ? 'mine-unsigned' : 'mine-course'}
          style={styles.card}
        >
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {course(row)}
          </Text>
          {row.sessions.length > 0 && (
            <Text style={[styles.small, align]}>
              {t('demo.mine.weekly', { count: row.sessions.length, hours: hoursText(t, hoursOf(row.sessions)) })}
            </Text>
          )}
          {row.delivery === undefined ? (
            <Text style={[styles.small, align]}>{t('demo.mine.noWeek')}</Text>
          ) : (
            <>
              {counts(row.delivery).map(([key, count]) => (
                <Text key={key} style={[styles.body, align]}>
                  {t(`demo.mine.counts.${key}`, { count })}
                </Text>
              ))}
              <Text style={[styles.small, align]}>
                {t('demo.mine.lastWeek', {
                  from: dayText(row.delivery.lastWeek),
                  to: dayText(weekEnd(row.delivery.lastWeek)),
                })}
              </Text>
              <Text style={[styles.small, align]}>{t('demo.mine.plan')}</Text>
            </>
          )}
        </View>
      ))}
      <Text style={[styles.small, align]}>{t('demo.mine.foot')}</Text>
      <Button testID="mine-report" variant="line" label={t('demo.report.open')} onPress={props.onReport} />
      <Button testID="mine-sign" variant="line" label={t('demo.weekSign.open')} onPress={props.onSign} />
    </WeekPage>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
