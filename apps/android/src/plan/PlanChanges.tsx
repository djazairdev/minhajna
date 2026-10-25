// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own changes to its plan (#225, Plan-changes, R-4.2-14,
// R-4.7-35): the parallel classes, where the class stands once its changes
// are counted, then each change in force, newest first, with its day, what
// it does and what it takes from the buffers or gives back. «تراجع» asks
// first, then records an undo: the change stays listed, struck through, and
// no recorded session changes (answer 285). Under the changes lies the
// pack's release, which every fix still reaches.

import {
  recordedDecisions,
  courseSetup,
  formatDay,
  nextSeq,
  pace,
  recordChange,
  termCheck,
  type Day,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { spacing } from '../design/tokens';
import { paceLine } from '../classes/class-rules';
import { ParallelClasses, changeCount } from '../classes/PlanHeader';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { changeLines } from './changes-rules';
import { packOfPin } from './plan-rules';

export type PlanChangesProps = {
  readonly courseId: string;
  readonly onCourse?: (courseId: string) => void;
};

export function PlanChanges({ courseId, onCourse }: PlanChangesProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today, record, newId } = useAppData();
  const day: Day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const pin = state.courses.get(courseId)?.pack ?? null;
  const base = packOfPin(packs, pin);
  const lines = useMemo(() => changeLines(t, context, courseId, base), [t, context, courseId, base]);
  const line = useMemo(
    () =>
      paceLine(t, {
        pace: pace(context, courseId, day),
        check: termCheck(context, courseId, day),
        stale: courseSetup(context, courseId).packStale,
      }),
    [t, context, courseId, day],
  );
  const takeBack = (id: string) =>
    Alert.alert(t('planChanges.title'), t('planChanges.undoAsk'), [
      { text: t('planChanges.cancel'), style: 'cancel' },
      {
        text: t('planChanges.undoGo'),
        onPress: () => {
          try {
            const seq = nextSeq(recordedDecisions(context.state, courseId), courseId);
            record(recordChange(context, { id: newId(), courseId, day, seq, kind: 'undo', change: id }));
          } catch {
            Alert.alert(t('planChanges.title'), t('planItem.refused'));
          }
        },
      },
    ]);
  const sessions = (count: number) => t('planDetails.sessions', { count });
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      {onCourse !== undefined && <ParallelClasses context={context} courseId={courseId} onCourse={onCourse} />}
      <Text style={[styles.body, align]}>{t('planChanges.intro')}</Text>
      {courseSetup(context, courseId).pack !== null && (
        <View testID="changes-pace" accessible style={styles.card}>
          <Text style={[styles.title, align]}>{line}</Text>
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {changeCount(t, context, courseId)}
      </Text>
      {lines.map((one) => {
        const label = t(`planChanges.kinds.${one.kind as 'move'}`);
        return (
          <View
            key={one.change.id}
            testID={`change-${one.change.id}`}
            style={[styles.card, { gap: spacing['space-8'] }]}
          >
            <View accessible style={styles.group}>
              <View style={{ flexDirection: 'row', gap: spacing['space-8'], direction }}>
                <Badge label={label} />
                {one.undone && <Badge label={t('planChanges.undone')} />}
                {one.change.day !== undefined && <Text style={styles.sub}>{formatDay(one.change.day)}</Text>}
              </View>
              <Text style={[styles.body, align, one.undone && { textDecorationLine: 'line-through' }]}>{one.text}</Text>
              {one.sessions !== 0 && (
                <Text style={[styles.sub, align]}>
                  {one.sessions > 0
                    ? t('planChanges.takes', { sessions: sessions(one.sessions) })
                    : t('planChanges.gives', { sessions: sessions(-one.sessions) })}
                </Text>
              )}
            </View>
            {!one.undone && (
              <Button
                testID={`change-undo-${one.change.id}`}
                variant="line"
                label={t('planChanges.undo')}
                accessibilityHint={t('planChanges.undoSpoken', { change: one.text })}
                onPress={() => takeBack(one.change.id)}
              />
            )}
          </View>
        );
      })}
      {base !== undefined && (
        <Text style={[styles.sub, align]}>{t('planChanges.under', { release: base.release })}</Text>
      )}
    </ScrollView>
  );
}
