// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One class of a grant on I-Grant (#594, answer 622). Before it is opened the
// grant names it only by its course, so it shows by its number in the grant
// with the signed weeks the grant names for it, counted in the language's
// plural forms, from the first's first day to the last's last working day, and
// a button to open it, which says that opening it shows in its teacher's access
// log; while opening it says so; once open, its class and subject as its latest
// week names them, its signed weeks read from the archive, the sessions held,
// those not held for a cause other than the calendar, without their reason, and
// those the calendar took, with their days, or nothing for either, and how many
// corrections and director's visas its weeks hold, or nothing; or that no
// week's archive reads. A problem opening it is said as an alert, with a way to
// open it again. A grant that has ended shows no button.

import type { Day, Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { weekEnd } from '../week/week-sign-session';
import type { OpenedClass } from './grant-state';

export type GrantClassProps = {
  readonly testID: string;
  /** The class's place among the grant's classes, from 1. */
  readonly number: number;
  /** The first days of the signed weeks the grant names for the class, in order. */
  readonly weeks: readonly Day[];
  /** The country's working days, on which a week's span ends. */
  readonly workingDays: readonly Weekday[];
  readonly opened: OpenedClass | undefined;
  readonly ended: boolean;
  readonly dayText: (day: Day) => string;
  readonly onOpen: () => void;
};

/** One class of a grant, by its number until it is opened. */
export function GrantClass(props: GrantClassProps) {
  const { testID, number, weeks, workingDays, opened, ended, dayText, onOpen } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const span = (count: number) =>
    t('demo.inspectorGrant.classWeeks', {
      weeks: t('demo.inspectorGrant.weeks', { count }),
      from: dayText(weeks[0]),
      to: dayText(weekEnd(weeks.at(-1)!, workingDays)),
    });
  const sessions = (count: number) => t('demo.inspectorGrant.sessions', { count });
  const row = (label: string, value: string, id: string) => (
    <View style={styles.row}>
      <Text style={[styles.label, align]}>{label}</Text>
      <Text testID={`${testID}-${id}`} style={[styles.body, align]}>
        {value}
      </Text>
    </View>
  );
  const counted = (count: number, key: 'corrections' | 'visas') =>
    count === 0 ? t('demo.inspectorGrant.nothing') : t(`demo.inspectorGrant.${key}`, { count });
  if (opened?.state === 'open' && opened.read !== null) {
    const { delivery, corrections, visas } = opened.read;
    const taken = [...new Set(delivery.lost.flatMap((one) => (one.entry === null ? [] : [one.day])))];
    return (
      <View testID={testID} style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.inspectorGrant.named', { class: isolate(delivery.class), subject: isolate(delivery.subject) })}
        </Text>
        {row(t('demo.inspectorGrant.weeksLabel'), span(delivery.weeks), 'weeks')}
        {row(t('demo.inspectorGrant.heldLabel'), sessions(delivery.held), 'held')}
        {row(
          t('demo.inspectorGrant.lostLabel'),
          delivery.other === 0
            ? t('demo.inspectorGrant.nothing')
            : t('demo.inspectorGrant.lost', { sessions: sessions(delivery.other) }),
          'lost',
        )}
        {row(
          t('demo.inspectorGrant.holidaysLabel'),
          delivery.calendar === 0
            ? t('demo.inspectorGrant.nothing')
            : t('demo.inspectorGrant.holidays', {
                sessions: sessions(delivery.calendar),
                days: taken.map(dayText).join(' · '),
              }),
          'holidays',
        )}
        {row(t('demo.inspectorGrant.correctionsLabel'), counted(corrections, 'corrections'), 'corrections')}
        {row(t('demo.inspectorGrant.visasLabel'), counted(visas, 'visas'), 'visas')}
      </View>
    );
  }
  return (
    <View testID={testID} style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.inspectorGrant.class', { number })}
      </Text>
      <Text style={[styles.body, align]}>{span(weeks.length)}</Text>
      {opened?.state === 'open' && <Text style={[styles.small, align]}>{t('demo.inspectorGrant.noArchive')}</Text>}
      {opened?.state === 'opening' && (
        <Text testID={`${testID}-opening`} style={[styles.small, align]}>
          {t('demo.inspectorGrant.opening')}
        </Text>
      )}
      {opened?.state === 'problem' && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {t(opened.words)}
        </Text>
      )}
      {!ended && (opened === undefined || opened.state === 'problem') && (
        <>
          <Button
            testID={`${testID}-open`}
            variant={opened === undefined ? 'primary' : 'line'}
            label={t(opened === undefined ? 'demo.inspectorGrant.open' : 'demo.inspectorGrant.again')}
            onPress={onOpen}
          />
          <Text style={[styles.small, align]}>{t('demo.inspectorGrant.openLine')}</Text>
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
    backgroundColor: colors.paper,
    padding: spacing['space-12'],
    gap: spacing['space-8'],
  },
  row: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.small, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
