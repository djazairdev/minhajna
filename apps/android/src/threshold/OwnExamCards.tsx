// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exams on the exams list the phone works out itself (#601, #602,
// T-Threshold-exams, T-Threshold-moved, R-3.3-31 to R-3.3-33, R-7.10-01,
// R-7.10-06, answers 633 and 634): the school's exams before their figures day,
// and those above the school under their own heading: for each, worked out on
// the phone (own-exams.ts), every grade and subject of the teacher's classes
// that sit it, with the exam, the level that sets it, its first day and figures
// day, a move of its days with when it was announced and why
// (threshold-text.ts), and each class's item reached and forecast, on the day
// they are taken; then what the level shows: no school cut yet, one optional
// after the figures day, no directorate's cut before the exam, the classes
// later shown against its totals, and, from its figures day, a way to them
// (ExamTotals.tsx), and the national cut published to all after the exam with
// its figures. Nothing worked out here leaves the phone, as the note under
// those above the school says, and there is nothing to sign.

import type { Day, ExamMove } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import type { TermReference } from '../director/seeded-fill';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { OwnExam } from './own-exams';
import { headText, itemNamer, movedLines, roomId } from './threshold-text';
import { thresholdStyles as styles } from './ThresholdFrame';

export type OwnExamCardsProps = {
  readonly exams: readonly OwnExam[];
  readonly dayText: (day: Day) => string;
  readonly reference: TermReference;
  /** The moved exams, by ID. */
  readonly moves: ReadonlyMap<string, ExamMove>;
  /** The section's heading and the note under it, for the exams above the school. */
  readonly above?: boolean;
  /** Opens a directorate exam's totals by its exam, subject and grade's key, from its figures day, above the school. */
  readonly onTotals?: (room: string) => void;
};

/** A card for each grade and subject of the teacher's classes in each exam the phone works out itself. */
export function OwnExamCards({ exams, dayText, reference, moves, above = false, onTotals }: OwnExamCardsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (exams.length === 0) return null;
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  return (
    <>
      {above && <SectionHeader testID="thresholds-above" label={t('demo.thresholds.above')} />}
      {exams.flatMap(({ exam, asOf, charts }) =>
        charts.map((chart) => {
          const item = itemNamer(t, chart, reference.packs);
          const totals = exam.setBy === 'directorate' && asOf === exam.figuresDay ? onTotals : undefined;
          const shows = totals === undefined ? exam.setBy : 'totals';
          return (
            <View key={`${exam.id}\n${chart.subject}\n${chart.grade}`} testID="thresholds-own" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {headText(t, chart, reference)}
              </Text>
              {small(t(`demo.thresholds.level.${exam.setBy}`))}
              {small(t('demo.thresholds.ownDays', { from: dayText(exam.from), figures: dayText(exam.figuresDay) }))}
              {movedLines(t, moves.get(exam.id), exam, dayText).map((line, at) => small(line, `moved-${at}`))}
              {small(t('demo.thresholds.asOf', { day: dayText(asOf) }))}
              {chart.classes.map((each, at) =>
                small(
                  t('demo.thresholds.classLine', {
                    class: isolate(each.name),
                    reached: item(each.position),
                    forecast: item(each.forecast),
                    day: dayText(chart.forecastDay),
                  }),
                  String(at),
                ),
              )}
              <Text style={[styles.body, align]}>{t(`demo.thresholds.shows.${shows}`)}</Text>
              {totals !== undefined && (
                <Button
                  testID="thresholds-totals"
                  variant="line"
                  label={t('demo.thresholds.totals')}
                  name={`${t('demo.thresholds.totals')}${t('chart.colon')}${headText(t, chart, reference)}`}
                  onPress={() => totals(roomId(chart))}
                />
              )}
            </View>
          );
        }),
      )}
      {above && small(t('demo.thresholds.notes.phone'))}
    </>
  );
}
