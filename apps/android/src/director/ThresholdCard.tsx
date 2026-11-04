// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The thresholds first on the director's dashboard (#603, R-7.10-10, R-7.10-23,
// answer 637), tinted as D-Dashboard draws it, with a button in place of its
// chevron: the next school exam this school sits that the world's date is
// before or in, by its first day, with its first day and the day the school's
// figures are taken as the calendar now has it; until that day, that each
// teacher sees their subject's page as it is seen on the thresholds page; from
// it, or once a room of an exam moved later is there, how many of its rooms are
// open, one for each grade and subject, and of those how many cuts are settled,
// how many were decided as no cut, wait for the setters' signatures, wait for
// the director's decision or lapsed, said as they are read, never a figure for
// one class or teacher; and a way to the thresholds page, where each class's
// chart, forecast and the setters' signatures are shown. With no such exam left
// in the year it says no day is announced.

import { compareDays, worldExams, type Day, type DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { examGroups } from '../threshold/exam-charts';
import { lapsed, mayDecide, type SchoolRoom } from '../threshold/school-rooms';
import { examName } from '../threshold/threshold-text';
import type { TermReference } from './seeded-fill';

export type ThresholdCardProps = {
  readonly date: Day;
  readonly school: DemoSchool;
  readonly reference: Pick<TermReference, 'calendar'>;
  /** The school exams' rooms as read, or null while they are not. */
  readonly rooms: readonly SchoolRoom[] | null;
  readonly dayText: (day: Day) => string;
  /** Opens the thresholds page, when the workspace can. */
  readonly onOpen?: () => void;
};

const COUNTS = ['settled', 'none', 'signing', 'director', 'lapsed'] as const;

/** Where a room's cut stands, as the dashboard counts it. */
function standing(room: SchoolRoom, date: Day): (typeof COUNTS)[number] {
  if (room.state.settled !== null) return room.state.settled.item === null ? 'none' : 'settled';
  if (mayDecide(room, date)) return 'director';
  return lapsed(room, date, false) ? 'lapsed' : 'signing';
}

/** The coming school exam, its days, and where its cuts stand. */
export function ThresholdCard({ date, school, reference, rooms, dayText, onOpen }: ThresholdCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { year, entries } = reference.calendar;
  const exam = worldExams(year, entries)
    .filter((one) => one.setBy === 'school' && compareDays(date, one.to) <= 0 && examGroups(one, school).length > 0)
    .sort((a, b) => compareDays(a.from, b.from))[0];
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const ofExam = (rooms ?? []).filter((one) => one.exam.id === exam?.id);
  const reached = exam !== undefined && (compareDays(exam.figuresDay, date) <= 0 || ofExam.length > 0);
  const count = (key: (typeof COUNTS)[number]) => ofExam.filter((one) => standing(one, date) === key).length;
  return (
    <View testID="dashboard-threshold" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.dashboard.threshold')}
      </Text>
      {exam === undefined ? (
        small(t('demo.dashboard.noThreshold'))
      ) : (
        <>
          <Text style={[styles.head, align]}>
            {t('demo.dashboard.thresholdExam', { exam: examName(t, exam.id), from: dayText(exam.from) })}
          </Text>
          {small(t('demo.dashboard.thresholdFigures', { figures: dayText(exam.figuresDay) }))}
          {!reached && small(t('demo.dashboard.thresholdTeachers'))}
          <View testID="dashboard-threshold-counts" accessibilityLiveRegion="polite" style={styles.counts}>
            {reached && rooms !== null && small(t('demo.dashboard.thresholdRooms', { count: ofExam.length }))}
            {reached &&
              ofExam.length > 0 &&
              COUNTS.map((key) => small(t(`demo.dashboard.thresholdCounts.${key}`, { count: count(key) }), key))}
          </View>
        </>
      )}
      {onOpen !== undefined && (
        <Button
          testID="dashboard-threshold-open"
          variant="line"
          label={t('demo.dashboard.thresholdOpen')}
          onPress={onOpen}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors['notice-edge'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.notice,
    padding: spacing['space-16'],
    gap: spacing['space-4'],
  },
  counts: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors['notice-ink'] },
});
