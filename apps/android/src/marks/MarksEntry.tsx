// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Entering a test's, the exam's or a component's marks (#239, Marks-test,
// Marks-exam, answers 440, 447 and 451): the test's name, «الاختبار» or the
// component's with the class, its day or period and maximum, how many of its
// pupils are done and a bar; then one pupil at a time in class-list order, the
// previous one above, a tap going back to them, and the next one below; the
// mark typed on the app's keypad, with «النقطة أكبر من 20، ولا تُحفظ.» while it
// is above the maximum; «غائب عن الفرض» or «غائب عن الاختبار», and «التالي»,
// which records the mark at once and moves on. An empty cell is skipped, a mark
// erased is cleared, and «مسح» on an empty cell clears «غائب». A component has
// no «غائب»: under the pupil comes what was recorded for it in the period, and
// the attendance proposal with «اعتماد المقترح», which puts it on the keypad,
// both heard with the pupil; a mark above points since lowered must be retyped.
// What was just recorded shows at once, before the history's write ends. The
// current pupil is a live region, so TalkBack says who comes next, and that a
// mark is above the maximum. After the last pupil comes the summary.

import { entryCheck, marksFor, setMark, type MarkValue } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { entrySheet, nextStep, pressKey, startBuffer, withQuarter } from './entry-rules';
import { EntrySummary } from './EntrySummary';
import { MarkPad } from './MarkPad';
import { assessmentData } from './marks-rules';
import { componentSheet, isComponent, periodName, useEvidence } from './component-rules';
import { EntryHead } from './EntryHead';

export type MarksEntryProps = {
  readonly courseId: string;
  readonly term: number;
  /** The test to enter; the term's exam when neither it nor a component is given. */
  readonly testId?: string;
  /** The component to enter, by the month in primary. */
  readonly componentId?: string;
  readonly month?: string;
  readonly onDone: () => void;
};

export function MarksEntry({ courseId, term, testId, componentId, month, onDone }: MarksEntryProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, record, today } = useAppData();
  const language = currentLanguage();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const data = assessmentData(profile);
  const sheet = useMemo(() => {
    if (data === null) return null;
    if (componentId === undefined) return entrySheet(context, data, courseId, term, testId);
    return componentSheet(context, data, courseId, term, componentId, month, today());
  }, [context, data, courseId, term, testId, componentId, month, today]);
  const [typed, setTyped] = useState<ReadonlyMap<string, MarkValue | null>>(new Map());
  const marks = useMemo(() => {
    const found = sheet === null ? new Map<string, MarkValue>() : marksFor(state, courseId, term, sheet.target);
    for (const [pupilId, value] of typed) {
      if (value === null) found.delete(pupilId);
      else found.set(pupilId, value);
    }
    return found;
  }, [state, sheet, courseId, term, typed]);
  const [index, setIndex] = useState(0);
  const [buffer, setBuffer] = useState(() =>
    startBuffer(sheet === null ? undefined : marks.get(sheet.listed[0]?.id ?? '')),
  );
  const said = useEvidence(t, context, courseId, sheet, sheet?.listed[index]?.id);
  if (sheet === null) return null;
  const { listed, max, target } = sheet;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const check = entryCheck(
    listed.map((pupil) => pupil.id),
    marks,
    max,
  );
  const shownOf = (value: MarkValue | undefined) =>
    value === undefined ? t('marks.entry.empty') : value === 'absent' ? t('marks.entry.absentShort') : String(value);
  const spokenOf = (value: MarkValue | undefined) =>
    value === undefined
      ? t('marks.entry.emptySpoken')
      : value === 'absent'
        ? t('marks.entry.absentSpoken')
        : String(value);
  const go = (to: number) => {
    setIndex(to);
    setBuffer(startBuffer(marks.get(listed[to]?.id ?? '')));
  };
  const store = (pupilId: string, value: MarkValue | null) => {
    record(setMark({ courseId, term, target, pupilId }, value, max));
    setTyped((before) => new Map(before).set(pupilId, value));
  };
  const key = (pressed: Parameters<typeof pressKey>[1]) => {
    if (pressed === 'erase' && buffer === '' && pupil !== undefined && marks.get(pupil.id) === 'absent') {
      store(pupil.id, null);
    } else setBuffer(pressKey(buffer, pressed));
  };
  const pupil = listed[index];
  const over = buffer !== '' && buffer !== '.' && Number(buffer) > max;
  const next = () => {
    if (pupil === undefined) return;
    const step = nextStep(buffer, marks.get(pupil.id), max);
    if (step.kind === 'over') return;
    if (step.kind === 'record') store(pupil.id, step.value);
    go(index + 1);
  };
  const absent = () => {
    if (pupil === undefined) return;
    if (marks.get(pupil.id) !== 'absent') store(pupil.id, 'absent');
    go(index + 1);
  };
  const previous = listed[index - 1];
  const following = listed[index + 1];
  const shown = buffer !== '' ? buffer : pupil === undefined ? '' : shownOf(marks.get(pupil.id));
  const done = check.entered + check.absent;
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <EntryHead
        heading={t('marks.entry.heading', {
          title: isolate(sheet.title ?? t('marks.entry.exam')),
          class: isolate(courseLabel(t, state, profile, courseId, true)),
        })}
        line={
          isComponent(sheet)
            ? t('marks.componentMarks.period', { period: periodName(t, profile.months, sheet.target, term), max })
            : t('marks.entry.line', { day: dayName(t, sheet.day, language, profile), max })
        }
        done={done}
        total={listed.length}
      />
      {pupil === undefined ? (
        <EntrySummary
          max={max}
          over={check.over.length}
          kind={target.kind}
          entered={check.entered}
          absent={check.absent}
          empty={check.empty.length}
          notOnList={check.notOnList.map((id) => ({ id, name: state.pupils.get(id)?.name ?? id }))}
          onClear={(pupilId) => store(pupilId, null)}
          onDone={onDone}
          onRestart={() => go(0)}
        />
      ) : (
        <>
          {previous !== undefined && (
            <Pressable
              testID="entry-previous"
              accessibilityRole="button"
              accessibilityLabel={t('marks.entry.back', {
                name: isolate(previous.name),
                mark: spokenOf(marks.get(previous.id)),
              })}
              onPress={() => go(index - 1)}
              style={styles.near}
            >
              <Text style={styles.number}>{index}</Text>
              <Text style={[styles.body, styles.grow, align]}>{previous.name}</Text>
              <Text style={styles.value}>{shownOf(marks.get(previous.id))}</Text>
            </Pressable>
          )}
          <View
            testID="entry-current"
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={[
              t('marks.entry.current', {
                name: isolate(pupil.name),
                mark: buffer !== '' ? buffer : spokenOf(marks.get(pupil.id)),
                max,
              }),
              ...(over ? [t('marks.entry.over', { max })] : []),
              ...(said === null ? [] : [said.text]),
            ].join('. ')}
            style={styles.card}
          >
            <View style={styles.near}>
              <Text style={styles.number}>{index + 1}</Text>
              <Text style={[styles.name, styles.grow, align]}>{pupil.name}</Text>
            </View>
            <View style={styles.mark}>
              <Text testID="entry-shown" style={styles.shown}>
                {shown}
              </Text>
              <Text style={styles.outOf}>{t('marks.entry.outOf', { max })}</Text>
            </View>
            {over && (
              <Text testID="entry-over" style={styles.error}>
                {t('marks.entry.over', { max })}
              </Text>
            )}
            {said !== null && (
              <Text testID="entry-evidence" style={[styles.note, align]}>
                {said.text}
              </Text>
            )}
          </View>
          {following !== undefined && (
            <View style={styles.near}>
              <Text style={styles.number}>{index + 2}</Text>
              <Text style={[styles.body, styles.grow, align]}>{following.name}</Text>
              <Text style={styles.value}>{shownOf(marks.get(following.id))}</Text>
            </View>
          )}
          <MarkPad onKey={key} onQuarter={(quarter) => setBuffer(withQuarter(buffer, quarter))} />
          <View style={styles.actions}>
            {said === null ? (
              <Button
                testID="entry-absent"
                variant="line"
                label={t(target.kind === 'test' ? 'marks.entry.absentTest' : 'marks.entry.absentExam')}
                onPress={absent}
              />
            ) : (
              said.proposed !== null && (
                <Button
                  testID="entry-proposal"
                  variant="line"
                  label={t('marks.componentMarks.useProposal')}
                  onPress={() => setBuffer(String(said.proposed))}
                />
              )
            )}
            <View style={styles.next}>
              <Button testID="entry-next" label={t('marks.entry.next')} onPress={next} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-8'], paddingTop: spacing['space-12'] },
  near: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    minHeight: sizes.target,
    minWidth: sizes.target,
  },
  card: {
    gap: spacing['space-2'],
    paddingVertical: spacing['space-10'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1.5,
    borderColor: colors.board,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing['space-6'],
    direction: 'ltr',
  },
  shown: { ...typography.stat, fontSize: 44, lineHeight: 52, color: colors.ink, minWidth: 40, textAlign: 'center' },
  outOf: { ...typography.body, fontSize: 18, color: colors.ink2 },
  number: { ...typography.small, width: 22, color: colors.ink2, textAlign: 'center' },
  value: { ...typography.label, color: colors.ink2 },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  next: { flexGrow: 1, flexBasis: 160 },
  name: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink2 },
  note: { ...typography.caption, color: colors.ink2 },
  error: { ...typography.caption, color: colors['error-ink'], textAlign: 'center' },
});
