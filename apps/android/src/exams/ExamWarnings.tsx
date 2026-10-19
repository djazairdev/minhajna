// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The standing exam-window warning (#221, R-4.7-32, answers 268 and 269): one
// card for each class whose plan would push items past its next exams, on
// Today and, for its own class, at the top of the class plan. The card names
// the items, the exams' first day and the class, and «ما العمل؟» opens the
// answers. It stays until the teacher decides, and goes once the window
// begins or nothing falls after it any more.

import type { Context, Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { courseLabel } from './course-label';
import { courseWarnings, quotedItems } from './window-rules';

export type ExamWarningsProps = {
  readonly context: Context;
  readonly day: Day;
  /** Only this course's warning, as the class plan shows it. */
  readonly courseId?: string;
  readonly onOpen: (courseId: string) => void;
};

export function ExamWarnings({ context, day, courseId, onOpen }: ExamWarningsProps) {
  const t = useText();
  const { direction } = useLocale();
  const { state, profile } = useAppData();
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const warnings = useMemo(() => courseWarnings(context, day, courseId), [context, day, courseId]);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return warnings.map((warning) => (
    <View key={warning.courseId} testID={`exam-warning-${warning.courseId}`} style={styles.card}>
      <View accessible style={styles.text}>
        <Badge label={t('examWindow.badge')} variant="warning" />
        <Text style={[styles.title, align]}>
          {t('examWindow.past', {
            items: quotedItems(
              t,
              warning.items.map(({ item }) => item),
              comma,
            ),
            day: dayName(t, warning.window.from, language, profile),
          })}
        </Text>
        <Text style={[styles.body, align]}>
          {t('examWindow.cardLine', { class: courseLabel(t, state, profile, warning.courseId) })}
        </Text>
      </View>
      <Button
        testID={`exam-warning-open-${warning.courseId}`}
        variant="line"
        label={t('examWindow.open')}
        onPress={() => onOpen(warning.courseId)}
      />
    </View>
  ));
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-10'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  text: { gap: spacing['space-6'], alignItems: 'flex-start' },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink2 },
});
