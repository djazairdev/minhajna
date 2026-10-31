// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A course opened on the school's term report (#589, D-Report, answer 617): its
// class and subject, its teacher as the staff list writes them, the sessions
// confirmed in its signed weeks with those held as planned, not held for the
// calendar and not held for another cause, never how many await confirmation
// (R-7.6-02); each session not held in day order with its day, bell span, group
// and the calendar's entry or «other», with no reason; that make-ups come from
// Today outside a world; and how many weeks are signed, with the last one's
// first day.

import type { Day, LostSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { spanText } from '../timetable/grid-text';
import { isolate } from '../week/grid-labels';
import type { CourseReport } from './delivery-session';

export type DeliveryDetailProps = {
  readonly one: CourseReport;
  readonly dayText: (day: Day) => string;
};

/** A course's term: its teacher, its figures, each session not held, the make-ups and its signed weeks. */
export function DeliveryDetail({ one, dayText }: DeliveryDetailProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const session = (lost: LostSession) =>
    [dayText(lost.day), spanText(lost.session.start, lost.session.end)]
      .concat(lost.session.group === '' ? [] : [isolate(lost.session.group)])
      .join(' · ');
  const line = (lost: LostSession) =>
    lost.entry === null
      ? t('demo.report.lostOther', { session: session(lost) })
      : t('demo.report.lostCalendar', { session: session(lost), entry: localized(lost.entry.name) });
  const body = (words: string) => <Text style={[styles.body, align]}>{words}</Text>;
  return (
    <View testID="delivery-detail" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {`${isolate(one.class)} · ${isolate(one.subject)}`}
      </Text>
      <Text style={[styles.small, align]}>{isolate(one.teacher)}</Text>
      {body(t('demo.report.confirmed', { count: one.held + one.calendar + one.other }))}
      {body(t('demo.mine.counts.held', { count: one.held }))}
      {body(t('demo.mine.counts.calendar', { count: one.calendar }))}
      {body(t('demo.mine.counts.other', { count: one.other }))}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.report.lostList')}
      </Text>
      {one.lost.length === 0 && <Text style={[styles.small, align]}>{t('demo.delivery.noneLost')}</Text>}
      {one.lost.map((each, at) => (
        <Text key={`${at}`} testID="delivery-lost" style={[styles.small, align]}>
          {line(each)}
        </Text>
      ))}
      <Text style={[styles.small, align]}>{t('demo.delivery.makeUps')}</Text>
      <Text style={[styles.small, align]}>
        {t('demo.delivery.weeks', { count: one.weeks, day: dayText(one.lastWeek) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
