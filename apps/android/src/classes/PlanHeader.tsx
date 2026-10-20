// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The head of a class's plan (#225, Plan, R-2.3-01, R-4.2-09): the parallel
// classes to switch between, then the pack the class is pinned to, its
// status, release and timing, who keyed it, and where it comes from, with
// the pack's details a tap away. Until the issuer publishes packs itself,
// the curators are named as a body, without names (answer 291). An example
// pack says it is not a plan instead of who keyed it.

import { parallelCourses, type Context, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { ChipGroup } from '../components/Chip';
import { RowLink } from '../components/RowLink';
import { SegmentedControl } from '../components/SegmentedControl';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { packSource, packTiming } from '../plan/pack-labels';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';

type Choice = { readonly value: string; readonly label: string };

export type PlanHeaderProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly pack: PlanPack | null;
  readonly onCourse?: (courseId: string) => void;
  readonly onDetails?: () => void;
};

export function PlanHeader({ context, courseId, pack, onCourse, onDetails }: PlanHeaderProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state } = context;
  const name = (id: string) => state.classes.get(state.courses.get(id)?.classId ?? '')?.name ?? id;
  const parallel = parallelCourses(context, courseId);
  const choices = [courseId, ...parallel.map((course) => course.id)]
    .map((id) => ({ value: id, label: name(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <>
      {parallel.length > 0 &&
        onCourse !== undefined &&
        (choices.length <= 3 ? (
          <SegmentedControl
            testID="plan-parallel"
            label={t('classPlan.parallel')}
            choices={choices as [Choice, Choice] | [Choice, Choice, Choice]}
            selected={courseId}
            onSelect={(id) => id !== courseId && onCourse(id)}
          />
        ) : (
          <ChipGroup
            testID="plan-parallel"
            label={t('classPlan.parallel')}
            choices={choices}
            selected={courseId}
            onSelect={(id) => id !== courseId && onCourse(id)}
          />
        ))}
      {pack !== null && (
        <View testID="plan-pack" style={[styles.card, { gap: spacing['space-8'] }]}>
          <View style={{ flexDirection: 'row', direction }}>
            <Badge label={t(`plan.status.${pack.status}`)} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('classPlan.packTitle', { release: pack.release })}
          </Text>
          <Text style={[styles.sub, align]}>
            {pack.status === 'example' ? packTiming(t, pack) : `${packTiming(t, pack)} · ${t('classPlan.keyedBy')}`}
          </Text>
          <Text style={[styles.body, align]}>{packSource(t, pack)}</Text>
          {onDetails !== undefined && (
            <RowLink
              testID="plan-details"
              icon={controlIcon('info')}
              title={t('classPlan.details')}
              onPress={onDetails}
            />
          )}
        </View>
      )}
    </>
  );
}
