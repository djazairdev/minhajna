// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's page on the workspace's PC (M-Threshold, #604, §7.10, answers
// 25, 31, 33, 36, 50, 51, 628, 631 and 638), for a level's exams above the
// school: with the world's keys held, it offers the exams of that level whose
// figures day the world's date has reached, the latest chosen at first, then
// their grades and each grade's subjects with a plan, never in any order of
// progress, and opens the room chosen (CommitteePanel.tsx), reading its votes
// (useCommittee.ts) and its totals (use-committee-figures.ts) as it opens, when
// the world's date moves and when asked again. Its live line says while it
// reads or signs and what was signed; a problem is said as an alert, with a way
// to read again. It says when no figures day has come, when the keys are not
// held, and when a grade has no plan; and that the system never sets a cut,
// that the figures are unchecked, the floors, and that nothing here ranks
// anyone.

import {
  committeeSeats,
  compareDays,
  worldExams,
  type CalendarUpdate,
  type Day,
  type DemoSchool,
  type PlanPack,
  type WorldExam,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { HeldWorld } from '../demo/world-calendar-read';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import type { DirectorateFigures } from '../directorate/totals-read';
import { colors, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { gradeName } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { committeePlan, committeeSubjects, type CommitteeRoom } from './committee-session';
import { termEndsBefore } from './committee-figures';
import { CommitteePanel } from './CommitteePanel';
import { examName, headText, itemNamer, movesOf } from './threshold-text';
import { thresholdStyles as styles } from './ThresholdFrame';
import { useCommitteeFigures } from './use-committee-figures';
import { useCommittee } from './useCommittee';

export type CommitteePageProps = {
  readonly world: string;
  readonly date: Day;
  readonly level: WorldExam['setBy'];
  /** The directorate, or the nation, the committees are of (cuts.ts). */
  readonly scope: string;
  /** The world's keys and sealing key, held while it is open. */
  readonly held: HeldWorld | null;
  readonly reference: TermReference;
  /** The schools the committee covers, whose classes pin the plans. */
  readonly schools: readonly Pick<DemoSchool, 'classes'>[];
  /** The packs the classes pin. */
  readonly packs: readonly PlanPack[];
  /** The page's first line. */
  readonly lead: string;
  /** A day's figures for the level, null when not added up. */
  readonly read: (day: Day) => Promise<DirectorateFigures | null>;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
};

const NOTES = ['never', 'termEnds', 'floors', 'unchecked', 'rank'] as const;
const page = { gap: spacing['space-12'] } as const;
const problem = { ...typography.body, color: colors['error-ink'] } as const;

/** The level's exams by grade and subject, and the committee's room of the subject chosen. */
export function CommitteePage(props: CommitteePageProps) {
  const { world, date, level, scope, held, reference, schools, packs, lead, read, kit, send, dayText, updates } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [chosen, setChosen] = useState<{ exam?: string; grade?: string; subject?: string }>({});
  const { year, entries } = reference.calendar;
  const exams = useMemo(
    () => worldExams(year, entries).filter((one) => one.setBy === level && compareDays(date, one.figuresDay) >= 0),
    [year, entries, level, date],
  );
  const exam = exams.find((one) => one.id === chosen.exam) ?? exams.at(-1);
  const grades = exam?.grades ?? [];
  const grade = grades.find((one) => one === chosen.grade) ?? grades[0];
  const subjects = grade === undefined ? [] : committeeSubjects(schools, packs, grade);
  const subject = subjects.find((one) => one === chosen.subject) ?? subjects[0];
  const plan = grade === undefined || subject === undefined ? null : committeePlan(schools, packs, grade, subject);
  const items = plan?.items.map((one) => one.id) ?? [];
  const room: CommitteeRoom | null =
    exam === undefined || grade === undefined || subject === undefined || plan === null
      ? null
      : {
          name: { world, scope, exam: exam.id, subject, grade },
          items,
          days: { from: exam.figuresDay, to: exam.signBy },
        };
  const votes = useCommittee(date, held, room, kit, send);
  const ends = exam === undefined ? [] : termEndsBefore(year, exam.figuresDay);
  const days = exam === undefined ? [] : [exam.figuresDay, ...ends];
  const figures = useCommitteeFigures(JSON.stringify([world, date, scope]), held === null ? [] : days, read);
  const moves = useMemo(() => movesOf(reference, updates), [reference, updates]);
  const shownProblem = votes.problem ?? figures.problem;
  const named = (name: string, code: string) => (name === code ? isolate(name) : name);
  const reading = votes.reading || figures.reading;
  return (
    <View testID="committee" style={page}>
      <Text style={[styles.body, align]}>{lead}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {votes.voting
          ? t('demo.committee.signing')
          : votes.said !== '' || !reading
            ? votes.said
            : t('demo.committee.reading')}
      </Text>
      {shownProblem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[problem, align]}>
            {t(shownProblem)}
          </Text>
          <Button
            testID="committee-again"
            variant="line"
            label={t('demo.weekSign.again')}
            onPress={() => {
              votes.again();
              figures.again();
            }}
          />
        </View>
      )}
      {held === null && <Text style={[styles.body, align]}>{t('demo.committee.keys')}</Text>}
      {exams.length === 0 && <Text style={[styles.body, align]}>{t('demo.committee.none')}</Text>}
      {exams.length > 1 && (
        <ChipGroup
          testID="committee-exams"
          label={t('demo.schoolThreshold.exam')}
          choices={exams.map((one) => ({ value: one.id, label: `${examName(t, one.id)} · ${dayText(one.from)}` }))}
          selected={exam?.id ?? null}
          onSelect={(id) => setChosen({ exam: id })}
        />
      )}
      {grades.length > 1 && (
        <ChipGroup
          testID="committee-grades"
          label={t('demo.schoolThreshold.grade')}
          choices={grades.map((one) => ({ value: one, label: named(gradeName(reference.profile, one), one) }))}
          selected={grade ?? null}
          onSelect={(one) => setChosen({ exam: exam?.id, grade: one })}
        />
      )}
      {subjects.length > 0 && (
        <ChipGroup
          testID="committee-subjects"
          label={t('demo.committee.subject')}
          choices={subjects.map((one) => ({ value: one, label: named(subjectName(reference.profile, one), one) }))}
          selected={subject ?? null}
          onSelect={(one) => setChosen({ exam: exam?.id, grade, subject: one })}
        />
      )}
      {exam !== undefined && subjects.length === 0 && (
        <Text style={[styles.body, align]}>{t('demo.committee.noPlan')}</Text>
      )}
      {exam !== undefined && grade !== undefined && subject !== undefined && plan !== null && held !== null && (
        <CommitteePanel
          key={JSON.stringify(room)}
          exam={exam}
          head={headText(t, { exam: exam.id, subject, grade }, reference)}
          subject={subject}
          grade={grade}
          items={items}
          seats={committeeSeats({ scope })}
          item={itemNamer(t, { pack: plan, items }, packs)}
          date={date}
          dayText={dayText}
          move={moves.get(exam.id)}
          figures={figures.figures === undefined ? undefined : (figures.figures[0] ?? null)}
          ends={ends.map((day, at) => ({ day, figures: figures.figures?.[at + 1] ?? null }))}
          state={votes.state}
          busy={reading || votes.voting}
          onVote={votes.vote}
        />
      )}
      {NOTES.map((key) => (
        <Text key={key} style={[styles.small, align]}>
          {t(`demo.committee.notes.${key}`)}
        </Text>
      ))}
    </View>
  );
}
