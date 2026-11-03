// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One subject's room on D-Threshold (#603, answers 636 and 637), as its setters
// see it: its heading; the day its figures were taken, the day its cut is
// signed by, which is left out once the exam is over, and the day its exam
// begins on as the calendar now has it, with when and why the exam moved;
// after the exam, that the cut was published to every teacher of the subject
// at the grade with the figures of its figures day; the chart of each class's
// item reached on the figures day and its forecast, with the table of the same
// figures (ChartFigure.tsx) and the item every class reached; where its cut
// stands, or after the exam the cut as published (published-text.ts), with
// each setter's latest cut and day; while the decision is the director's,
// before the exam's first day as the chart has it and while the exam is not
// over, why and until when, with the two choices, the cut proposed when there
// is one and no cut, which cannot be pressed while the rooms are read or a
// decision is signed; once that day came with the decision left untaken, that
// it closed and no cut applies; and before the exam, who sees the cut, when it
// applies and when it will be published.

import { addDays, type CalendarUpdate, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChartFigure } from '../drawing/ChartFigure';
import { useDeviceText } from '../text/device-text';
import { examOver, publishedText } from '../threshold/published-text';
import { lapsed, mayDecide, type SchoolRoom } from '../threshold/school-rooms';
import {
  chartSpec,
  everyReached,
  examsOf,
  headText,
  itemNamer,
  movedExam,
  movesOf,
  roomMoves,
  setterLines,
  stateText,
} from '../threshold/threshold-text';
import { thresholdStyles as styles } from '../threshold/ThresholdFrame';
import type { TermReference } from './seeded-fill';

export type ThresholdRoomPanelProps = {
  readonly room: SchoolRoom;
  readonly date: Day;
  readonly dayText: (day: Day) => string;
  readonly reference: TermReference;
  /** The world's calendar updates, which say when and why an exam moved. */
  readonly updates?: readonly CalendarUpdate[];
  readonly busy: boolean;
  /** Signs the director's decision, an item or null for no cut, saying `done` once signed. */
  readonly onDecide: (item: string | null, done: string) => void;
};

/** A subject's chart, cut and setters, and the director's decision while it is theirs. */
export function ThresholdRoomPanel(props: ThresholdRoomPanelProps) {
  const { room, date, dayText, reference, updates, busy, onDecide } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { chart, state } = room;
  const item = itemNamer(t, chart, reference.packs);
  const every = everyReached(chart);
  const moves = useMemo(() => movesOf(reference, updates), [reference, updates]);
  const exams = useMemo(() => examsOf(reference), [reference]);
  const over = examOver(chart, exams, date);
  const lastDay = (exams.get(chart.exam) ?? room.exam).to;
  const shown = { chart, state, mine: null };
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const { proposed } = state;
  return (
    <View testID="schoolThreshold-room" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {headText(t, chart, reference)}
      </Text>
      <Text style={[styles.body, align]}>
        {t(over ? 'demo.threshold.after.dates' : 'demo.threshold.dates', {
          figures: dayText(chart.figuresDay),
          signBy: dayText(chart.signBy),
          from: dayText(movedExam(chart, moves, exams)?.from ?? chart.from),
        })}
      </Text>
      {roomMoves(t, chart, moves, exams, dayText).map((line, at) => small(line, `moved-${at}`))}
      {over && (
        <Text style={[styles.body, align]}>
          {t('demo.threshold.after.lead', { figures: dayText(chart.figuresDay) })}
        </Text>
      )}
      <ChartFigure
        testID="schoolThreshold-chart"
        spec={chartSpec(t, chart, dayText(chart.figuresDay))}
        categoryLabel={t('demo.threshold.class')}
      />
      {small(every === null ? t('demo.threshold.everyNone') : t('demo.threshold.every', { item: item(every) }))}
      {small(t('demo.threshold.forecastLine', { day: dayText(chart.forecastDay) }))}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t(over ? 'demo.threshold.after.cut' : 'demo.threshold.cut')}
      </Text>
      <Text style={[styles.body, align]}>
        {over ? publishedText(t, shown, item) : stateText(t, shown, item, dayText)}
      </Text>
      {setterLines(t, shown, item, dayText, over).map(({ key, line }) => small(line, key))}
      {lapsed(room, date, over) && small(t('demo.schoolThreshold.lapsed'))}
      {!over && mayDecide(room, date) && (
        <View testID="schoolThreshold-decide" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.schoolThreshold.decision')}
          </Text>
          <Text style={[styles.body, align]}>
            {t('demo.schoolThreshold.decideWhy', { until: dayText(addDays(chart.from, -1)) })}
          </Text>
          {proposed !== null && (
            <Button
              testID="schoolThreshold-adopt"
              disabled={busy}
              label={t('demo.schoolThreshold.adopt', { item: item(proposed.item) })}
              onPress={() => onDecide(proposed.item, t('demo.schoolThreshold.adopted', { item: item(proposed.item) }))}
            />
          )}
          <Button
            testID="schoolThreshold-none"
            {...(proposed === null ? {} : { variant: 'line' as const })}
            disabled={busy}
            label={t('demo.threshold.noCut')}
            onPress={() => onDecide(null, t('demo.schoolThreshold.noneDone'))}
          />
          {small(t('demo.schoolThreshold.signNote'))}
        </View>
      )}
      {!over && small(t('demo.schoolThreshold.seenBefore'))}
      {!over && small(t('demo.schoolThreshold.applies', { signBy: dayText(chart.signBy) }))}
      {!over &&
        small(t('demo.schoolThreshold.publishes', { to: dayText(lastDay), figures: dayText(chart.figuresDay) }))}
    </View>
  );
}
