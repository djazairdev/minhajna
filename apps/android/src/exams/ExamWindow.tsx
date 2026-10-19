// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The answers to an exam-window warning (#221, Exam-window, R-4.7-32,
// answers 268 and 269): the items past the window, each with the day it
// would fall on, and the window's dates. Nothing applies before the teacher
// chooses. «دمج موارد أو ترك الاختيارية», when the pack allows any, lists
// the leave-outs and merges, a suggestion ticked, and what the ticks leave
// after the exams before «تأكيد». «إضافة حصة استدراكية» opens the make-up
// day. «تأجيله بعد الاختبارات» keeps the items for the first sessions after
// the exams. «لاحقاً» keeps the warning. A decision can be taken back with
// «تراجع», and every decision made for the class is listed, each with its
// own button to take it back. A choice that shares an item with one ticked
// cannot be ticked with it. A second tap before the first shows does
// nothing.

import {
  decisionOf,
  pastWindow,
  planChoices,
  postponeOf,
  suggestedChoices,
  withPlanChanges,
  type PlanChoice,
  type PlanDecision,
  type RecordEvent,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { RadioCardGroup } from '../components/RadioCard';
import { Snackbar } from '../components/Snackbar';
import { colors, radius, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { courseLabel, termName } from './course-label';
import { Decisions } from './Decisions';
import { quotedItems } from './window-rules';

type Answer = 'merge' | 'make-up' | 'postpone';
type Said = { readonly undo: readonly RecordEvent[]; readonly message: string } | null;

export type ExamWindowProps = {
  readonly courseId: string;
  readonly onMakeUp: () => void;
  readonly onLater: () => void;
};

export function ExamWindow({ courseId, onMakeUp, onLater }: ExamWindowProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, packs, today, recordAll, newId } = useAppData();
  const language = currentLanguage();
  const comma = language === 'ar' ? '، ' : ', ';
  const day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const warning = useMemo(() => pastWindow(context, courseId, day), [context, courseId, day]);
  const choices = useMemo(() => (warning === null ? [] : planChoices(context, warning)), [context, warning]);
  const suggested = useMemo(
    () => (warning === null ? [] : suggestedChoices(context, warning, choices, day)),
    [context, warning, choices, day],
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [ticked, setTicked] = useState<readonly number[] | null>(null);
  const [said, setSaid] = useState<Said>(null);
  const undone = useRef<Said>(null);
  const appliedFrom = useRef<typeof state | null>(null);
  const picked = ticked ?? suggested;
  const preview = useMemo(() => {
    if (warning === null || picked.length === 0) return null;
    const decisions = picked.map((i) => decisionOf(choices[i], `preview-${i}`, courseId));
    return pastWindow(withPlanChanges(context, { decisions }), courseId, day);
  }, [context, warning, picked, choices, courseId, day]);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const className = courseLabel(t, state, profile, courseId);
  const quoted = (title: string) => t('tests.quoted', { title: isolate(title) });

  const apply = (decisions: readonly PlanDecision[], message: string) => {
    if (decisions.length === 0 || appliedFrom.current === state) return;
    appliedFrom.current = state;
    recordAll(decisions.map((decision) => ({ kind: 'plan.decided', decision })));
    setSaid({ undo: decisions.map((decision) => ({ kind: 'plan.undecided', id: decision.id })), message });
    setAnswer(null);
    setTicked(null);
  };
  const undo = () => {
    if (said === null || undone.current === said) return;
    undone.current = said;
    recordAll(said.undo);
    setSaid(null);
    setTicked(null);
  };
  const takeBack = (decision: PlanDecision) => {
    if (appliedFrom.current === state) return;
    appliedFrom.current = state;
    recordAll([{ kind: 'plan.undecided', id: decision.id }]);
    setSaid({ undo: [{ kind: 'plan.decided', decision }], message: t('examWindow.takenBack') });
    setTicked(null);
  };
  const sharing = (index: number) => {
    const items = (choice: PlanChoice) =>
      choice.kind === 'leave-out' ? [choice.item.id] : choice.items.map((item) => item.id);
    const own = items(choices[index]);
    return picked.some((other) => other !== index && items(choices[other]).some((id) => own.includes(id)));
  };
  const choiceLabel = (choice: PlanChoice) =>
    choice.kind === 'leave-out'
      ? t('examWindow.leaveOut', { item: quoted(choice.item.title) })
      : t('examWindow.mergeItems', { first: quoted(choice.items[0].title), second: quoted(choice.items[1].title) });

  const answers = [
    ...(choices.length > 0
      ? [{ value: 'merge' as const, label: t('examWindow.merge'), description: t('examWindow.mergeLine') }]
      : []),
    { value: 'make-up' as const, label: t('examWindow.makeUp'), description: t('examWindow.makeUpLine') },
    { value: 'postpone' as const, label: t('examWindow.postpone'), description: t('examWindow.postponeLine') },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingBottom: insets.bottom + (said === null ? spacing['space-24'] : 96),
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
          },
        ]}
      >
        {warning === null ? (
          <Text testID="exam-window-none" style={[styles.body, align]}>
            {t('examWindow.none', { class: className })}
          </Text>
        ) : (
          <>
            <View accessible style={styles.card}>
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
              {warning.items.map(({ item, lands }) => (
                <Text key={item.id} style={[styles.body, align]}>
                  {`${isolate(item.title)} · ${
                    lands === null
                      ? t('examWindow.never')
                      : t('examWindow.lands', { day: dayName(t, lands, language, profile) })
                  }`}
                </Text>
              ))}
              <Text style={[styles.note, align]}>
                {t('examWindow.window', {
                  term: termName(t, warning.term),
                  from: dayName(t, warning.window.from, language, profile),
                  to: dayName(t, warning.window.to, language, profile),
                  confidence: t(
                    warning.window.confidence === 'announced' ? 'examWindow.announced' : 'examWindow.expected',
                  ),
                })}
              </Text>
            </View>
            <Text style={[styles.body, align]}>{t('examWindow.ask', { class: className })}</Text>
            <RadioCardGroup
              testID="exam-window-answer"
              label={t('examWindow.options')}
              choices={answers}
              selected={answer}
              onSelect={setAnswer}
            />
            {answer === 'merge' && (
              <View style={styles.group}>
                {choices.map((choice, index) => (
                  <CheckRow
                    key={index}
                    testID={`exam-window-choice-${index}`}
                    label={choiceLabel(choice)}
                    checked={picked.includes(index)}
                    disabled={!picked.includes(index) && sharing(index)}
                    onCheckedChange={(checked) =>
                      setTicked(checked ? [...picked, index].sort((a, b) => a - b) : picked.filter((i) => i !== index))
                    }
                  />
                ))}
                {picked.length > 0 && (
                  <Text testID="exam-window-preview" style={[styles.body, align]}>
                    {preview === null
                      ? t('examWindow.allBack')
                      : t('examWindow.stillPast', {
                          items: quotedItems(
                            t,
                            preview.items.map(({ item }) => item),
                            comma,
                          ),
                        })}
                  </Text>
                )}
                <Button
                  testID="exam-window-confirm"
                  label={t('examWindow.confirm')}
                  disabled={picked.length === 0}
                  onPress={() =>
                    apply(
                      picked.map((i) => decisionOf(choices[i], newId(), courseId)),
                      t('examWindow.decided'),
                    )
                  }
                />
              </View>
            )}
            {answer === 'make-up' && (
              <Button testID="exam-window-make-up" label={t('examWindow.makeUp')} onPress={onMakeUp} />
            )}
            {answer === 'postpone' && (
              <Button
                testID="exam-window-postpone"
                label={t('examWindow.postpone')}
                onPress={() =>
                  apply(
                    [postponeOf(warning, newId())],
                    t('examWindow.postponed', {
                      items: quotedItems(
                        t,
                        warning.items.map(({ item }) => item),
                        comma,
                      ),
                    }),
                  )
                }
              />
            )}
            <Button testID="exam-window-later" variant="line" label={t('examWindow.later')} onPress={onLater} />
            <Text style={[styles.note, align]}>{t('examWindow.laterLine')}</Text>
          </>
        )}
        <Decisions context={context} courseId={courseId} className={className} onTakeBack={takeBack} />
      </ScrollView>
      {said !== null && (
        <Snackbar
          testID="exam-window-said"
          message={said.message}
          undoLabel={t('examWindow.undo')}
          onUndo={undo}
          bottomOffset={insets.bottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  card: {
    gap: spacing['space-6'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  group: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
