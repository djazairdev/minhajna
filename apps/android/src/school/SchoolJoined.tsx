// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's space as joined (#564, #565, answer 582): one card for each code
// that joined, with the world's date its certificate was given and the school's
// ID shortened, kept left to right inside a sentence of either direction, the
// reminder that each class's week waits to be signed once a week, with a way to
// sign it (WeekSign.tsx, #582), a way to the weekly digest (WeekDigest.tsx,
// #584) and to the teacher's classes as the director sees them (SchoolMine.tsx,
// #584), to the classes handed over to the teacher as a substitute
// (HandoverSchool.tsx, #587) and to those come back at the end of a
// substitution (ReturnSchool.tsx, #588), to the term's marks to send to the
// state's stand-in (TermSend.tsx, #591), a way to the timetable the school sent
// (TeacherTimetable.tsx, #579), to the teacher's devices and copies once joined
// (DevicesMoved.tsx, #566) and to what stays and goes on leaving (Leave.tsx,
// #567).

import { readJoinCode, type Day, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { JoinPage } from './join-view';

/** A school's ID shortened, kept left to right inside a sentence of either direction. */
export const shortSchool = (school: string) => `\u2066${school.slice(0, 8)}\u2069`;

export type SchoolJoinedCardsProps = {
  readonly joins: readonly SchoolJoined[];
  readonly dayText: (day: Day) => string;
  /** Opens a joined card's page for a join. */
  readonly onOpen: (page: JoinPage) => (join: SchoolJoined) => void;
  /** Whether the year's dates read, so what stays and goes on leaving can open. */
  readonly canLeave: boolean;
};

/** The card's ways to its pages, in order: the page, its button's words and its test ID, the first filled. */
const WAYS = [
  ['week', 'demo.weekSign.open', 'school-week'],
  ['digest', 'demo.digest.open', 'school-digest'],
  ['mine', 'demo.mine.open', 'school-mine'],
  ['handover', 'demo.handover.open', 'school-handover'],
  ['return', 'demo.return.open', 'school-return'],
  ['termSend', 'demo.termSend.open', 'school-term'],
  ['timetable', 'demo.timetable.open', 'school-timetable'],
  ['devices', 'demo.devices.open', 'school-devices'],
  ['help', 'demo.help.open', 'school-help'],
] as const satisfies readonly (readonly [JoinPage, string, string])[];

/** A card for each code that joined the school's space. */
export function SchoolJoinedCards({ joins, dayText, onOpen, canLeave }: SchoolJoinedCardsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return joins.map((join) => (
    <View key={join.code} testID="school-joined" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.school.joined')}
      </Text>
      <Text style={[styles.small, align]}>
        {t('demo.school.joinedLine', {
          date: dayText(join.certificate.issued),
          school: shortSchool(readJoinCode(join.code)?.school ?? ''),
        })}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.weekSign.reminder')}</Text>
      {WAYS.map(([page, words, testID], at) => (
        <Button
          key={page}
          testID={testID}
          {...(at === 0 ? {} : { variant: 'line' as const })}
          label={t(words)}
          onPress={() => onOpen(page)(join)}
        />
      ))}
      {canLeave && (
        <Button
          testID="school-leave-open"
          variant="plain"
          label={t('demo.leave.open')}
          onPress={() => onOpen('leave')(join)}
        />
      )}
    </View>
  ));
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
  small: { ...typography.small, color: colors.ink2 },
});
