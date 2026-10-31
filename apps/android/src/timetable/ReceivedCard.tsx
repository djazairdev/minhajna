// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One version of the timetable the school sent, on the teacher's phone (#579,
// TT-change, TT-change-day, answer 607): its number and from which day, or the
// one day it is for; the first part says the whole timetable came, by its
// sessions; a later one what changes for the teacher's classes from that day,
// or on that day alone before the version it changes from applies again, each
// change in plain words (version-text.ts), or that nothing changes; the week's
// hours, kept or changed, or, for one day, how many sessions that day holds;
// and that sessions recorded before it are not rewritten. Then the receipt: the
// day it was confirmed, or a way to confirm it, which replaces signing the
// paper notice.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { hoursOf, sessionsOf, type Received } from './teacher-session';
import { changeText, hoursText } from './version-text';

export type ReceivedCardProps = {
  readonly received: Received;
  readonly busy: boolean;
  readonly onConfirm: (version: number) => void;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
};

/** A version received, what it changes, and its receipt. */
export function ReceivedCard({ received, busy, onConfirm, dayText }: ReceivedCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { part, base, changes, confirmed } = received;
  const day = dayText(part.from);
  const [before, after] = [base === null ? 0 : hoursOf(base.sessions), hoursOf(part.sessions)];
  return (
    <View testID="teacher-version" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t(part.once ? 'demo.timetable.once' : 'demo.timetable.from', { version: part.version, day })}
      </Text>
      {base === null && (
        <Text style={[styles.body, align]}>{t('demo.timetable.whole', { sessions: part.sessions.length })}</Text>
      )}
      {base !== null && changes.length === 0 && <Text style={[styles.body, align]}>{t('demo.timetable.nothing')}</Text>}
      {base !== null && changes.length > 0 && (
        <Text style={[styles.body, align]}>
          {part.once
            ? t('demo.timetable.onceChanges', { day, version: base.version })
            : t('demo.timetable.fromChanges', { day })}
        </Text>
      )}
      {changes.map((change, at) => (
        <Text key={`change-${at}`} testID="teacher-change" style={[styles.body, align]}>
          {changeText(t, change)}
        </Text>
      ))}
      <Text style={[styles.small, align]}>
        {part.once
          ? t('demo.timetable.daySessions', { sessions: t('count.sessions', { count: sessionsOf(part).length }) })
          : base === null || before === after
            ? t(base === null ? 'demo.timetable.hours' : 'demo.timetable.hoursSame', { hours: hoursText(t, after) })
            : t('demo.timetable.hoursChanged', { before: hoursText(t, before), after: hoursText(t, after) })}
      </Text>
      <Text style={[styles.small, align]}>{t('ttVersion.recorded', { day })}</Text>
      {confirmed !== null ? (
        <Text testID="teacher-confirmed" style={[styles.label, align]}>
          {t('demo.timetable.confirmed', { day: dayText(confirmed) })}
        </Text>
      ) : (
        <>
          <Button
            testID="teacher-confirm"
            label={t('demo.timetable.confirm', { version: part.version })}
            disabled={busy}
            onPress={() => onConfirm(part.version)}
          />
          <Text style={[styles.small, align]}>{t('demo.timetable.paper')}</Text>
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
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
