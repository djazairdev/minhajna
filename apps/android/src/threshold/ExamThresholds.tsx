// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's exams with a common paper (#601, T-Threshold-exams, §7.10,
// R-3.3-31 to R-3.3-33, R-7.10-01, answer 633), opened from a joined school's
// card: as it opens it reads the rooms handed to the phone (useTeacherRooms.ts)
// and lists each school exam by its term, subject and grade, its first day,
// figures day and signing deadline, where its cut stands, and each class of its
// chart with the item it reached on the figures day and its forecast, with a
// way to the exam's page (ExamThreshold.tsx), named with its exam; then, from
// the weeks the phone signed, the exams above the school its classes sit
// (OwnExamCards.tsx), when the world's reference and school are there, or that
// they could not be worked out when the phone's weeks do not read; with none,
// it says no school exam's figures day has come for the teacher's subjects. It
// says that the chart is worked out in the school from signed weeks only and
// never leaves its space, that monthly tests stay each teacher's own, and that
// nothing here serves to evaluate or rank anyone. Going back leads to
// School-join.

import type { Day, DemoSchool, SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { ownExams } from './own-exams';
import { OwnExamCards } from './OwnExamCards';
import { headText, itemNamer, roomId, stateText } from './threshold-text';
import { ThresholdFrame, thresholdStyles as styles } from './ThresholdFrame';
import { useTeacherRooms } from './useTeacherRooms';

export type ExamThresholdsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly date: string;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** The world's reference, which names the subjects, grades and plan items. */
  readonly reference?: TermReference;
  /** The world's school, rebuilt from the world's ID, whose classes sit the exams above it. */
  readonly school?: DemoSchool | null;
  readonly onClose: () => void;
  readonly said: string;
  /** Opens an exam's page by its room's key. */
  readonly onRoom: (room: string) => void;
};

const NOTES = ['school', 'monthly', 'never'] as const;

/** The school exams whose rooms the phone reads, with where each class stands. */
export function ExamThresholds(props: ExamThresholdsProps) {
  const { world, date, join, kit, send, dayText, reference, school, onClose, said, onRoom } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const read = useTeacherRooms(world, join, kit, send, said, 'thresholds', true);
  const { weeks } = read;
  const own = useMemo(
    () =>
      weeks === null || reference === undefined || school == null ? [] : ownExams(weeks, school, reference, world.date),
    [weeks, school, reference, world.date],
  );
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  return (
    <ThresholdFrame
      testID="thresholds"
      date={date}
      join={join}
      title={t('demo.thresholds.title')}
      region={read.region}
      reading={read.reading}
      problem={read.problem}
      onAgain={read.again}
      onClose={onClose}
    >
      <Text style={[styles.body, align]}>{t('demo.thresholds.lead')}</Text>
      {read.rooms?.length === 0 && <Text style={[styles.body, align]}>{t('demo.thresholds.empty')}</Text>}
      {read.rooms?.map((one) => {
        const { chart } = one;
        const item = itemNamer(t, chart, reference?.packs);
        return (
          <View key={roomId(one.room)} testID="thresholds-room" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {headText(t, chart, reference)}
            </Text>
            {small(
              t('demo.thresholds.days', {
                from: dayText(chart.from),
                figures: dayText(chart.figuresDay),
                signBy: dayText(chart.signBy),
              }),
            )}
            <Text style={[styles.body, align]}>{stateText(t, one, item, dayText)}</Text>
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
            <Button
              testID="thresholds-open"
              variant="line"
              label={t('demo.thresholds.room')}
              name={`${t('demo.thresholds.room')}: ${headText(t, chart, reference)}`}
              onPress={() => onRoom(roomId(one.room))}
            />
          </View>
        );
      })}
      {reference !== undefined && <OwnExamCards exams={own} dayText={dayText} reference={reference} />}
      {read.rooms !== null && weeks === null && reference !== undefined && school != null && (
        <Text style={[styles.small, align]}>{t('demo.thresholds.ownFailed')}</Text>
      )}
      {NOTES.map((key) => small(t(`demo.thresholds.notes.${key}`), key))}
    </ThresholdFrame>
  );
}
