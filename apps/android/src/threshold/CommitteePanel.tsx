// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's room on the workspace's PC (M-Threshold, N-Threshold, #604,
// #605, #606, §7.10, R-7.9-04, R-7.10-13, R-7.10-14, R-7.10-16 to R-7.10-18,
// R-7.10-20, R-7.10-21, R-7.10-24, R-7.10-25, answers 51, 549, 631, 638 to
// 640): the exam, subject and grade, whose committee this page plays, its
// figures day, signing deadline and first day, when and why it moved, and its
// figures (CommitteeFigures.tsx). Under them, where the cut stands, each seat's
// vote and day, how many seats adopt a cut, a seat's choices while the room is
// open (CommitteeChoices.tsx), after the exam the committee's words on how an
// adopted cut shaped it (CommitteeWordsForm.tsx), and, unless no cut stands,
// who sees the cut now and when it is published with its figures.

import {
  compareDays,
  type CommitteeState,
  type CommitteeWords,
  type Day,
  type ExamMove,
  type WorldExam,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { useDeviceText } from '../text/device-text';
import { CommitteeChoices } from './CommitteeChoices';
import { CommitteeFigures } from './CommitteeFigures';
import { CommitteeWordsForm } from './CommitteeWordsForm';
import { movedLines } from './threshold-text';
import { thresholdStyles as styles } from './ThresholdFrame';
import type { LevelFigures } from './use-committee-figures';

export type CommitteePanelProps = {
  readonly exam: WorldExam;
  /** The room's heading. */
  readonly head: string;
  /** The subject's name, for the committee it names. */
  readonly subjectWords: string;
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
  readonly figures: LevelFigures | null | undefined;
  /** The term ends' figures, each with its day. */
  readonly ends: readonly { readonly day: Day; readonly figures: LevelFigures | null }[];
  /** Whose committee this is, which words the page uses for who sees the cut. */
  readonly level: 'directorate' | 'national';
  /** Where the committee stands, null while it is first read. */
  readonly state: CommitteeState | null;
  /** The words on how its cut shaped the exam that count, if any. */
  readonly words: CommitteeWords | null;
  /** Signs a seat's words, saying `done` once signed. */
  readonly onWrite: (seat: number, words: string, done: string) => void;
  readonly busy: boolean;
  /** Signs a seat's vote, an item or null for no cut, saying `done` once signed. */
  readonly onVote: (seat: number, item: string | null, done: string) => void;
};

/** A committee's figures, votes and choices, and after the exam its words on how an adopted cut shaped it. */
export function CommitteePanel(props: CommitteePanelProps) {
  const { exam, head, subject, grade, items, seats, item, date, dayText, move, figures, ends, state } = props;
  const { busy, onVote, level, subjectWords, words: written, onWrite } = props;
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
  const open = compareDays(date, exam.figuresDay) >= 0 && compareDays(date, exam.signBy) <= 0;
  const over = compareDays(date, exam.to) > 0;
  const noCut =
    state?.adopted?.item === null || (state !== null && state.adopted === null && compareDays(date, exam.signBy) > 0);
  const standing = () => {
    if (state === null) return null;
    const { adopted, proposed } = state;
    if (adopted !== null) {
      const by = { count: adopted.seats.length, seats, day: dayText(adopted.day) };
      return adopted.item === null
        ? t('demo.committee.state.adoptedNone', by)
        : t('demo.committee.state.adopted', { ...by, item: item(adopted.item) });
    }
    if (compareDays(date, exam.signBy) > 0) return t('demo.committee.state.lapsed');
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
  return (
    <View testID="committee-room" style={styles.card}>
      {heading(head)}
      {small(t(`demo.committee.level.${level}.viewer`, { subject: subjectWords }))}
      {body(t('demo.committee.dates', { figures: day, signBy: dayText(exam.signBy), from: dayText(exam.from) }))}
      {movedLines(t, move, exam, dayText).map((line, at) => small(line, `moved-${at}`))}
      <CommitteeFigures
        testID="committee"
        level={level}
        subject={subject}
        grade={grade}
        items={items}
        item={item}
        day={day}
        dayText={dayText}
        figures={figures}
        ends={ends}
      />
      {heading(t('demo.committee.cut'))}
      {state !== null && body(standing() ?? '')}
      {Array.from({ length: seats }, (_, seat) => seatLine(seat))}
      {small(t('demo.committee.majority', { majority: Math.floor(seats / 2) + 1, seats }))}
      {open && state !== null && state.adopted === null && (
        <CommitteeChoices seats={seats} state={state} items={items} item={item} busy={busy} onVote={onVote} />
      )}
      {over && state?.adopted != null && state.adopted.item !== null && (
        <CommitteeWordsForm seats={state.adopted.seats} words={written} busy={busy} onWrite={onWrite} />
      )}
      {state !== null && !noCut && !over && small(t(`demo.committee.level.${level}.sees`))}
      {state !== null &&
        !noCut &&
        small(
          t(over ? `demo.committee.level.${level}.published` : 'demo.committee.publishes', {
            to: dayText(exam.to),
            figures: day,
          }),
        )}
    </View>
  );
}
