// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What is published of a level's cuts (N-Published, #606, §7.10, R-5.10-12,
// R-7.10-14, R-7.10-15, R-7.10-21, R-7.10-22, R-7.10-25, R-7.10-27, answers 51,
// 539, 549 and 640), from the day after an exam's last day, nothing of it
// before: with the world's keys held it offers the level's exams that are over,
// the latest chosen at first, and their grades; it says the exam's days and any
// move with both dates and why; for each subject with a plan, the cut adopted
// and its day, or no cut, or that none was adopted and the paper was set as
// usual, the share of the classes that had reached the cut on the figures day,
// how it shaped the exam in the committee's own words, and the signatures of
// the seats that adopted it; and, for the subject chosen, the figures used
// (CommitteeFigures.tsx), no wilaya named. It says the safeguards, and what was
// not used. It reads as the room does (useCommittee.ts,
// use-committee-figures.ts), a problem said as an alert with a way to read
// again.

import {
  committeeSeats,
  compareDays,
  worldExams,
  type CalendarUpdate,
  type Day,
  type DemoSchool,
  type PlanPack,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import { colors, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { gradeName } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { termEndsBefore } from './committee-figures';
import { committeeRooms, type CommitteeRead } from './committee-session';
import { CommitteeFigures } from './CommitteeFigures';
import { gradeShown, shareOf } from './exam-totals';
import { examName, itemNamer, movedLines, movesOf } from './threshold-text';
import { thresholdStyles as styles } from './ThresholdFrame';
import { useCommitteeFigures, type LevelFigures } from './use-committee-figures';
import { useCommittee } from './useCommittee';

export type PublishedCutsProps = {
  readonly world: string;
  readonly date: Day;
  readonly level: 'directorate' | 'national';
  /** The directorate, or the nation, the committees are of (cuts.ts). */
  readonly scope: string;
  /** The world's keys and sealing key, held while it is open. */
  readonly held: HeldWorld | null;
  readonly reference: TermReference;
  /** The schools the committee covers, whose classes pin the plans. */
  readonly schools: readonly Pick<DemoSchool, 'classes'>[];
  /** The packs the classes pin. */
  readonly packs: readonly PlanPack[];
  /** A day's figures for the level, null when not added up. */
  readonly read: (day: Day) => Promise<LevelFigures | null>;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
};

const SAFEGUARDS = ['announced', 'after', 'unchecked'] as const;
const UNUSED = ['figures', 'plans', 'floors'] as const;
const page = { gap: spacing['space-12'] } as const;
const problem = { ...typography.body, color: colors['error-ink'] } as const;

/** The level's cuts of the exams that are over, each with its figures, its words and its signatures. */
export function PublishedCuts(props: PublishedCutsProps) {
  const { world, date, level, scope, held, reference, schools, packs, read, kit, send, dayText, updates } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [chosen, setChosen] = useState<{ exam?: string; grade?: string; subject?: string }>({});
  const { year, entries } = reference.calendar;
  const exams = useMemo(
    () => worldExams(year, entries).filter((one) => one.setBy === level && compareDays(date, one.to) > 0),
    [year, entries, level, date],
  );
  const exam = exams.find((one) => one.id === chosen.exam) ?? exams.at(-1);
  const grades = exam?.grades ?? [];
  const grade = grades.find((one) => one === chosen.grade) ?? grades[0];
  const planned =
    exam === undefined || grade === undefined ? [] : committeeRooms({ world, scope }, exam, grade, schools, packs);
  const votes = useCommittee(
    date,
    held,
    planned.map((one) => one.room),
    kit,
    send,
  );
  const open = planned.find((one) => one.subject === chosen.subject) ?? planned[0];
  const ends = exam === undefined ? [] : termEndsBefore(year, exam.figuresDay);
  const days = exam === undefined ? [] : [exam.figuresDay, ...ends];
  const figures = useCommitteeFigures(JSON.stringify([world, date, scope]), held === null ? [] : days, read);
  const moves = useMemo(() => movesOf(reference, updates), [reference, updates]);
  const shownProblem = votes.problem ?? figures.problem;
  const named = (name: string, code: string) => (name === code ? isolate(name) : name);
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const body = (words: string) => <Text style={[styles.body, align]}>{words}</Text>;
  const nameOf = (subject: string) => named(subjectName(reference.profile, subject), subject);
  const row = (one: (typeof planned)[number], shown: CommitteeRead | undefined) => {
    const { subject, plan, room } = one;
    const item = itemNamer(t, { pack: plan, items: room.items }, packs);
    const adopted = shown?.state.adopted ?? null;
    const figure = figures.figures?.[0];
    const grading = figure == null || grade === undefined ? undefined : gradeShown(figure, subject, grade);
    const share =
      typeof grading !== 'object' || adopted?.item == null || grading.classes === 0
        ? null
        : shareOf(grading, adopted.item);
    return (
      <View key={subject} testID={`published-${subject}`} style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {nameOf(subject)}
        </Text>
        {shown !== undefined &&
          body(
            adopted === null
              ? t('demo.published.noneAdopted')
              : adopted.item === null
                ? t('demo.published.noCut', { day: dayText(adopted.day) })
                : t('demo.published.cut', { item: item(adopted.item), day: dayText(adopted.day) }),
          )}
        {adopted?.item != null &&
          exam !== undefined &&
          figures.figures !== undefined &&
          small(
            share === null
              ? t('demo.published.shareHidden')
              : t('demo.published.share', { share, day: dayText(exam.figuresDay) }),
          )}
        {adopted?.item != null && body(shown?.words?.words ?? t('demo.committee.words.none'))}
        {[...(adopted?.seats ?? [])]
          .sort((one, other) => one - other)
          .map((seat) =>
            small(
              t('demo.published.signed', {
                seat: t('demo.committee.seat', { n: seat + 1 }),
                day: dayText(shown?.state.votes.get(seat)?.day ?? adopted.day),
              }),
              String(seat),
            ),
          )}
        {adopted !== null &&
          small(t('demo.published.majority', { adopted: adopted.seats.length, seats: committeeSeats({ scope }) }))}
      </View>
    );
  };
  return (
    <View testID="published" style={page}>
      <Text style={[styles.body, align]}>{t(`demo.published.level.${level}.lead`)}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {votes.reading || figures.reading ? t('demo.published.reading') : ''}
      </Text>
      {shownProblem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[problem, align]}>
            {t(shownProblem)}
          </Text>
          <Button
            testID="published-again"
            variant="line"
            label={t('demo.weekSign.again')}
            onPress={() => {
              votes.again();
              figures.again();
            }}
          />
        </View>
      )}
      {held === null && body(t('demo.committee.keys'))}
      {exams.length === 0 && body(t('demo.published.none'))}
      {exams.length > 1 && (
        <ChipGroup
          testID="published-exams"
          label={t('demo.schoolThreshold.exam')}
          choices={exams.map((one) => ({ value: one.id, label: `${examName(t, one.id)} · ${dayText(one.from)}` }))}
          selected={exam?.id ?? null}
          onSelect={(id) => setChosen({ exam: id })}
        />
      )}
      {grades.length > 1 && (
        <ChipGroup
          testID="published-grades"
          label={t('demo.schoolThreshold.grade')}
          choices={grades.map((one) => ({ value: one, label: named(gradeName(reference.profile, one), one) }))}
          selected={grade ?? null}
          onSelect={(one) => setChosen({ exam: exam?.id, grade: one })}
        />
      )}
      {exam !== undefined && (
        <>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.published.head', {
              exam: examName(t, exam.id),
              grade: grade === undefined ? '' : named(gradeName(reference.profile, grade), grade),
            })}
          </Text>
          {body(
            t('demo.published.dates', {
              figures: dayText(exam.figuresDay),
              from: dayText(exam.from),
              to: dayText(exam.to),
            }),
          )}
          {movedLines(t, moves.get(exam.id), exam, dayText, false, true).map((line, at) => small(line, `moved-${at}`))}
          {held !== null && votes.reads !== null && planned.map((one, at) => row(one, votes.reads?.[at]))}
          {held !== null && planned.length === 0 && body(t('demo.committee.noPlan'))}
          {held !== null && planned.length > 1 && (
            <ChipGroup
              testID="published-subjects"
              label={t('demo.committee.subject')}
              choices={planned.map(({ subject }) => ({ value: subject, label: nameOf(subject) }))}
              selected={open?.subject ?? null}
              onSelect={(one) => setChosen({ exam: exam.id, grade, subject: one })}
            />
          )}
          {held !== null && open !== undefined && grade !== undefined && (
            <View testID="published-figures" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {nameOf(open.subject)}
              </Text>
              <CommitteeFigures
                testID="published"
                level={level}
                subject={open.subject}
                grade={grade}
                items={open.room.items}
                item={itemNamer(t, { pack: open.plan, items: open.room.items }, packs)}
                day={dayText(exam.figuresDay)}
                dayText={dayText}
                figures={figures.figures === undefined ? undefined : (figures.figures[0] ?? null)}
                ends={ends.map((day, at) => ({ day, figures: figures.figures?.[at + 1] ?? null }))}
              />
            </View>
          )}
          {SAFEGUARDS.map((key) =>
            small(t(`demo.published.safeguards.${key}`, { figures: dayText(exam.figuresDay) }), key),
          )}
          {UNUSED.map((key) => small(t(`demo.published.unused.${key}`), key))}
          {small(t(`demo.published.level.${level}.ranking`))}
          {small(t(`demo.committee.level.${level}.floors`))}
        </>
      )}
    </View>
  );
}
