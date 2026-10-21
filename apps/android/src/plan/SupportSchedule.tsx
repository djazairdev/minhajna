// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The scheduled support sessions on «قائمة الدعم» (#228, Support-queue,
// answers 361 and 362): those not yet logged, in order, each with its day
// and bell time and the item it would take, the items left paired in order.
// From its day on, «تسجيل» opens the form to log it; until then, and until
// it is logged, «إلغاء» cancels it. «جدولة حصة دعم» takes a free time.

import { scheduledSupport, type CatchUpSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { courseSchool, whenLine } from './catch-up-add-rules';

export type SupportScheduleProps = {
  readonly courseId: string;
  readonly onCancel: (catchUp: CatchUpSession) => void;
  readonly onSchedule?: () => void;
  readonly onLog?: (catchUp: CatchUpSession) => void;
};

export function SupportSchedule({ courseId, onCancel, onSchedule, onLog }: SupportScheduleProps) {
  const t = useText();
  const data = useAppData();
  const { state, today } = data;
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const rows = useMemo(() => scheduledSupport(state, courseId), [state, courseId]);
  const school = courseSchool(state, courseId);
  const day = today();
  return (
    <View testID="support-schedule" style={styles.box}>
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('supportQueue.scheduled')}
      </Text>
      {rows.length === 0 && <Text style={[styles.sub, align]}>{t('supportQueue.noneScheduled')}</Text>}
      {rows.map(({ catchUp, item }) => {
        const when = whenLine(t, data, school, catchUp.day, catchUp.slot, direction);
        return (
          <View key={catchUp.id} testID={`support-session-${catchUp.id}`} style={styles.row}>
            <Text style={[styles.body, align]}>{when}</Text>
            <Text style={[styles.sub, align]}>
              {item === null
                ? t('supportQueue.takesNothing')
                : t('supportQueue.willTake', { item: t('tests.quoted', { title: isolate(item.title) }) })}
            </Text>
            <View style={styles.buttons}>
              {onLog !== undefined && catchUp.day <= day && (
                <View style={styles.grow}>
                  <Button
                    testID={`support-log-${catchUp.id}`}
                    variant="line"
                    label={t('supportQueue.logThis')}
                    accessibilityHint={when}
                    onPress={() => onLog(catchUp)}
                  />
                </View>
              )}
              <View style={styles.grow}>
                <Button
                  testID={`support-cancel-${catchUp.id}`}
                  variant="line"
                  label={t('catchUp.cancel')}
                  accessibilityHint={when}
                  onPress={() => onCancel(catchUp)}
                />
              </View>
            </View>
          </View>
        );
      })}
      <Text style={[styles.sub, align]}>{t('supportQueue.agreed')}</Text>
      {onSchedule !== undefined && (
        <Button testID="support-schedule-add" variant="line" label={t('supportQueue.schedule')} onPress={onSchedule} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing['space-8'] },
  row: { gap: spacing['space-6'] },
  buttons: { flexDirection: 'row', gap: spacing['space-8'] },
  grow: { flex: 1 },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
