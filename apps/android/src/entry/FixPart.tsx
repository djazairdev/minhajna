// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The parts «تصحيح الحصة» adds to the entry (#34, Entry-fix): above, the
// promise that the first version stays and the row as it was recorded;
// below, the correction's coded reason, what the activity log will add, by
// day and never by hour, and the reminder to correct the paper book too
// (PRD §3.1, rule 4; §5.5). A reason in the teacher's own words stays in the
// private note.

import { CORRECTION_REASONS, type CorrectionReason } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { BookRow, type BookRowProps } from './BookRow';
import type { FixChange } from './fix-rules';

export function FixHead({ recorded }: { recorded: BookRowProps }) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <View testID="fix-notice" accessible style={styles.notice}>
        <Text style={[styles.label, align]}>{t('fix.title')}</Text>
        <Text style={[styles.note, align]}>{t('fix.promise')}</Text>
      </View>
      <Text style={[styles.label, align]}>{t('fix.recorded')}</Text>
      <BookRow {...recorded} testID="fix-recorded" />
    </>
  );
}

export interface FixFootProps {
  readonly reason: CorrectionReason | null;
  readonly text: string;
  readonly onReason: (reason: CorrectionReason | null) => void;
  readonly onText: (text: string) => void;
  readonly changes: readonly FixChange[];
  /** Such as «18/10/2026». */
  readonly today: string;
}

export function FixFoot(props: FixFootProps) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <ChipGroup
        testID="fix-reason"
        label={t('fix.reasonLabel')}
        choices={[
          { value: 'none', label: t('fix.reasons.none') },
          ...CORRECTION_REASONS.map((value) => ({ value, label: t(`fix.reasons.${value}`) })),
        ]}
        selected={props.reason ?? 'none'}
        onSelect={(value) => props.onReason(value === 'none' ? null : value)}
      />
      {props.reason === 'other' && (
        <TextField
          testID="fix-reason-text"
          label={t('fix.reasonText')}
          placeholder={t('outcome.reasonPlaceholder')}
          value={props.text}
          onChangeText={props.onText}
          maxLength={60}
        />
      )}
      <Text style={[styles.note, align]}>{t('fix.reasonNote')}</Text>
      {props.changes.length > 0 && (
        <View testID="fix-log" accessible style={styles.log}>
          <Text style={[styles.label, align]}>{t('fix.log')}</Text>
          {props.changes.map((change) => (
            <Text key={change.field} style={[styles.body, align]}>
              {t('fix.change', { field: change.field, before: change.before, after: change.after })}
            </Text>
          ))}
          <Text style={[styles.note, align]}>{t('fix.added', { day: props.today })}</Text>
        </View>
      )}
      <Text style={[styles.note, align]}>{t('fix.paper')}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.notice,
    borderWidth: 1,
    borderColor: colors['notice-edge'],
  },
  log: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
