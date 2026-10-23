// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a correction after the term would change, shown before it is saved
// (#243, Export-fix, answer 468): the pupil's term average, the class average
// and how many reach 10, or 5 in primary, before and after, or that the pupil,
// or the class, has no average yet; and, when the average moves to another
// appreciation band, «تغيّرت فئة المعدل: مراجعة التقدير» with a link to
// «التقديرات». The whole is read as one group.

import { bandOf, fixEffect, shownMark, type AssessmentData, type Context, type MarkEntry } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { appreciationList } from './appreciation-rules';

export type FixEffectProps = {
  readonly context: Context;
  readonly data: AssessmentData;
  readonly mark: MarkEntry;
  /** Opens the term's appreciations. */
  readonly onAppreciations: () => void;
};

export function FixEffectView({ context, data, mark, onAppreciations }: FixEffectProps) {
  const t = useText();
  const { direction } = useLocale();
  const { profile } = useAppData();
  const effect = useMemo(() => fixEffect(context, data, mark), [context, data, mark]);
  if (effect === null) return null;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const shown = (value: number | null) => (value === null ? '—' : shownMark(value));
  const list = appreciationList(profile);
  const band = (value: number | null) => (list === null ? null : (bandOf(list, value, effect.scale)?.id ?? null));
  const moved = band(effect.before.average) !== band(effect.after.average);
  return (
    <View style={styles.group}>
      <View testID="fix-effect" accessible style={styles.card}>
        <Text style={[styles.body, align]}>
          {effect.before.average === null && effect.after.average === null
            ? t('marks.fix.noAverage')
            : t('marks.fix.average', { from: shown(effect.before.average), to: shown(effect.after.average) })}
        </Text>
        <Text style={[styles.note, align]}>
          {effect.before.mean === null && effect.after.mean === null
            ? t('marks.fix.noClass')
            : t('marks.fix.classLine', {
                from: shown(effect.before.mean),
                to: shown(effect.after.mean),
                threshold: effect.threshold,
                reachedFrom: effect.before.reached,
                reachedTo: effect.after.reached,
                total: effect.counted,
              })}
        </Text>
      </View>
      {moved && (
        <>
          <Notice testID="fix-band" variant="notice" badge={t('marks.fix.bandBadge')} message={t('marks.fix.band')} />
          <Button
            testID="fix-appreciations"
            variant="line"
            label={t('marks.fix.toAppreciations')}
            onPress={onAppreciations}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  body: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
