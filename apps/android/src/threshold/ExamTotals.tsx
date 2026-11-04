// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate exam's totals on the teacher's phone (#602, T-Threshold-totals,
// §7.10, R-3.3-35, R-7.10-02, R-7.10-13, answers 628, 634 and 635), opened from
// its card on the exams list from its figures day: as it opens it reads the
// weeks the phone signed (useTeacherRooms.ts), to work out the exam's chart for
// the teacher's classes of the subject and grade (exam-totals.ts), and the
// directorate's totals for the figures day (use-exam-totals.ts); it shows the
// exam, its figures day and first day, and a move of its days with when it was
// announced and why, then the directorate's teachers, classes and schools in
// that subject and grade, and the share of the classes that reached each item
// of the teacher's plan, with the table of the same figures (ChartFigure.tsx),
// a hidden item said as held back; or that they are not added up yet, or hidden
// under the floors. Under it come the teacher's own classes and the item each
// reached on the figures day, worked out on the phone alone and never put on
// the server's figures. It says there is no cut before the exam, the floors,
// and that nothing here ranks anyone. A problem reading the weeks or the totals
// is said, in the page's live region too, with a way to read again what failed;
// weeks that do not read and an exam no longer on the teacher's list or before
// its figures day each say so, and nothing more shows while the world's school
// or reference is not there, as on the exams list. Going back leads to the
// exams list.

import { compareDays, type CalendarUpdate, type Day, type DemoSchool, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import { ChartFigure } from '../drawing/ChartFigure';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { gradeShown, totalsExam, totalsSpec } from './exam-totals';
import { headText, itemNamer, movedLines, movesOf } from './threshold-text';
import { ThresholdFrame, thresholdStyles as styles } from './ThresholdFrame';
import { useExamTotals } from './use-exam-totals';
import { useTeacherRooms } from './useTeacherRooms';

export type ExamTotalsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly date: string;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's reference, which names the subjects, grades and plan items. */
  readonly reference?: TermReference;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
  /** The world's school, whose directorate adds the totals up and whose classes sit the exam. */
  readonly school?: DemoSchool | null;
  /** The exam, subject and grade's key (threshold-text.ts). */
  readonly room: string;
  /** Back to the exams list. */
  readonly onClose: () => void;
  readonly said: string;
};

const NOTES = ['noCut', 'floors', 'server', 'never'] as const;

/** A directorate exam's totals for the teacher's subject and grade, and the teacher's own classes under them. */
export function ExamTotals(props: ExamTotalsProps) {
  const { world, date, join, kit, send, dayText, reference, updates, school, room, onClose, said } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const read = useTeacherRooms(world, join, kit, send, said, 'examTotals', true);
  const { weeks } = read;
  const found = useMemo(
    () =>
      weeks === null || reference === undefined || school == null
        ? undefined
        : totalsExam(weeks, school, reference, world.date, room),
    [weeks, school, reference, world.date, room],
  );
  const reached = found !== undefined && compareDays(world.date, found.exam.figuresDay) >= 0;
  const totals = useExamTotals(
    world,
    reached ? found.exam.figuresDay : null,
    reached ? (school?.directorateId ?? null) : null,
    send,
  );
  const moves = useMemo(() => movesOf(reference, updates), [reference, updates]);
  const announce = useEffectEvent((problem: NonNullable<typeof totals.problem>) => read.say(t(problem)));
  useEffect(() => {
    if (totals.problem !== null) announce(totals.problem);
  }, [totals.problem]);
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const lone = (key: 'demo.examTotals.ownFailed' | 'demo.examTotals.gone') => (
    <Text style={[styles.body, align]}>{t(key)}</Text>
  );
  const page = () => {
    if (reference === undefined || school == null) return null;
    if (weeks === null) return lone('demo.examTotals.ownFailed');
    if (!reached) return lone('demo.examTotals.gone');
    const { exam, chart } = found;
    const item = itemNamer(t, chart, reference?.packs);
    const day = dayText(exam.figuresDay);
    const shown = totals.figures === undefined ? undefined : gradeShown(totals.figures, chart.subject, chart.grade);
    return (
      <>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {headText(t, chart, reference)}
        </Text>
        <Text style={[styles.body, align]}>
          {t('demo.examTotals.days', { figures: day, from: dayText(exam.from) })}
        </Text>
        {movedLines(t, moves.get(exam.id), exam, dayText).map((line, at) => small(line, `moved-${at}`))}
        {typeof shown === 'string' && <Text style={[styles.body, align]}>{t(`demo.examTotals.${shown}`)}</Text>}
        {typeof shown === 'object' && (
          <>
            {small(
              t('demo.examTotals.counts', { teachers: shown.teachers, classes: shown.classes, schools: shown.schools }),
            )}
            <ChartFigure
              testID="examTotals-chart"
              spec={totalsSpec(t, shown, chart.items, item, day)}
              categoryLabel={t('demo.examTotals.item')}
            />
          </>
        )}
        <View testID="examTotals-mine" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.examTotals.mine', { day })}
          </Text>
          {chart.classes.map((one, at) =>
            small(t('demo.examTotals.mineLine', { class: isolate(one.name), reached: item(one.position) }), String(at)),
          )}
          {small(t('demo.examTotals.mineNote'))}
        </View>
      </>
    );
  };
  return (
    <ThresholdFrame
      testID="examTotals"
      date={date}
      join={join}
      title={t('demo.examTotals.title')}
      region={read.region}
      reading={read.reading || totals.reading}
      problem={read.problem ?? totals.problem}
      onAgain={read.problem === null ? totals.again : read.again}
      onClose={onClose}
    >
      {read.rooms !== null && page()}
      {NOTES.map((key) => small(t(`demo.examTotals.notes.${key}`), key))}
    </ThresholdFrame>
  );
}
