// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moving one class to a newer release (#322, Pack-release, answers 487 and
// 488): its place in the plan does not change and its recorded sessions
// stay on their release; the effect on its buffer before the exams with the
// answers given so far; each change the newer release makes unclear, asked
// with the items it can go to, those that no longer fit after the answers
// before it disabled, or not carrying it, and changing an answer clears the
// ones after it; what is not carried; how its own changes and each layer it
// follows are carried, with the rule; then staying, which records nothing,
// or the move, offered once every question is answered.

import {
  fittingChoices,
  moveEvents,
  movedContext,
  termCheck,
  type Context,
  type Day,
  type MovePlan,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { RadioCard } from '../components/RadioCard';
import { spacing } from '../design/tokens';
import { SaveProblem } from '../calendar/SaveProblem';
import { useCalendarSave } from '../calendar/useCalendarSave';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { decisionText, effectLine, listLine, questionText, titleIn } from './release-rules';

type Moving = Extract<MovePlan, { ok: true }>;

export type ReleaseMoveProps = {
  readonly context: Context;
  readonly courseId: string;
  readonly className: string;
  readonly plan: Moving;
  readonly day: Day;
  readonly onStay: () => void;
  readonly onMoved: (answered: boolean) => void;
};

export function ReleaseMove({ context, courseId, className, plan, day, onStay, onMoved }: ReleaseMoveProps) {
  const t = useText();
  const { direction } = useLocale();
  const { newId } = useAppData();
  const writer = useCalendarSave();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [answers, setAnswers] = useState<readonly (string | null | undefined)[]>(() =>
    plan.questions.map(() => undefined),
  );
  const given = useMemo(() => answers.map((one) => one ?? null), [answers]);
  const complete = answers.length === plan.questions.length && answers.every((one) => one !== undefined);
  const effect = useMemo(() => {
    try {
      const after = movedContext(context, courseId, plan, given, day);
      return effectLine(t, className, termCheck(context, courseId, day), termCheck(after, courseId, day));
    } catch {
      return null;
    }
  }, [t, context, courseId, plan, given, day, className]);
  const fitting = useMemo(
    () => plan.questions.map((_, index) => fittingChoices(context, courseId, plan, index, { answers: given, day })),
    [context, courseId, plan, given, day],
  );
  const choose = (index: number, value: string | null) =>
    setAnswers((now) => plan.questions.map((_, at) => (at < index ? now[at] : at === index ? value : undefined)));
  const [refused, setRefused] = useState(false);
  const move = async () => {
    if (!complete || writer.isBusy()) return;
    let events;
    try {
      events = moveEvents(context, courseId, plan, given, { newId, day });
    } catch {
      setRefused(true);
      return;
    }
    setRefused(false);
    if (await writer.save(events, context.state)) onMoved(events.length > 1);
  };
  const name = isolate(className);
  const lists = plan.lists.filter((list) => list.changes > 0);
  return (
    <>
      <Text style={[styles.sub, align]}>{t('packRelease.keep')}</Text>
      {effect !== null && (
        <Text testID="release-effect" style={[styles.body, align]}>
          {effect}
        </Text>
      )}
      {plan.questions.length > 0 && (
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('packRelease.ask', { class: name })}
        </Text>
      )}
      {plan.questions.map((question, index) => {
        const asked = questionText(t, context, courseId, plan, question);
        return (
          <View
            key={index}
            testID={`release-question-${index}`}
            accessibilityRole="radiogroup"
            accessibilityLabel={asked}
            style={{ gap: spacing['space-8'] }}
          >
            <Text style={[styles.body, align]}>{asked}</Text>
            {question.choices.map((choice) => (
              <RadioCard
                key={choice}
                testID={`release-answer-${index}-${choice}`}
                label={t('tests.quoted', { title: isolate(titleIn(plan.to, choice)) })}
                description={t('packRelease.choice', { release: isolate(plan.to.release) })}
                selected={answers[index] === choice}
                disabled={writer.busy || !fitting[index]?.includes(choice)}
                onPress={() => choose(index, choice)}
              />
            ))}
            <RadioCard
              testID={`release-answer-${index}-none`}
              label={t('packRelease.notCarried')}
              description={t('packRelease.notCarriedSub', {
                release: isolate(plan.from.release),
                to: isolate(plan.to.release),
              })}
              selected={answers[index] === null}
              disabled={writer.busy}
              onPress={() => choose(index, null)}
            />
          </View>
        );
      })}
      {plan.questions.length > 0 && <Text style={[styles.sub, align]}>{t('packRelease.answerNote')}</Text>}
      {plan.removed.length > 0 && (
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('packRelease.removed')}
        </Text>
      )}
      {plan.removed.map((one, index) => (
        <Text key={index} testID={`release-removed-${index}`} style={[styles.body, align]}>
          {t('packRelease.removedLine', {
            what: decisionText(t, context, courseId, plan, one.decision),
            release: isolate(plan.to.release),
          })}
        </Text>
      ))}
      {lists.length > 0 && (
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('packRelease.layers')}
        </Text>
      )}
      {lists.map((list, index) => (
        <View key={index} testID={`release-list-${index}`} style={{ gap: spacing['space-4'] }}>
          <Text style={[styles.body, align]}>
            {list.layer === undefined ? t('packRelease.mine') : t('tests.quoted', { title: isolate(list.layer.title) })}
          </Text>
          <Text style={[styles.sub, align]}>{listLine(t, list)}</Text>
        </View>
      ))}
      {lists.length > 0 && <Text style={[styles.sub, align]}>{t('packRelease.rule')}</Text>}
      <SaveProblem testID="release-save-failed" problem={writer.problem ?? (refused ? 'changed' : null)} />
      <Button
        testID="release-move"
        label={
          complete
            ? t('packRelease.move', { class: name, release: isolate(plan.to.release) })
            : t('packRelease.answerFirst')
        }
        disabled={!complete || writer.busy}
        onPress={move}
      />
      <Button
        testID="release-stay"
        variant="line"
        label={t('packRelease.stay', { release: isolate(plan.from.release) })}
        disabled={writer.busy}
        onPress={onStay}
      />
    </>
  );
}
