// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إصدار جديد للمخطط» (#322, Pack-release, R-4.2-17, R-4.2-18, answers 487 and
// 488), from the row on a class's plan or in Settings: what the newer release
// changes and who signed it, then the classes on an older release of the pack,
// each moved on its own. The move is offered only with every release between on
// the phone, and says why not otherwise; a sync that changes the questions
// starts the answers again; once moved, the class follows the newer release,
// and the screen says so with a way back to its plan.

import { movePlan, packKey, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { classesOn } from './release-rules';
import { ReleaseChanges } from './ReleaseChanges';
import { ReleaseMove } from './ReleaseMove';

export type PackReleaseProps = {
  readonly courseId: string;
  readonly release: string;
  readonly onCourse: (courseId: string) => void;
  readonly onPlan: (courseId: string) => void;
};

export function PackRelease({ courseId, release, onCourse, onPlan }: PackReleaseProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const day: Day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const [moved, setMoved] = useState<{ courseId: string; answered: boolean } | null>(null);
  const course = state.courses.get(courseId);
  const className = state.classes.get(course?.classId ?? '')?.name ?? '';
  const packId = course?.pack?.id;
  const newer = packId === undefined ? undefined : context.ref.packs.get(packKey(packId, release));
  const plan = useMemo(() => movePlan(context, courseId, release), [context, courseId, release]);
  const classes = newer === undefined ? [] : classesOn(context, newer);
  const shown = plan.ok ? plan : null;
  const steps = shown === null ? null : { from: shown.from, to: shown.to, steps: shown.steps };
  const note = (message: string, testID: string) => (
    <Notice testID={testID} icon={controlIcon('info')} message={message} />
  );
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
      {steps !== null && <ReleaseChanges {...steps} />}
      {moved?.courseId === courseId ? (
        <>
          {note(t('packRelease.moved', { class: isolate(className), release: isolate(release) }), 'release-moved')}
          {moved.answered && <Text style={[styles.sub, align]}>{t('packRelease.movedAnswers')}</Text>}
          <Button testID="release-back" label={t('packRelease.back')} onPress={() => onPlan(courseId)} />
        </>
      ) : (
        <>
          {classes.length > 0 && (
            <ChipGroup
              testID="release-classes"
              label={t('packRelease.classes')}
              selected={classes.some((one) => one.courseId === courseId) ? courseId : ''}
              choices={classes.map((one) => ({
                value: one.courseId,
                label: t('packRelease.chip', { class: isolate(one.name), release: isolate(one.release) }),
              }))}
              onSelect={(id) => id !== courseId && onCourse(id)}
            />
          )}
          {classes.length === 0 && note(t('packRelease.none', { release: isolate(release) }), 'release-none')}
          {!plan.ok &&
            (plan.problem === 'missing' || plan.problem === 'broken') &&
            note(t(`packRelease.${plan.problem}`, { release: isolate(plan.release ?? release) }), 'release-problem')}
          {shown !== null && (
            <ReleaseMove
              key={[courseId, ...shown.questions.map((one) => `${one.layer?.id ?? ''}/${one.decision.id}`)].join(' ')}
              context={context}
              courseId={courseId}
              className={className}
              plan={shown}
              day={day}
              onStay={() => onPlan(courseId)}
              onMoved={(answered) => setMoved({ courseId, answered })}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
