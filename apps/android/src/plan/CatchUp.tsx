// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «خيارات الاستدراك» (#228, Catchup, R-4.7-24 to R-4.7-28, answers 349 to
// 352): the class's pace on top, then the options in order. Shortening the
// item in progress is the teacher's, in class. The pack's buffers used and
// left before the next exams, and TD's own sessions and items. The merges
// and optional items the pack proposes for that term, each confirmed alone
// as the exam window records it, with «تراجع» at once and a take-back in
// the list of decisions. Then adding catch-up sessions. Nothing applies
// without the teacher's confirmation, and every change can be taken back.

import {
  catchUp,
  decisionOf,
  pace,
  termCheck,
  type PlanChoice,
  type PlanDecision,
  type RecordEvent,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Snackbar } from '../components/Snackbar';
import { colors, radius, spacing, typography } from '../design/tokens';
import { paceLine } from '../classes/class-rules';
import { courseLabel, termName } from '../exams/course-label';
import { Decisions } from '../exams/Decisions';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { buffersLine, tdLine } from './catch-up-rules';

export type CatchUpProps = { readonly courseId: string; readonly onAdd?: () => void };

type Said = { readonly undo: readonly RecordEvent[]; readonly message: string } | null;

export function CatchUp({ courseId, onAdd }: CatchUpProps) {
  const t = useText();
  const data = useAppData();
  const { state, profile, recordAll, newId, today } = data;
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const day = today();
  const context = useMemo(() => coreContext(data), [data]);
  const options = useMemo(() => catchUp(context, courseId, day), [context, courseId, day]);
  const line = useMemo(
    () => paceLine(t, { pace: pace(context, courseId, day), check: termCheck(context, courseId, day) }),
    [t, context, courseId, day],
  );
  const [said, setSaid] = useState<Said>(null);
  const appliedFrom = useRef<typeof state | null>(null);
  const className = courseLabel(t, state, profile, courseId);
  const quoted = (title: string) => t('tests.quoted', { title: isolate(title) });
  const once = (events: readonly RecordEvent[], next: Said) => {
    if (appliedFrom.current === state) return;
    appliedFrom.current = state;
    recordAll([...events]);
    setSaid(next);
  };
  const confirm = (choice: PlanChoice) => {
    const decision = decisionOf(choice, newId(), courseId);
    once([{ kind: 'plan.decided', decision }], {
      undo: [{ kind: 'plan.undecided', id: decision.id }],
      message: t('catchUp.confirmed'),
    });
  };
  const takeBack = (decision: PlanDecision) =>
    once([{ kind: 'plan.undecided', id: decision.id }], {
      undo: [{ kind: 'plan.decided', decision }],
      message: t('examWindow.takenBack'),
    });
  const undo = () => {
    if (said !== null) once(said.undo, null);
  };
  const choiceLabel = (choice: PlanChoice) =>
    choice.kind === 'leave-out'
      ? t('examWindow.leaveOut', { item: quoted(choice.item.title) })
      : t('examWindow.mergeItems', { first: quoted(choice.items[0].title), second: quoted(choice.items[1].title) });
  const rung = (number: number, title: string, children: ReactNode) => (
    <View testID={`catchup-rung-${number}`} style={styles.rung}>
      <Text style={styles.number}>{number}</Text>
      <View style={styles.grow}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );

  if (options === null) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.body, align, { padding: spacing['space-16'] }]}>{t('catchUp.noPlan')}</Text>
      </View>
    );
  }
  const term = options.term === null ? '' : termName(t, options.term);
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + (said === null ? spacing['space-24'] : 96),
          },
        ]}
      >
        <Text style={[styles.sub, align]}>{className}</Text>
        <Text testID="catchup-pace" style={[styles.title, align]}>
          {line}
        </Text>
        <Text style={[styles.body, align]}>{t('catchUp.intro')}</Text>
        {rung(1, t('catchUp.compress'), <Text style={[styles.sub, align]}>{t('catchUp.compressLine')}</Text>)}
        {rung(
          2,
          options.own ? t('catchUp.buffersOwn') : t('catchUp.buffers'),
          <>
            <Text testID="catchup-buffers" style={[styles.sub, align]}>
              {buffersLine(t, options)}
            </Text>
            {options.td !== null && (
              <Text testID="catchup-td" style={[styles.sub, align]}>
                {tdLine(t, options.td)}
              </Text>
            )}
          </>,
        )}
        {rung(
          3,
          t('catchUp.choices'),
          <>
            <Text style={[styles.sub, align]}>{t('catchUp.choicesLine')}</Text>
            {options.choices.length === 0 ? (
              <Text testID="catchup-no-choices" style={[styles.sub, align]}>
                {options.own
                  ? t('catchUp.ownChoices')
                  : options.term === null
                    ? t('catchUp.noExams')
                    : t('catchUp.noChoices', { term })}
              </Text>
            ) : (
              options.choices.map((choice, index) => (
                <View key={index} style={styles.choice}>
                  <Text style={[styles.body, align]}>{choiceLabel(choice)}</Text>
                  <Button
                    testID={`catchup-confirm-${index}`}
                    variant="line"
                    label={t('catchUp.confirm')}
                    accessibilityHint={choiceLabel(choice)}
                    onPress={() => confirm(choice)}
                  />
                </View>
              ))
            )}
          </>,
        )}
        <Decisions context={context} courseId={courseId} className={className} onTakeBack={takeBack} />
        {rung(
          4,
          t('catchUp.add'),
          <>
            <Text style={[styles.sub, align]}>{t('catchUp.addLine')}</Text>
            {onAdd !== undefined && (
              <Button testID="catchup-add" variant="line" label={t('catchUp.addOne')} onPress={onAdd} />
            )}
          </>,
        )}
        <Text style={[styles.sub, align]}>{t('catchUp.never')}</Text>
      </ScrollView>
      {said !== null && (
        <Snackbar
          testID="catchup-done"
          message={said.message}
          undoLabel={t('planItem.undo')}
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
  rung: {
    flexDirection: 'row',
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  number: { ...typography.label, color: colors.ink2, minWidth: 20 },
  grow: { flex: 1, gap: spacing['space-8'] },
  choice: { gap: spacing['space-6'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
