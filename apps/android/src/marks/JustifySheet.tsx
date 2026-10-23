// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One pupil's justification as the screen shows it (#239, Marks-pupil,
// answers 443 and 454): the pupil, the class and period, T out of the scale
// with how many components are still empty, the term's test mean, exam and
// average, each component with what was recorded and its mark, the total,
// and the board's two notes.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import type { JustifyPage } from './justify-rules';

export function JustifySheet({ page }: { readonly page: JustifyPage }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="justify-sheet" style={styles.sheet}>
      <View accessible style={styles.head}>
        <Text testID="justify-pupil" style={[styles.pupil, align]}>
          {page.pupil}
        </Text>
        <Text style={[styles.note, align]}>{page.line}</Text>
        <View style={styles.total}>
          <Text testID="justify-total" style={styles.big}>
            {page.total}
          </Text>
          <Text style={styles.outOf}>{t('marks.justify.outOf', { scale: page.scale })}</Text>
        </View>
        {page.empty > 0 && (
          <Text style={[styles.note, align]}>{t('marks.justify.emptyCount', { count: page.empty })}</Text>
        )}
        {page.parts !== null && (
          <Text testID="justify-parts" style={[styles.body, align]}>
            {page.parts}
          </Text>
        )}
      </View>
      {page.rows.map((row) => (
        <View key={row.id} accessible style={styles.row}>
          <View style={styles.grow}>
            <Text style={[styles.name, align]}>{row.name}</Text>
            <Text style={[styles.note, align]}>{row.recorded}</Text>
          </View>
          <Text style={styles.mark}>{row.mark}</Text>
        </View>
      ))}
      <View accessible style={[styles.row, styles.sum]}>
        <Text style={[styles.name, styles.grow, align]}>{t('marks.justify.total')}</Text>
        <Text style={styles.mark}>{`${page.total} / ${page.scale}`}</Text>
      </View>
      <Text style={[styles.note, align]}>{t('marks.justify.noteBook')}</Text>
      <Text style={[styles.note, align]}>{t('marks.justify.noteReasons')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  head: { gap: spacing['space-2'] },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-6'], direction: 'ltr' },
  big: { ...typography.stat, color: colors.ink },
  outOf: { ...typography.body, color: colors.ink2 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['space-8'],
    paddingTop: spacing['space-8'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sum: { alignItems: 'center' },
  grow: { flex: 1, gap: spacing['space-2'] },
  pupil: { ...typography.h3, color: colors.ink },
  name: { ...typography.label, color: colors.ink },
  mark: { ...typography.label, color: colors.ink, writingDirection: 'ltr' },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
