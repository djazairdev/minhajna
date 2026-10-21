// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The day's scheduled support sessions on Today (#228, answer 362): each
// not yet logged, as a reminder card with its class, its bell time and the
// item it would take, and «تسجيل», which opens the form filled in.

import { scheduledSupport, type CatchUpSession, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { courseSchool, whenLine } from '../plan/catch-up-add-rules';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export function SupportToday({ day, onLog }: { readonly day: Day; readonly onLog: (catchUp: CatchUpSession) => void }) {
  const t = useText();
  const data = useAppData();
  const { state, profile } = data;
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const rows = useMemo(
    () =>
      [...new Set([...state.catchUps.values()].map((one) => one.courseId))]
        .flatMap((courseId) => scheduledSupport(state, courseId))
        .filter((one) => one.catchUp.day === day),
    [state, day],
  );
  return rows.map(({ catchUp, item }) => {
    const when = whenLine(t, data, courseSchool(state, catchUp.courseId), day, catchUp.slot, direction);
    const className = courseLabel(t, state, profile, catchUp.courseId);
    return (
      <View key={catchUp.id} testID={`today-support-${catchUp.id}`} style={styles.card}>
        <View accessible style={styles.text}>
          <Badge label={t('supportQueue.badge')} />
          <Text style={[styles.title, align]}>{`${isolate(className)} · ${when}`}</Text>
          {item !== null && (
            <Text style={[styles.body, align]}>
              {t('supportQueue.willTake', { item: t('tests.quoted', { title: isolate(item.title) }) })}
            </Text>
          )}
        </View>
        <Button
          testID={`today-support-log-${catchUp.id}`}
          variant="line"
          label={t('supportQueue.logThis')}
          accessibilityHint={className}
          onPress={() => onLog(catchUp)}
        />
      </View>
    );
  });
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  text: { gap: spacing['space-4'], alignItems: 'flex-start' },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
});
