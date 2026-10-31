// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One handover on the substitute's «أقسام بالاستخلاف» page (#587, #588,
// Handover-school, Handover-end-sub, answers 615 and 616): in whose place, by
// which decision and from which day. While it lasts: each class with its last
// signed week, from its first day to its last working day, or none; a class not
// all arrived says the school sends it again, then the plan pack, pupil list,
// timetable and access lines, and the receipt, signed on a day or offered once
// every class arrived whole. Once the holder returned, the classes' rows go:
// the day it ended; what stops, nothing new of these classes arriving and them
// leaving the timetable, my classes and the weekly digest, and outside a world
// their keys and pupils' records leaving this phone; what stays, the
// substitute's own record of the period and their private notes; and what
// reached the holder, the weeks signed in the period as signed, a week left
// unsigned staying on this phone; the receipt is no longer offered.

import type { Day, ReadHandover, Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { weekEnd } from '../week/week-sign-session';
import { arrivedWhole, handedClasses } from './handover-session';

export type HandoverCardProps = {
  readonly one: ReadHandover;
  readonly dayText: (day: Day) => string;
  readonly workingDays: readonly Weekday[];
  readonly busy: boolean;
  /** Signs the receipt that adds the classes to the teacher's own. */
  readonly onReceive: () => void;
};

const STOPS = ['nothing', 'keys'] as const;
const STAYS = ['record', 'notes'] as const;

/** One handover: in whose place, its classes, and its receipt while it lasts, or what its end stops and leaves. */
export function HandoverCard({ one, dayText, workingDays, busy, onReceive }: HandoverCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { holder, decision, from } = one.signed.value;
  const whole = arrivedWhole(one);
  const small = (words: string, key?: string) => (
    <Text key={key} style={[styles.small, align]}>
      {words}
    </Text>
  );
  const head = (words: string) => (
    <Text accessibilityRole="header" style={[styles.head, align]}>
      {words}
    </Text>
  );
  return (
    <View testID="handover-card" style={styles.card}>
      {head(t('demo.handover.line', { holder: isolate(holder), decision: isolate(decision), from: dayText(from) }))}
      {one.ended === null &&
        handedClasses(one).map((each) => (
          <View key={each.name} testID="handover-class" style={styles.row}>
            <Text style={[styles.body, align]}>
              {each.last === null
                ? t('demo.handover.noWeek', { class: isolate(each.name) })
                : t('demo.handover.lastWeek', {
                    class: isolate(each.name),
                    from: dayText(each.last),
                    to: dayText(weekEnd(each.last, workingDays)),
                  })}
            </Text>
            {!each.whole && small(t('demo.handover.partial'))}
          </View>
        ))}
      {one.ended !== null ? (
        <>
          <Text testID="handover-ended" style={[styles.body, align]}>
            {t('demo.handover.ended', { day: dayText(one.ended) })}
          </Text>
          {head(t('demo.handover.stops'))}
          {STOPS.map((key) => small(t(`demo.handover.stop.${key}`), key))}
          {head(t('demo.handover.stays'))}
          {STAYS.map((key) => small(t(`demo.handover.stay.${key}`), key))}
          {head(t('demo.handover.reached'))}
          {small(t('demo.handover.reachedLine'))}
        </>
      ) : (
        <>
          {small(t('demo.handover.plan'))}
          {small(t('demo.handover.pupils'))}
          {small(t('demo.handover.timetable', { day: dayText(from) }))}
          {small(t('demo.handover.ends'))}
          {one.received !== null ? (
            <Text testID="handover-added" style={[styles.body, align]}>
              {t('demo.handover.added', { day: dayText(one.received) })}
            </Text>
          ) : (
            <>
              {small(t(whole ? 'demo.handover.addLead' : 'demo.handover.waitWhole'))}
              <Button
                testID="handover-add"
                label={t('demo.handover.add')}
                disabled={!whole || busy}
                onPress={onReceive}
              />
            </>
          )}
        </>
      )}
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
  row: { gap: spacing['space-2'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
