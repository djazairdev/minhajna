// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One subject's room on D-Threshold (#603, answer 637): its heading, the days
// its figures were taken, its cut is signed by and its exam begins on; the
// chart of each class's item reached on the figures day and its forecast, with
// the table of the same figures (ChartFigure.tsx) and the item every class
// reached; where its cut stands, or after the exam the cut as published
// (published-text.ts), with each setter's latest cut and day; while the
// decision is the director's, before the exam, why, with the two choices, the
// cut proposed when there is one and no cut, which cannot be pressed while the
// rooms are read; and who sees the cut now, when it applies and when it is
// published.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { TermReference } from '../director/seeded-fill';
import { ChartFigure } from '../drawing/ChartFigure';
import { useDeviceText } from '../text/device-text';
import { publishedText } from '../threshold/published-text';
import { mayDecide, type SchoolRoom } from '../threshold/school-rooms';
import { chartSpec, everyReached, headText, itemNamer, setterLines, stateText } from '../threshold/threshold-text';
import { thresholdStyles as styles } from '../threshold/ThresholdFrame';

export type ThresholdRoomPanelProps = {
  readonly room: SchoolRoom;
  readonly date: Day;
  readonly dayText: (day: Day) => string;
  readonly reference: TermReference;
  readonly busy: boolean;
  /** Signs the director's decision, an item or null for no cut, saying `done` once signed. */
  readonly onDecide: (item: string | null, done: string) => void;
};

/** A subject's chart, cut and setters, and the director's decision while it is theirs. */
export function ThresholdRoomPanel({ room, date, dayText, reference, busy, onDecide }: ThresholdRoomPanelProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { chart, state, exam } = room;
  const item = itemNamer(t, chart, reference.packs);
  const every = everyReached(chart);
  const over = exam.to < date;
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
        {t('demo.threshold.dates', {
          figures: dayText(chart.figuresDay),
          signBy: dayText(chart.signBy),
          from: dayText(exam.from),
        })}
      </Text>
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
      {mayDecide(room, date) && (
        <View testID="schoolThreshold-decide" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.schoolThreshold.decision')}
          </Text>
          <Text style={[styles.body, align]}>{t('demo.schoolThreshold.decideWhy')}</Text>
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
      {small(t(over ? 'demo.schoolThreshold.seenAfter' : 'demo.schoolThreshold.seenBefore'))}
      {small(t('demo.schoolThreshold.applies', { signBy: dayText(chart.signBy) }))}
      {small(t('demo.schoolThreshold.publishes', { to: dayText(exam.to), figures: dayText(chart.figuresDay) }))}
    </View>
  );
}
