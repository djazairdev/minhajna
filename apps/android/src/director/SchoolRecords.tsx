// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes' records in the director's workspace in a demo world (#585,
// D-Record, R-5.10-02, R-7.5-16, R-7.8-06, R-7.11-08, answer 613), read only:
// that the director changes no signed week or correction and sees nothing
// outside the school's space; as it opens it reads the teachers' channels with
// the school key (records-session.ts), and a problem reading is shown in the
// catalogue's words, said on the PC in its live line and announced on a phone,
// with a way to read again; with no week signed, it says so. The school's
// classes come as chips in the timetable's order, the first chosen; the chosen
// class shows each course by subject and teacher, and its signed weeks newest
// first, each by its dates and whether corrected, each opening the week
// (RecordWeek.tsx), whose way back returns here, and whose visa, once given or
// refused, has the records read again, the week staying open, found again in
// whichever class it is. The paper visa on the texts book stays until the
// Ministry's text, and the page lists what it never shows: private notes, the
// reasons a session was not held, the record before signing, the day, time and
// place of signing, correcting or confirming, a teacher's corrections in other
// weeks, and any ranking or comparison of teachers.

import { timetableNameKey, type Day, type DemoSchool, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { weekEnd } from '../week/week-sign-session';
import { readRecords, type ClassRecords, type RecordedWeek } from './records-session';
import { giveVisa } from './visa-session';
import { RecordWeek } from './RecordWeek';

export type SchoolRecordsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  readonly workingDays?: readonly Weekday[];
};

const NEVER = ['notes', 'reasons', 'before', 'days', 'others', 'ranks'] as const;

/** The classes' records the director reads: each class's courses and their signed weeks, read only. */
export function SchoolRecords(props: SchoolRecordsProps) {
  const { world, school, kit, send, dayText, workingDays = [0, 1, 2, 3, 4] } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [records, setRecords] = useState<readonly ClassRecords[] | null>(null);
  const [reading, setReading] = useState(true);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [open, setOpen] = useState<{ key: string; week: Day } | null>(null);
  const [said, setSaid] = useState('');
  const mounted = useRef(true);
  const read = () =>
    readRecords(world, school, kit, send).then(
      (found) => {
        if (!mounted.current) return;
        setRecords(found);
        setReading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        const key = problemOf(error);
        setProblem(key);
        setReading(false);
        if (onPc()) setSaid(t(key));
        else AccessibilityInfo.announceForAccessibility(t(key));
      },
    );
  const load = () => {
    setReading(true);
    setProblem(null);
    setSaid('');
    void read();
  };
  const visa = async (week: RecordedWeek) => {
    try {
      await giveVisa(world, week, kit, send);
    } finally {
      const found = await readRecords(world, school, kit, send).catch(() => null);
      if (mounted.current && found !== null) setRecords(found);
    }
  };
  const first = useEffectEvent(() => void read());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const classes = records ?? [];
  const shown = classes.find((one) => timetableNameKey(one.class) === chosen) ?? classes[0];
  const dates = (week: Day) =>
    t('demo.weekSign.dates', {
      from: dayText(week),
      to: dayText(weekEnd(week, workingDays)),
    });
  const course = classes.flatMap((one) => one.courses).find((one) => one.key === open?.key);
  const week = course?.weeks.find((one) => one.week.week === open?.week);
  if (course !== undefined && week !== undefined)
    return (
      <RecordWeek
        record={course}
        week={week}
        dates={dates(week.week.week)}
        dayText={dayText}
        onBack={() => setOpen(null)}
        onVisa={() => visa(week)}
        started={world.date >= week.week.week}
      />
    );
  return (
    <View testID="records" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.records.readOnly')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {reading ? t('demo.weekSign.steps.reading') : said}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="records-again" variant="line" label={t('demo.weekSign.again')} onPress={load} />
        </View>
      )}
      {records !== null && classes.length === 0 && <Text style={[styles.body, align]}>{t('demo.records.none')}</Text>}
      {classes.length > 0 && (
        <ChipGroup
          testID="records-class"
          label={t('demo.records.class')}
          choices={classes.map((one) => ({ value: timetableNameKey(one.class), label: one.class }))}
          selected={shown === undefined ? null : timetableNameKey(shown.class)}
          onSelect={setChosen}
        />
      )}
      {shown?.courses.map((one) => (
        <View key={one.key} testID="records-course" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {[isolate(one.subject), isolate(one.teacher)].join(' · ')}
          </Text>
          {one.weeks.map((each) => (
            <Button
              key={each.week.week}
              testID="records-week"
              variant="line"
              label={
                each.week.version === 0
                  ? dates(each.week.week)
                  : t('demo.records.fixedWeek', { dates: dates(each.week.week) })
              }
              onPress={() => setOpen({ key: one.key, week: each.week.week })}
            />
          ))}
        </View>
      ))}
      <Text style={[styles.small, align]}>{t('demo.records.paper')}</Text>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.records.never')}
        </Text>
        {NEVER.map((key) => (
          <Text key={key} style={[styles.small, align]}>
            {t(`demo.records.hidden.${key}`)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
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
