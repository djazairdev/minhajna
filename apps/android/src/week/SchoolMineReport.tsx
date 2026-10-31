// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The term report the director reads, in a demo world (#584,
// School-mine-report, §7.5, R-7.5-06, R-7.5-08, answer 612), opened from the
// teacher's classes (SchoolMine.tsx) under the band, its title said as
// School-join says it, its way back returning to the classes: the term so far,
// as School-mine reads it (useMineTerm.ts), or that the school has no calendar,
// or that no term holds the world's date; for each course with a signed week
// this term, in the school's order of classes, headed by its class and subject,
// how many sessions of its signed weeks are confirmed, and of them how many
// were held as planned, not held for the calendar and not held for another
// cause, and the list of the sessions not held, in day order, each with its day
// and its bell span, its group when it has one, and the calendar's entry that
// took it or «other»; never how many await confirmation, nor a figure it could
// be worked out from (R-7.6-02). With no week signed this term it says the
// report is empty. Make-up sessions come with Today's make-ups outside a world,
// so a world shows none and says so; each class has its own figures, with no
// total for the school and no ranking (R-2.6-07), and «other» gathers all the
// calendar does not hold, with no reasons, which stay on the teacher's devices.
// A problem reading is shown in the catalogue's words, said off a PC, with a
// way to read again.

import type { CourseDelivery, Day, LostSession, SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { spanText } from '../timetable/grid-text';
import { isolate } from './grid-labels';
import type { MineCalendar } from './school-mine-session';
import { useMineTerm } from './useMineTerm';
import { useSaid } from './useSaid';
import { WeekPage } from './WeekPage';

export type SchoolMineReportProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** What School-join said as the page opened, its title. */
  readonly said: string;
  /** The joined school's calendar, without which no term is known. */
  readonly mine?: MineCalendar;
};

/** The term report the director reads: each course's sessions held and not held this term, from the signed weeks. */
export function SchoolMineReport(props: SchoolMineReportProps) {
  const { world, dayText, onClose, said } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { say, region } = useSaid(said, 'report-said');
  const { channel, reading, problem, load, term, deliveries } = useMineTerm(props, say);
  const course = (one: CourseDelivery) => `${isolate(one.class)} · ${isolate(one.subject)}`;
  const session = (one: LostSession) =>
    [dayText(one.day), spanText(one.session.start, one.session.end)]
      .concat(one.session.group === '' ? [] : [isolate(one.session.group)])
      .join(' · ');
  const line = (one: LostSession) =>
    one.entry === null
      ? t('demo.report.lostOther', { session: session(one) })
      : t('demo.report.lostCalendar', { session: session(one), entry: localized(one.entry.name) });
  return (
    <WeekPage
      testID="report"
      date={world.date}
      region={region}
      title={t('demo.report.title')}
      subtitle={t('demo.report.subtitle', { date: dayText(world.date) })}
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
          <Button testID="report-again" variant="line" label={t('demo.weekSign.again')} onPress={load} />
        </View>
      )}
      <Text style={[styles.body, align]}>
        {props.mine === undefined
          ? t('demo.mine.noCalendar')
          : term === null
            ? t('demo.mine.noTerm')
            : t('demo.mine.term', { number: term.number, from: dayText(term.from), to: dayText(world.date) })}
      </Text>
      {channel !== null && term !== null && deliveries.length === 0 && (
        <Text style={[styles.body, align]}>{t('demo.report.noCourse')}</Text>
      )}
      {deliveries.map((one) => (
        <View key={one.course} testID="report-course" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {course(one)}
          </Text>
          <Text style={[styles.body, align]}>
            {t('demo.report.confirmed', { count: one.held + one.calendar + one.other })}
          </Text>
          <Text style={[styles.body, align]}>{t('demo.mine.counts.held', { count: one.held })}</Text>
          <Text style={[styles.body, align]}>{t('demo.mine.counts.calendar', { count: one.calendar })}</Text>
          <Text style={[styles.body, align]}>{t('demo.mine.counts.other', { count: one.other })}</Text>
          {one.lost.length > 0 && (
            <View testID="report-lost" style={styles.list}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t('demo.report.lostList')}
              </Text>
              {one.lost.map((each, at) => (
                <Text key={`${at}`} style={[styles.small, align]}>
                  {line(each)}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
      <Text style={[styles.small, align]}>{t('demo.report.makeUps')}</Text>
      <Text style={[styles.small, align]}>{t('demo.report.foot')}</Text>
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
  list: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
