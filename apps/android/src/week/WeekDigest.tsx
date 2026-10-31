// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly digest in a demo world (#584, Digest-signed, §3.9, R-3.9-08,
// R-3.1-08, answer 612), for the teacher alone, opened from a joined school's
// card under the band, its title said as School-join says it: as it opens it
// reads the teacher's channel (week-sign-session.ts), as Week-sign does; the
// world's week, from its first working day to the world's date, and that the
// digest reaches the teacher alone; how many of the week's sessions in the
// timetable in force are confirmed, held or not held, by their slot in the
// signed weeks at their version in force, of how many, so a timetable changed
// after signing never counts more than it lists; which classes' weeks are
// signed, or that none is yet; each course's week not yet signed, headed by its
// class, with its dates, that it stays on the teacher's devices until signed
// and that the director then sees only each session's state, and a button that
// opens Week-sign on that course, whose way back returns here; each correction
// after signing, numbered by its version, the session it changed, from what to
// what, and its reason when it has one (answer 611); that each class's plan
// position, buffers and the coming exams come with a plan pack; and that it
// reaches the teacher alone and nothing of it the director, and outside a world
// comes on Sunday morning after the quiet hours. Without a timetable from the
// school, or a session this week, it says so. A problem reading is shown in the
// catalogue's words, said off a PC, with a way to read again. Each visa given
// in the world's week (#585, R-7.5-14, answer 613), on that week or an earlier
// one, comes with its course, its week's dates, the version it was given on and
// its day, as a comment that never changes the week, the teacher's access log
// in a world, with the line that in a world it shows as given in the school's
// space, without proof that the director gave it.

import { sessionSlot, weekChanges, type Day, type SchoolJoined, type Subject, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from './grid-labels';
import { useSaid } from './useSaid';
import { WeekPage } from './WeekPage';
import {
  courseKey,
  courseLabel,
  readSignChannel,
  signedWeek,
  weekEnd,
  weeksToSign,
  weekStart,
  type SignChannel,
} from './week-sign-session';
import { slotText } from './week-sign-text';

export type WeekDigestProps = {
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
  /** Opens Week-sign on a course, by its key. */
  readonly onSign: (course: string) => void;
};

/** The world's week for the teacher alone: what is confirmed and signed, what waits, and what was corrected. */
export function WeekDigest(props: WeekDigestProps) {
  const { world, join, kit, send, dayText, onClose, said, workingDays = [0, 1, 2, 3, 4], subjects = [] } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [channel, setChannel] = useState<SignChannel | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const { say, region } = useSaid(said, 'digest-said');
  const mounted = useRef(true);
  const read = () =>
    readSignChannel(world, join, kit, send).then(
      (read) => {
        if (!mounted.current) return;
        setChannel(read);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setProblem(problemOf(error));
        setReading(false);
        if (!onPc()) say(t(problemOf(error)));
      },
    );
  const load = () => {
    setReading(true);
    setProblem(null);
    void read();
  };
  const first = useEffectEvent(() => void read());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const start = weekStart(world.date, workingDays);
  const dates = t('demo.weekSign.dates', { from: dayText(start), to: dayText(world.date) });
  const weeks = channel === null ? [] : weeksToSign(channel.parts, world.date, workingDays, subjects);
  const records = (channel?.weeks ?? []).map((one) => one.week);
  const signedOf = (one: (typeof weeks)[number]) => signedWeek(records, one, start);
  const signed = weeks.filter((one) => signedOf(one) !== undefined);
  const waiting = weeks.filter((one) => signedOf(one) === undefined);
  const total = weeks.reduce((sum, one) => sum + one.sessions.length, 0);
  const confirmedIn = (one: (typeof weeks)[number]) => {
    const states = new Map(signedOf(one)?.sessions.map((each) => [sessionSlot(each), each.state]));
    return one.sessions.filter((each) => (states.get(sessionSlot(each)) ?? 'awaiting') !== 'awaiting').length;
  };
  const confirmed = signed.reduce((sum, one) => sum + confirmedIn(one), 0);
  const label = (one: (typeof weeks)[number]) => isolate(courseLabel(weeks, one));
  const fixes = weeks.flatMap((one) => {
    const read = channel?.weeks.find((each) => each.week === signedOf(one));
    const versions = read === undefined ? [] : [...read.earlier, read].map((each) => each.week);
    return versions.slice(1).flatMap((version, at) =>
      weekChanges(versions[at], version).map((change) => {
        const line = t('demo.digest.fixLine', {
          number: version.version,
          course: label(one),
          session: slotText(t, change.slot),
          before: t(`demo.weekFix.states.${change.before ?? 'none'}`),
          after: t(`demo.weekFix.states.${change.after ?? 'none'}`),
        });
        const reason = version.reason === undefined ? '' : t(`demo.weekFix.reasons.${version.reason}`);
        return reason === '' ? line : t('demo.weekFix.because', { change: line, reason });
      }),
    );
  });
  const weekDates = (from: Day) =>
    t('demo.weekSign.dates', {
      from: dayText(from),
      to: dayText(weekEnd(from, workingDays)),
    });
  const visas = (channel?.visas ?? [])
    .filter((one) => one.value.day >= start && one.value.day <= world.date)
    .flatMap((one) => {
      const { course, week, version, day } = one.value;
      const read = channel?.weeks.find((each) => each.week.course === course && each.week.week === week);
      if (read === undefined) return [];
      const text = t('demo.digest.visaLine', {
        course: isolate(`${read.week.class} · ${read.week.subject}`),
        dates: weekDates(week),
        version: version === 0 ? t('demo.digest.visaOriginal') : t('demo.digest.visaFix', { number: version }),
        day: dayText(day),
      });
      return [{ key: `${course}\n${week}\n${version}`, text }];
    });
  return (
    <WeekPage
      testID="digest"
      date={world.date}
      region={region}
      title={t('demo.digest.title')}
      subtitle={t('demo.digest.subtitle', { dates })}
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
          <Button testID="digest-again" variant="line" label={t('demo.weekSign.again')} onPress={load} />
        </View>
      )}
      {channel !== null && weeks.length === 0 && (
        <Text style={[styles.body, align]}>
          {t(channel.parts.length === 0 ? 'demo.weekSign.noTimetable' : 'demo.weekSign.noSessions')}
        </Text>
      )}
      {weeks.length > 0 && (
        <View testID="digest-head" style={styles.card}>
          <Text style={[styles.head, align]}>{t('demo.digest.confirmed', { confirmed, total })}</Text>
          <Text style={[styles.body, align]}>
            {signed.length === 0
              ? t('demo.digest.noneSigned')
              : t('demo.digest.signed', { classes: signed.map(label).join(t('demo.weekSign.listJoin')) })}
          </Text>
        </View>
      )}
      {waiting.map((one) => (
        <View key={courseKey(one)} testID="digest-waiting" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {label(one)}
          </Text>
          <Text style={[styles.body, align]}>{t('demo.digest.unsigned')}</Text>
          <Text style={[styles.small, align]}>{dates}</Text>
          <Text style={[styles.small, align]}>{t('demo.digest.unsignedLine')}</Text>
          <Button
            testID="digest-sign"
            variant="line"
            label={t('demo.digest.sign', { class: label(one) })}
            onPress={() => props.onSign(courseKey(one))}
          />
        </View>
      ))}
      {fixes.length > 0 && (
        <View testID="digest-fixes" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.digest.fixes')}
          </Text>
          {fixes.map((line, at) => (
            <Text key={`${at}`} style={[styles.small, align]}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {visas.length > 0 && (
        <View testID="digest-visas" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.digest.visas')}
          </Text>
          {visas.map((one) => (
            <Text key={one.key} style={[styles.small, align]}>
              {one.text}
            </Text>
          ))}
          <Text style={[styles.small, align]}>{t('demo.digest.visaDemo')}</Text>
        </View>
      )}
      {weeks.length > 0 && <Text style={[styles.small, align]}>{t('demo.digest.plan')}</Text>}
      <Text style={[styles.small, styles.centre]}>{t('demo.digest.foot')}</Text>
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
  centre: { textAlign: 'center' },
  problem: { ...typography.body, color: colors['error-ink'] },
});
