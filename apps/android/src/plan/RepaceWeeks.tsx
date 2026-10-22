// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The draft's weeks (#229, Repace, Repace-primary, answer 364): one row a
// teaching week with its dates, what it takes and its plan sessions; for a
// week pack, the plan weeks it takes. A week taking a ticked merge says it
// is proposed with the draft. Then TD on its own row, and the exams, or the
// term's end, where the plan stops. Each row reads as one item; with large
// text, its parts stack.

import type { CountryProfile, RepaceDraft } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge } from '../components/Badge';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText, type Language } from '../text/i18n';
import { weekRows, type WeekRow } from './repace-rules';

export type RepaceWeeksProps = {
  readonly draft: RepaceDraft;
  readonly language: Language;
  readonly profile: Pick<CountryProfile, 'months'>;
};

export function RepaceWeeks({ draft, language, profile }: RepaceWeeksProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.5;
  const weekPack = draft.weeks.some((week) => week.planWeeks.length > 0);
  const row = (one: WeekRow) => (
    <View
      key={one.key}
      testID={`repace-${one.key}`}
      accessible
      accessibilityLabel={one.label}
      style={[styles.row, stacked && styles.stacked]}
    >
      <Text style={[styles.when, !stacked && styles.narrow, align]}>{one.when}</Text>
      <View style={styles.what}>
        <Text style={[styles.body, align]}>{one.what}</Text>
        {one.badge !== undefined && <Badge label={one.badge} />}
      </View>
      <Text style={styles.count}>{one.count}</Text>
    </View>
  );
  return (
    <View testID="repace-weeks" style={styles.table}>
      <View
        style={[styles.row, styles.head, stacked && styles.stacked]}
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.when, !stacked && styles.narrow, styles.label, align]}>{t('repace.week')}</Text>
        <Text style={[styles.what, styles.label, align]}>{t(weekPack ? 'repace.planWeeks' : 'repace.items')}</Text>
        <Text style={[styles.count, styles.label]}>{t('repace.sessions')}</Text>
      </View>
      {weekRows(t, draft, language, profile).map(row)}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-8'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  head: { borderTopWidth: 0, backgroundColor: colors.paper },
  stacked: { flexDirection: 'column' },
  when: { ...typography.caption, color: colors.ink2 },
  narrow: { width: 72 },
  what: { flex: 1, gap: spacing['space-4'], alignItems: 'flex-start' },
  count: { ...typography.label, color: colors.ink, minWidth: 28, textAlign: 'center' },
  label: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
