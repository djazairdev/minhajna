// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes on the class plan (#225, R-4.7-36, R-4.7-37, answers
// 286 and 292 to 294). A warning when this class and a parallel one would
// be two sessions or more of plan content apart at their next common test
// or exam window: how far, where each would be, «مواءمة» when the class
// behind can take the other's next item now, which leaves the gap as it
// is, and «تجاهل», which hides it until the gap grows. Below, «مواءمة موقع
// قسم آخر»: each parallel class behind this one can take its next item,
// after a question, unless the warning already offers it. Aligning is one
// change in that class's layer, undone from its changes; its records never
// change.

import {
  alignChange,
  courseSetup,
  driftBefore,
  findPackItem,
  parallelCourses,
  recordChange,
  type Context,
  type Day,
  type Drift,
  type PackItem,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { dismissDrift, isDismissed, useDismissedDrifts } from '../plan/drift-dismissal';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { termName } from './plan-labels';

export type ParallelPanelProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly day: Day;
};

export function ParallelPanel({ context, courseId, day }: ParallelPanelProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { profile, record, newId } = useAppData();
  const dismissed = useDismissedDrifts();
  const [hidden, setHidden] = useState(false);
  const warning = useMemo(() => {
    const drift = driftBefore(context, courseId, day);
    if (drift === null) return null;
    const [behindId, aheadId] = drift.behind ? [courseId, drift.other] : [drift.other, courseId];
    const offer = alignChange(context, behindId, aheadId, day, '');
    return { drift, behindId, aheadId, offered: offer?.kind === 'move' ? offer.item : undefined };
  }, [context, courseId, day]);
  const drift = warning?.drift ?? null;
  const behind = useMemo(
    () =>
      parallelCourses(context, courseId).flatMap((other) => {
        const change = alignChange(context, other.id, courseId, day, '');
        return change === null || change.kind !== 'move' ? [] : [{ courseId: other.id, item: change.item }];
      }),
    [context, courseId, day],
  );
  const name = (id: string) => {
    const course = context.state.courses.get(id);
    return isolate(context.state.classes.get(course?.classId ?? '')?.name ?? id);
  };
  const at = (item: PackItem | undefined) =>
    item === undefined ? t('classPlan.driftEnd') : t('tests.quoted', { title: isolate(item.title) });

  const alignOne = (behindId: string, aheadId: string, itemTitleText: string) =>
    Alert.alert(
      t('classPlan.alignOne', { other: name(behindId), class: name(aheadId) }),
      t('classPlan.alignAsk', { other: name(behindId), class: name(aheadId), item: itemTitleText }),
      [
        { text: t('planItem.cancel'), style: 'cancel' },
        {
          text: t('planItem.goOn'),
          onPress: () => {
            const change = alignChange(context, behindId, aheadId, day, newId());
            try {
              if (change === null) throw new RangeError('Not behind any more');
              record(recordChange(context, change));
            } catch {
              Alert.alert(t('planItem.title'), t('planItem.refused'));
            }
          },
        },
      ],
    );

  const card = ({ drift: one, behindId, aheadId, offered }: Warning) => {
    const before =
      one.before.kind === 'test'
        ? t('tests.quoted', { title: isolate(one.before.title) })
        : t('classPlan.driftExams', { term: termName(t, one.before.term) });
    return (
      <View testID="plan-drift" style={styles.card}>
        <View accessible style={styles.text}>
          <Badge label={t('classPlan.driftBadge')} variant="warning" />
          <Text style={[styles.title, align]}>
            {t('classPlan.drift', {
              count: one.gap,
              here: name(courseId),
              there: name(one.other),
              before,
              day: dayName(t, one.before.day, currentLanguage(), profile),
            })}
          </Text>
          <Text style={[styles.body, align]}>
            {t('classPlan.driftWhere', {
              behind: name(behindId),
              behindAt: at(one.behind ? one.here : one.there),
              ahead: name(aheadId),
              aheadAt: at(one.behind ? one.there : one.here),
            })}
          </Text>
        </View>
        {offered !== undefined && (
          <Button
            testID="plan-drift-align"
            label={t('classPlan.alignOne', { other: name(behindId), class: name(aheadId) })}
            onPress={() =>
              alignOne(behindId, aheadId, t('tests.quoted', { title: titleOf(context, behindId, offered) }))
            }
          />
        )}
        <Button
          testID="plan-drift-dismiss"
          variant="line"
          label={t('classPlan.driftDismiss')}
          onPress={() => {
            dismissDrift(courseId, one, day);
            setHidden(true);
          }}
        />
      </View>
    );
  };

  const warned = warning !== null && !isDismissed(dismissed, courseId, warning.drift);
  const offeredFor = warned && warning.offered !== undefined && !warning.drift.behind ? warning.drift.other : undefined;
  const rows = behind.filter((one) => one.courseId !== offeredFor);
  return (
    <>
      {warned && card(warning)}
      {hidden && drift !== null && isDismissed(dismissed, courseId, drift) && (
        <Text testID="plan-drift-hidden" accessibilityLiveRegion="polite" style={[styles.body, align]}>
          {t('classPlan.driftHidden')}
        </Text>
      )}
      {rows.length > 0 && (
        <View style={styles.group}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('classPlan.alignTitle', { class: name(courseId) })}
          </Text>
          {rows.map((one) => (
            <RowLink
              key={one.courseId}
              testID={`plan-align-${one.courseId}`}
              icon={controlIcon('tune')}
              title={t('classPlan.alignOne', { other: name(one.courseId), class: name(courseId) })}
              onPress={() =>
                alignOne(one.courseId, courseId, t('tests.quoted', { title: titleOf(context, one.courseId, one.item) }))
              }
            />
          ))}
          <Text style={[styles.body, align]}>{t('classPlan.alignNote')}</Text>
        </View>
      )}
    </>
  );
}

type Warning = {
  readonly drift: Drift;
  readonly behindId: string;
  readonly aheadId: string;
  /** The item `behindId` would take to align with `aheadId`, when it can now. */
  readonly offered: string | undefined;
};

/** An item's title in a course's plan, isolated, or its ID when the plan no longer has it. */
function titleOf(context: Context, courseId: string, itemId: string): string {
  return isolate(findPackItem(courseSetup(context, courseId).pack, itemId)?.title ?? itemId);
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
  group: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink2 },
});
