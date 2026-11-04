// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's room on the workspace's PC (M-Threshold, #604, §7.10, R-7.9-04,
// R-7.10-13, R-7.10-16 to R-7.10-18, R-7.10-20, R-7.10-24, answers 51, 631 and
// 638): the exam, subject and grade, its figures day, signing deadline and
// first day, and when and why it moved; the classes, teachers and schools the
// totals cover and the share of the classes that reached each item of the plan
// on the figures day, with the last two term ends shown as comparison only and
// the table of the same figures, a figure held back under the floors; or that
// the figures are not added up or are hidden; the last item every class, nine
// classes in ten and half of them reached; and the sessions lost to closures.
// Under them, where the cut stands, each seat's vote and day, how many seats
// adopt a cut, a seat's choices while the room is open (CommitteeChoices.tsx),
// who sees the cut now and when it is published with its figures.

import { compareDays, type CommitteeState, type Day, type ExamMove, type WorldExam } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import type { DirectorateFigures } from '../directorate/totals-read';
import { ChartFigure } from '../drawing/ChartFigure';
import { useDeviceText } from '../text/device-text';
import { CommitteeChoices } from './CommitteeChoices';
import { committeeSpec, gradeMarks } from './committee-figures';
import { gradeShown } from './exam-totals';
import { movedLines } from './threshold-text';
import { thresholdStyles as styles } from './ThresholdFrame';

export type CommitteePanelProps = {
  readonly exam: WorldExam;
  /** The room's heading. */
  readonly head: string;
  readonly subject: string;
  readonly grade: string;
  readonly items: readonly string[];
  /** How many seats the committee has. */
  readonly seats: number;
  /** A plan item's name, quoted, or that there is none. */
  readonly item: (id: string | null) => string;
  readonly date: Day;
  readonly dayText: (day: Day) => string;
  /** The exam's move in the world's calendar, if an update moved it. */
  readonly move: ExamMove | undefined;
  /** The figures day's figures: null when not added up, undefined while read or after a problem. */
  readonly figures: DirectorateFigures | null | undefined;
  /** The term ends' figures, each with its day. */
  readonly ends: readonly { readonly day: Day; readonly figures: DirectorateFigures | null }[];
  /** Where the committee stands, null while it is first read. */
  readonly state: CommitteeState | null;
  readonly busy: boolean;
  /** Signs a seat's vote, an item or null for no cut, saying `done` once signed. */
  readonly onVote: (seat: number, item: string | null, done: string) => void;
};

/** A committee's figures, votes and choices. */
export function CommitteePanel(props: CommitteePanelProps) {
  const { exam, head, subject, grade, items, seats, item, date, dayText, move, figures, ends, state } = props;
  const { busy, onVote } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const body = (words: string) => <Text style={[styles.body, align]}>{words}</Text>;
  const heading = (words: string) => (
    <Text accessibilityRole="header" style={[styles.head, align]}>
      {words}
    </Text>
  );
  const day = dayText(exam.figuresDay);
  const shown = figures === undefined ? undefined : gradeShown(figures, subject, grade);
  const closures = figures?.subjects.find(([code]) => code === subject)?.[1]?.closed;
  const open = compareDays(date, exam.figuresDay) >= 0 && compareDays(date, exam.signBy) <= 0;
  const over = compareDays(date, exam.to) > 0;
  const standing = () => {
    if (state === null) return null;
    const { adopted, proposed } = state;
    if (adopted !== null) {
      const by = { count: adopted.seats.length, seats, day: dayText(adopted.day) };
      return adopted.item === null
        ? t('demo.committee.state.adoptedNone', by)
        : t('demo.committee.state.adopted', { ...by, item: item(adopted.item) });
    }
    if (!open && compareDays(date, exam.signBy) > 0) return t('demo.committee.state.lapsed');
    if (proposed === null) return t('demo.threshold.state.none');
    return t('demo.committee.state.proposed', { item: item(proposed.item), count: proposed.seats.length, seats });
  };
  const seatLine = (seat: number) => {
    const name = t('demo.committee.seat', { n: seat + 1 });
    const vote = state?.votes.get(seat);
    if (vote === undefined) return small(t('demo.threshold.setter.waiting', { name }), String(seat));
    const when = dayText(vote.day);
    return small(
      vote.item === null
        ? t('demo.threshold.setter.none', { name, day: when })
        : t('demo.threshold.setter.cut', { name, item: item(vote.item), day: when }),
      String(seat),
    );
  };
  const marks = (figure: Parameters<typeof gradeMarks>[0]) => {
    const { every, ninety, half } = gradeMarks(figure, items);
    return (
      <>
        {small(
          every === null ? t('demo.committee.marks.everyNone') : t('demo.committee.marks.every', { item: item(every) }),
        )}
        {ninety !== null && small(t('demo.committee.marks.ninety', { item: item(ninety) }))}
        {half !== null && small(t('demo.committee.marks.half', { item: item(half) }))}
      </>
    );
  };
  const compared = ends.flatMap((end) => {
    const figure = end.figures === null ? 'notYet' : gradeShown(end.figures, subject, grade);
    return typeof figure === 'object' ? [{ grade: figure, day: dayText(end.day) }] : [];
  });
  return (
    <View testID="committee-room" style={styles.card}>
      {heading(head)}
      {body(t('demo.committee.dates', { figures: day, signBy: dayText(exam.signBy), from: dayText(exam.from) }))}
      {movedLines(t, move, exam, dayText).map((line, at) => small(line, `moved-${at}`))}
      {typeof shown === 'string' && body(t(`demo.committee.${shown}`))}
      {typeof shown === 'object' && (
        <>
          {small(
            t('demo.committee.counts', { teachers: shown.teachers, classes: shown.classes, schools: shown.schools }),
          )}
          <ChartFigure
            testID="committee-chart"
            spec={committeeSpec(t, { grade: shown, day }, compared, items, item)}
            categoryLabel={t('demo.examTotals.item')}
          />
          {marks(shown)}
        </>
      )}
      {closures !== undefined && small(t('demo.committee.closures', { count: closures }))}
      {heading(t('demo.committee.cut'))}
      {state !== null && body(standing() ?? '')}
      {Array.from({ length: seats }, (_, seat) => seatLine(seat))}
      {small(t('demo.committee.majority', { majority: Math.floor(seats / 2) + 1, seats }))}
      {open && state !== null && state.adopted === null && (
        <CommitteeChoices seats={seats} state={state} items={items} item={item} busy={busy} onVote={onVote} />
      )}
      {!over && small(t('demo.committee.sees'))}
      {small(t(over ? 'demo.committee.published' : 'demo.committee.publishes', { to: dayText(exam.to), figures: day }))}
    </View>
  );
}
