// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school exam's threshold on the teacher's phone (#601, T-Threshold and
// T-Threshold-propose, §7.10, R-3.3-34 to R-3.3-38, R-7.10-02 to R-7.10-04,
// answers 582, 632 and 633), opened from the exams list: as it opens it reads
// the rooms again (useTeacherRooms.ts) and shows the one opened, or says it is
// no longer handed to the phone; its chart's figures day and signing deadline
// and the exam's first day as it now is, and a move of its days, with when it
// was announced and why, and that its chart was taken on a figures day the exam
// no longer has; the chart of each class's item reached on the figures day and
// its forecast, with the table of the same figures (ChartFigure.tsx), the item
// every class reached, and that the director and the setters see the same; then
// where the cut stands and each setter's latest cut, each with its day. A
// setter the chart names may, until the deadline or the director's decision,
// sign the proposed cut while it waits for them, propose another, chosen from
// the plan's items, or sign no cut, none of which can be pressed while the
// rooms are read or a cut signed, each signed with the phone's key, the
// fingerprint or PIN named and not asked in a world (answer 582), then said,
// and the rooms read again; a phone the chart does not name, or past the
// deadline or the decision, sees why it has no choice. The page says that a cut
// is optional, that only the setters and the director see it before the exam,
// that it is published after it with its figures, that monthly tests stay each
// teacher's own, and that nothing here serves to evaluate or rank anyone. Going
// back leads to the exams list.

import { compareDays, type CalendarUpdate, type Day, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import { ChartFigure } from '../drawing/ChartFigure';
import { useDeviceText } from '../text/device-text';
import { signCut, type TeacherRoom } from './teacher-rooms';
import {
  awaitingMine,
  chartSpec,
  everyReached,
  examsOf,
  headText,
  itemNamer,
  movedExam,
  movesOf,
  roomId,
  roomMoves,
  setterLines,
  stateText,
} from './threshold-text';
import { ThresholdFrame, thresholdStyles as styles } from './ThresholdFrame';
import { useTeacherRooms } from './useTeacherRooms';

export type ExamThresholdProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly date: string;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's reference, which names the plan items. */
  readonly reference?: TermReference;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
  /** The room's key (threshold-text.ts). */
  readonly room: string;
  /** Back to the exams list. */
  readonly onClose: () => void;
  readonly said: string;
};

const NOTES = ['optional', 'earliest', 'seen', 'published', 'monthly', 'never'] as const;

/** One school exam's chart, where its cut stands, and the setter's choices. */
export function ExamThreshold(props: ExamThresholdProps) {
  const { world, date, join, kit, send, dayText, reference, updates, room, onClose, said } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const read = useTeacherRooms(world, join, kit, send, said, 'threshold');
  const moves = useMemo(() => movesOf(reference, updates), [reference, updates]);
  const exams = useMemo(() => examsOf(reference), [reference]);
  const busy = read.reading;
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const one = read.rooms?.find((each) => roomId(each.room) === room);
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const choices = (shown: TeacherRoom, item: (id: string | null) => string) => {
    const { chart, state, mine } = shown;
    if (mine === null) return small(t('demo.threshold.notSetter'));
    const open = compareDays(world.date, chart.signBy) <= 0 && state.settled?.by !== 'director';
    if (!open) return small(t('demo.threshold.closed'));
    const sign = (cut: string | null, done: string) => {
      setPicking(false);
      setChosen(null);
      read.sign(() => signCut(world, join, shown, cut, kit, send), done);
    };
    const { proposed } = state;
    if (picking) {
      return (
        <View testID="threshold-pick" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.threshold.pick')}
          </Text>
          {chart.items.map((each) => (
            <OptionRow
              key={each}
              testID="threshold-item"
              label={item(each)}
              selected={chosen === each}
              disabled={busy}
              onPress={() => setChosen(each)}
            />
          ))}
          {small(t('demo.weekSign.signNote'))}
          <Button
            testID="threshold-propose-sign"
            label={t('demo.threshold.proposeSign')}
            disabled={busy || chosen === null}
            onPress={() => sign(chosen, t('demo.threshold.done', { item: item(chosen) }))}
          />
          <Button
            testID="threshold-pick-back"
            variant="plain"
            label={t('demo.entry.back')}
            onPress={() => {
              setPicking(false);
              setChosen(null);
            }}
          />
        </View>
      );
    }
    const awaiting = awaitingMine(shown) && proposed !== null;
    return (
      <View style={styles.card}>
        {awaiting && (
          <Button
            testID="threshold-sign"
            disabled={busy}
            label={t('demo.threshold.sign', { item: item(proposed.item) })}
            onPress={() => sign(proposed.item, t('demo.threshold.done', { item: item(proposed.item) }))}
          />
        )}
        <Button
          testID="threshold-propose"
          {...(awaiting ? { variant: 'line' as const } : {})}
          disabled={busy}
          label={t(proposed === null ? 'demo.threshold.propose' : 'demo.threshold.proposeOther')}
          onPress={() => setPicking(true)}
        />
        <Button
          testID="threshold-none"
          variant="plain"
          disabled={busy}
          label={t('demo.threshold.noCut')}
          onPress={() => sign(null, t('demo.threshold.noneDone'))}
        />
        {small(t('demo.weekSign.signNote'))}
      </View>
    );
  };
  const page = (shown: TeacherRoom) => {
    const { chart } = shown;
    const item = itemNamer(t, chart, reference?.packs);
    const every = everyReached(chart);
    return (
      <>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {headText(t, chart, reference)}
        </Text>
        <Text style={[styles.body, align]}>
          {t('demo.threshold.dates', {
            figures: dayText(chart.figuresDay),
            signBy: dayText(chart.signBy),
            from: dayText(movedExam(chart, moves, exams)?.from ?? chart.from),
          })}
        </Text>
        {roomMoves(t, chart, moves, exams, dayText).map((line, at) => small(line, `moved-${at}`))}
        <ChartFigure
          testID="threshold-chart"
          spec={chartSpec(t, chart, dayText(chart.figuresDay))}
          categoryLabel={t('demo.threshold.class')}
        />
        {small(every === null ? t('demo.threshold.everyNone') : t('demo.threshold.every', { item: item(every) }))}
        {small(t('demo.threshold.forecastLine', { day: dayText(chart.forecastDay) }))}
        {small(t('demo.threshold.sameView'))}
        <View testID="threshold-cut" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.threshold.cut')}
          </Text>
          <Text style={[styles.body, align]}>{stateText(t, shown, item, dayText)}</Text>
          {setterLines(t, shown, item, dayText).map(({ key, line }) => small(line, key))}
        </View>
        {choices(shown, item)}
      </>
    );
  };
  return (
    <ThresholdFrame
      testID="threshold"
      date={date}
      join={join}
      title={t('demo.threshold.title')}
      region={read.region}
      reading={read.reading}
      problem={read.problem}
      onAgain={read.again}
      onClose={onClose}
    >
      {read.rooms !== null && one === undefined && <Text style={[styles.body, align]}>{t('demo.threshold.gone')}</Text>}
      {one !== undefined && page(one)}
      {NOTES.map((key) => small(t(`demo.threshold.roomNotes.${key}`), key))}
    </ThresholdFrame>
  );
}
