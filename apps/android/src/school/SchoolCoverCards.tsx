// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// No preview route or setting provides this source. Only the future
// authenticated school-space adapter may install the read-only projection.
// The provider is not authentication and does not enable institution mode.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { useSchoolCover } from './cover-source';

/** Read-only school assignments; showing one never confirms cover or writes a lesson. */
export function SchoolCoverCards({ day }: { day: Day }) {
  const rows = useSchoolCover(day);
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return rows
    .filter((row) => row.session.day === day)
    .map((row) => (
      <View key={row.session.id} testID={`school-cover-card-${row.session.id}`} style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t(`schoolCover.cover.${row.direction}`)} · {row.session.className}
        </Text>
        <Text style={[styles.body, align]}>
          {t('schoolCover.cover.slot', {
            half: t(`calendarView.periods.${row.session.slot.half}`),
            index: row.session.slot.index,
          })}
        </Text>
        <Text style={[styles.body, align]}>{t(`schoolCover.cover.kinds.${row.choice}`)}</Text>
        <Badge label={t(`schoolCover.cover.${row.completed ? 'completed' : row.assigned ? 'assigned' : 'needed'}`)} />
        <Text style={[styles.note, align]}>{t('schoolCover.cover.school')}</Text>
      </View>
    ));
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
