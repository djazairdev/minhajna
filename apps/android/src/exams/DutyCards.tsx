// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A day's exam-week entries as cards (#221, Today-exams): each with its
// kind, its times and its room or classes, read out as one, and a button
// that removes it where the day's entries are edited.

import type { Context, ExamDuty } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { currentLanguage, useText } from '../text/i18n';
import { dutyText } from './duty-rules';

export type DutyCardsProps = {
  readonly context: Context;
  readonly duties: readonly ExamDuty[];
  readonly onRemove?: (duty: ExamDuty) => void;
};

export function DutyCards({ context, duties, onRemove }: DutyCardsProps) {
  const t = useText();
  const { direction } = useLocale();
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return duties.map((duty) => {
    const text = dutyText(t, context, duty, direction, comma);
    return (
      <View key={duty.id} testID={`duty-${duty.id}`} style={styles.card}>
        <View accessible style={styles.text}>
          <Badge label={text.kind} />
          <Text style={[styles.title, align]}>{text.time}</Text>
          {text.line !== null && <Text style={[styles.body, align]}>{text.line}</Text>}
        </View>
        {onRemove !== undefined && (
          <IconButton
            testID={`duty-remove-${duty.id}`}
            icon={controlIcon('cross')}
            accessibilityLabel={t('duties.remove', { kind: text.kind, time: text.time })}
            onPress={() => onRemove(duty)}
          />
        )}
      </View>
    );
  });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  text: { flex: 1, gap: spacing['space-4'], alignItems: 'flex-start' },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
