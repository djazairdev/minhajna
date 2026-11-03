// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's exam thresholds in the director's workspace (D-Threshold, #603,
// §7.10, R-7.10-02, R-7.10-03, R-7.10-11, R-7.10-12, R-7.10-19, answers 101,
// 614, 632, 636 and 637): as it opens, and when the world's date moves, it
// reads the rooms of the school exams whose figures day has come
// (useSchoolRooms.ts), its live line saying while it reads or signs and what
// was decided or opened; a problem reading or deciding is said in the
// catalogue's words as an alert, also announced on a phone, with a way to read
// again. It chooses an exam, the latest by default, each with its first day as
// the calendar now has it, and a grade, the first, then lists that grade's
// subjects in the timetable's order, never by progress, each with how many
// setters it has, the item every class reached, and where its cut stands or,
// after the exam, the cut as published (published-text.ts), or that the
// decision lapsed; a subject chosen, the first by default, opens its room
// (ThresholdRoomPanel.tsx), said as it opens and marked on its row, where the
// director decides while it is theirs. With no room it says no school exam's
// figures day has come or no room is open yet, or after the year's last day
// that the year has ended. It says that the figures come from signed weeks only
// and never leave the school's space, that each cut is signed and kept with its
// figures, that the setters see the cut before the exam and every teacher of
// the subject at the grade once it is published, and that nothing here
// evaluates, ranks or serves a personnel decision.

import { compareDays, type CalendarUpdate, type Day, type DemoSchool, type WorldExam } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { gradeName } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { examOver, publishedText } from '../threshold/published-text';
import { lapsed, type SchoolRoom } from '../threshold/school-rooms';
import { everyReached, examName, examsOf, itemNamer, stateText } from '../threshold/threshold-text';
import { thresholdStyles as styles } from '../threshold/ThresholdFrame';
import { useSchoolRooms } from '../threshold/useSchoolRooms';
import { isolate } from '../week/grid-labels';
import type { TermReference } from './seeded-fill';
import { ThresholdRoomPanel } from './ThresholdRoomPanel';

export type DirectorThresholdsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date' | 'book'>;
  readonly school: DemoSchool;
  readonly reference: TermReference;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
};

const NOTES = ['signed', 'kept', 'teachers', 'never'] as const;
const page = { gap: spacing['space-12'] } as const;
const problem = { ...typography.body, color: colors['error-ink'] } as const;
const chosenRow = { backgroundColor: colors.well, borderStartWidth: 4, borderStartColor: colors.ink } as const;

/** The school's exams with a common paper, by grade and subject, and the room of the subject chosen. */
export function DirectorThresholds(props: DirectorThresholdsProps) {
  const { world, school, reference, kit, send, dayText, updates } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const read = useSchoolRooms(world, school, reference, kit, send);
  const [chosen, setChosen] = useState<{ exam?: string; grade?: string; subject?: string }>({});
  const rooms = read.rooms ?? [];
  const calendar = useMemo(() => examsOf(reference), [reference]);
  const now = (one: WorldExam) => calendar.get(one.id) ?? one;
  const exams = [...new Map(rooms.map((one) => [one.exam.id, now(one.exam)])).values()];
  const ended = compareDays(world.date, reference.calendar.year.to) > 0;
  const exam = exams.find((one) => one.id === chosen.exam) ?? exams.at(-1);
  const ofExam = rooms.filter((one) => one.exam.id === exam?.id);
  const grades = [...new Set(ofExam.map((one) => one.chart.grade))];
  const grade = grades.find((one) => one === chosen.grade) ?? grades[0];
  const rows = ofExam.filter((one) => one.chart.grade === grade);
  const open = rows.find((one) => one.chart.subject === chosen.subject) ?? rows[0];
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const row = (one: SchoolRoom) => {
    const { chart, state } = one;
    const item = itemNamer(t, chart, reference.packs);
    const every = everyReached(chart);
    const shown = { chart, state, mine: null };
    const over = examOver(chart, calendar, world.date);
    const where = over
      ? publishedText(t, shown, item)
      : lapsed(one, world.date, over)
        ? t('demo.schoolThreshold.lapsed')
        : stateText(t, shown, item, dayText);
    const named = subjectName(reference.profile, chart.subject);
    const subject = named === chart.subject ? isolate(named) : named;
    return (
      <View key={chart.subject} testID="schoolThreshold-row" style={[styles.card, one === open && chosenRow]}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {subject}
        </Text>
        {small(t('demo.schoolThreshold.setters', { count: chart.setters.length }))}
        {small(every === null ? t('demo.threshold.everyNone') : t('demo.threshold.every', { item: item(every) }))}
        <Text style={[styles.body, align]}>{where}</Text>
        {one === open ? (
          small(t('demo.schoolThreshold.shown'))
        ) : (
          <Button
            testID="schoolThreshold-open"
            variant="line"
            label={t('demo.schoolThreshold.open')}
            name={`${t('demo.schoolThreshold.open')}${t('chart.colon')}${subject}`}
            onPress={() => {
              setChosen({ exam: exam?.id, grade, subject: chart.subject });
              read.say(t('demo.schoolThreshold.opened', { subject }));
            }}
          />
        )}
      </View>
    );
  };
  return (
    <View testID="schoolThreshold" style={page}>
      <Text style={[styles.body, align]}>{t('demo.schoolThreshold.lead')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {read.deciding
          ? t('demo.schoolThreshold.signing')
          : read.said !== '' || !read.reading
            ? read.said
            : t('demo.schoolThreshold.reading')}
      </Text>
      {read.problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[problem, align]}>
            {t(read.problem)}
          </Text>
          <Button testID="schoolThreshold-again" variant="line" label={t('demo.weekSign.again')} onPress={read.again} />
        </View>
      )}
      {read.rooms?.length === 0 && (
        <Text style={[styles.body, align]}>
          {t(ended ? 'demo.schoolThreshold.ended' : 'demo.schoolThreshold.none')}
        </Text>
      )}
      {exams.length > 1 && (
        <ChipGroup
          testID="schoolThreshold-exams"
          label={t('demo.schoolThreshold.exam')}
          choices={exams.map((one) => ({
            value: one.id,
            label: `${examName(t, one.id)} · ${dayText(one.from)}`,
          }))}
          selected={exam?.id ?? null}
          onSelect={(id) => setChosen({ exam: id })}
        />
      )}
      {grades.length > 0 && (
        <ChipGroup
          testID="schoolThreshold-grades"
          label={t('demo.schoolThreshold.grade')}
          choices={grades.map((one) => {
            const named = gradeName(reference.profile, one);
            return { value: one, label: named === one ? isolate(named) : named };
          })}
          selected={grade ?? null}
          onSelect={(one) => setChosen({ exam: exam?.id, grade: one })}
        />
      )}
      {rows.map(row)}
      {open !== undefined && (
        <ThresholdRoomPanel
          room={open}
          date={world.date}
          dayText={dayText}
          reference={reference}
          updates={updates}
          busy={read.reading || read.deciding}
          onDecide={(item, done) => read.decide(open, item, done)}
        />
      )}
      {NOTES.map((key) => small(t(`demo.schoolThreshold.notes.${key}`), key))}
    </View>
  );
}
