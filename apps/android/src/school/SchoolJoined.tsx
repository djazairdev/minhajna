// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's space as joined (#564, #565, answer 582): one card for each
// code that joined, with the world's date its certificate was given and the
// school's ID shortened, kept left to right inside a sentence of either
// direction.

import { readJoinCode, type Day, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

/** A school's ID shortened, kept left to right inside a sentence of either direction. */
export const shortSchool = (school: string) => `\u2066${school.slice(0, 8)}\u2069`;

/** A card for each code that joined the school's space. */
export function SchoolJoinedCards({
  joins,
  dayText,
}: {
  readonly joins: readonly SchoolJoined[];
  readonly dayText: (day: Day) => string;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return joins.map(({ certificate, code }) => (
    <View key={code} testID="school-joined" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.school.joined')}
      </Text>
      <Text style={[styles.small, align]}>
        {t('demo.school.joinedLine', {
          date: dayText(certificate.issued),
          school: shortSchool(readJoinCode(code)?.school ?? ''),
        })}
      </Text>
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
