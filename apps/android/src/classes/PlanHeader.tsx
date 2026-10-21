// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The head of a class's plan (#225, Plan, R-2.3-01, R-4.2-09): the parallel
// classes to switch between, then the pack the class is pinned to, its status,
// release and timing, a newer release when the app has one (answer 329), who
// keyed it, and where it comes from, with the pack's details and the class's
// own changes a tap away. Until the issuer publishes packs itself, the curators
// are named as a body, without names (answer 291). An example pack says it is
// not a plan instead of who keyed it.

import { changesFor, parallelCourses, type Context, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { ChipGroup } from '../components/Chip';
import { RowLink } from '../components/RowLink';
import { SegmentedControl } from '../components/SegmentedControl';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { NewerRelease } from '../plan/NewerRelease';
import { packSource, packTiming } from '../plan/pack-labels';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Choice = { readonly value: string; readonly label: string };

export type PlanHeaderProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly pack: PlanPack | null;
  readonly onCourse?: (courseId: string) => void;
  readonly onChanges?: () => void;
  readonly onDetails?: () => void;
};

/** The class and its parallel classes, to switch between in place (R-4.7-36). */
export function ParallelClasses({
  context,
  courseId,
  onCourse,
}: {
  readonly context: Context;
  readonly courseId: string;
  readonly onCourse: (courseId: string) => void;
}) {
  const t = useText();
  const { state } = context;
  const name = (id: string) => state.classes.get(state.courses.get(id)?.classId ?? '')?.name ?? id;
  const parallel = parallelCourses(context, courseId);
  if (parallel.length === 0) return null;
  const choices = [courseId, ...parallel.map((course) => course.id)]
    .map((id) => ({ value: id, label: name(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const common = {
    testID: 'plan-parallel',
    label: t('classPlan.parallel'),
    selected: courseId,
    onSelect: (id: string) => id !== courseId && onCourse(id),
  };
  return choices.length <= 3 ? (
    <SegmentedControl {...common} choices={choices as [Choice, Choice] | [Choice, Choice, Choice]} />
  ) : (
    <ChipGroup {...common} choices={choices} />
  );
}

export function PlanHeader({ context, courseId, pack, onCourse, onChanges, onDetails }: PlanHeaderProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      {onCourse !== undefined && <ParallelClasses context={context} courseId={courseId} onCourse={onCourse} />}
      {pack !== null && (
        <View testID="plan-pack" style={[styles.card, { gap: spacing['space-8'] }]}>
          <View style={{ flexDirection: 'row', direction }}>
            <Badge label={t(`plan.status.${pack.status}`)} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('classPlan.packTitle', { release: pack.release })}
          </Text>
          <NewerRelease
            testID="plan-newer"
            packs={context.ref.packs.values()}
            pinned={{ id: pack.id, release: pack.release }}
          />
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
      {pack !== null && onChanges !== undefined && (
        <RowLink
          testID="plan-changes"
          icon={controlIcon('tune')}
          title={t('classPlan.changes')}
          description={changeCount(t, context, courseId)}
          onPress={onChanges}
        />
      )}
    </>
  );
}

/** How many of the class's own changes are in force, or that it follows the pack as it is. */
export function changeCount(t: ReturnType<typeof useText>, context: Context, courseId: string): string {
  const course = context.state.courses.get(courseId);
  const count = changesFor(context.state.decisions, courseId).length;
  const name = isolate(context.state.classes.get(course?.classId ?? '')?.name ?? '');
  return count === 0 ? t('planChanges.none', { class: name }) : t('planChanges.count', { count });
}
