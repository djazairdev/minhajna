// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's plan (#37, the plan rows of Class and Plan): the pack it follows
// and its parallel classes (#225), where the class stands, buffers first, with
// the sessions left before the next exams and what the plan still needs by
// then; then each unit's items with the days they were taught or the day the
// plan would reach them, their stages, where the class is, and where the plan
// says it should be, marked only as a reference (PRD §4.7). TD items follow in
// their own list, then the class's tests, fixed rows the lessons flow around,
// which open «مواعيد الفروض» (#221). A session outside the timetable for the
// class opens from the foot (#219). A warning card tops the plan while items
// would fall past the next exams, and items postponed past them are tagged
// until taught. Under it, parallel classes drifting apart before a common
// test or the exams, and aligning a class that is behind (#225). Under the
// check line, the September check printed for an inspector (#225), and,
// while the class has used buffers or is behind, its catch-up options (#228).

import {
  behindPlan,
  courseSetup,
  formatDay,
  pace,
  planView,
  termCheck,
  type PackItem,
  type PlanRow,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useCountMinutes } from '../settings/preferences';
import { currentLanguage, useText } from '../text/i18n';
import { paceLine } from './class-rules';
import { ExamWarnings } from '../exams/ExamWarnings';
import { courseTests } from '../exams/test-rules';
import { postponedItems } from '../exams/window-rules';
import { dayMonth, rowDays, rowSpoken, rowTags, untilLine } from './plan-labels';
import { isolate } from '../week/grid-labels';
import { ParallelPanel } from './ParallelPanel';
import { PlanHeader } from './PlanHeader';

export type ClassPlanProps = {
  readonly courseId: string;
  readonly onExtra?: () => void;
  readonly onTests?: () => void;
  readonly onExamWindow?: () => void;
  readonly onCourse?: (courseId: string) => void;
  readonly onDetails?: () => void;
  readonly onChanges?: () => void;
  readonly onLayers?: () => void;
  readonly onEditList?: () => void;
  readonly onCatchUp?: () => void;
  readonly onItem?: (itemId: string) => void;
  readonly onCheck?: () => void;
};

export function ClassPlan(props: ClassPlanProps) {
  const { courseId, onExtra, onTests, onExamWindow, onCourse, onDetails, onChanges, onLayers, onItem, onCheck } = props;
  const { onEditList, onCatchUp } = props;
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const minutes = useCountMinutes();
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const day = today();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const view = useMemo(() => planView(context, courseId, day), [context, courseId, day]);
  const check = useMemo(() => termCheck(context, courseId, day), [context, courseId, day]);
  const tests = courseTests(context, courseId);
  const postponed = useMemo(() => postponedItems(context, courseId), [context, courseId]);
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const subject = profile.subjects.find((candidate) => candidate.code === course?.subject);
  const paced = useMemo(() => (view === null ? null : pace(context, courseId, day)), [view, context, courseId, day]);
  const line = paceLine(
    t,
    { pace: paced, check },
    minutes && view !== null ? courseSetup(context, courseId).sessionMinutes : undefined,
  );

  const row = (one: PlanRow, later = false) => {
    const days = rowDays(one);
    return (
      <Pressable
        key={one.item.id}
        testID={`plan-${one.item.id}`}
        accessible
        accessibilityLabel={rowSpoken(t, one, comma, later)}
        {...(onItem !== undefined && {
          accessibilityRole: 'button' as const,
          accessibilityHint: t('classPlan.openItem'),
          onPress: () => onItem(one.item.id),
        })}
        style={({ pressed }) => [
          styles.row,
          one.position && styles.here,
          pressed && onItem !== undefined && styles.pressed,
        ]}
      >
        <Text style={[styles.day, days?.ahead === true && styles.ahead]}>{days?.text ?? ''}</Text>
        <View style={styles.grow}>
          <Text style={[styles.title, one.status === 'open' && styles.ahead, align]}>{one.item.title}</Text>
          <View style={styles.tags}>
            {rowTags(t, one, later).map((tag) => (
              <Text key={tag.id} style={[styles.tag, tag.id === 'position' && styles.tagHere]}>
                {tag.label}
              </Text>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };
  const units = (rows: readonly PlanRow[], heads: readonly PackItem[], later: ReadonlySet<string>) => {
    const unitOf = (one: PlanRow) => one.item.unit ?? '';
    const ids = [...new Set(rows.map(unitOf))];
    return ids.map((id) => (
      <View key={id || 'none'} style={styles.group}>
        {id !== '' && (
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {heads.find((unit) => unit.id === id)?.title ?? id}
          </Text>
        )}
        {rows.filter((one) => unitOf(one) === id).map((one) => row(one, later.has(one.item.id)))}
      </View>
    ));
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-16'],
        },
      ]}
    >
      <Text style={[styles.note, align]}>
        {[schoolClass?.name, subject === undefined ? course?.subject : localized(subject.name)]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <PlanHeader
        context={context}
        courseId={courseId}
        pack={view?.pack ?? null}
        {...(onCourse !== undefined && { onCourse })}
        {...(onDetails !== undefined && { onDetails })}
        {...(onChanges !== undefined && { onChanges })}
        {...(onLayers !== undefined && { onLayers })}
        {...(onEditList !== undefined && { onEditList })}
      />
      {onExamWindow !== undefined && (
        <ExamWarnings context={context} day={day} courseId={courseId} onOpen={onExamWindow} />
      )}
      {view !== null && <ParallelPanel key={courseId} context={context} courseId={courseId} day={day} />}
      <View testID="plan-pace" accessible style={styles.card}>
        <Text style={[styles.title, align]}>{line}</Text>
        {check !== null && <Text style={[styles.body, align]}>{untilLine(t, check)}</Text>}
        {check?.moved != null && (
          <Text
            testID="plan-exam-moved"
            accessibilityLabel={t('calendarView.update.moved', {
              range: t('calendarView.range', { from: formatDay(check.moved.from), to: formatDay(check.moved.to) }),
              reason: check.moved.reason,
            })}
            style={[styles.note, align]}
          >
            <Text style={styles.struck}>
              {t('calendarView.range', { from: formatDay(check.moved.from), to: formatDay(check.moved.to) })}
            </Text>
            {` · ${t('calendarView.update.entry.reason', { reason: isolate(check.moved.reason) })}`}
          </Text>
        )}
        {view !== null && <Text style={[styles.note, align]}>{t('classPlan.reference')}</Text>}
        {(paced?.lost.rotation ?? 0) > 0 && (
          <Text style={[styles.note, align]}>{t('calendarView.groups.cost', { count: paced!.lost.rotation })}</Text>
        )}
      </View>
      {onCatchUp !== undefined && behindPlan(paced) && (
        <RowLink testID="plan-catchup" icon={controlIcon('tune')} title={t('catchUp.open')} onPress={onCatchUp} />
      )}
      {check !== null && onCheck !== undefined && (
        <RowLink testID="plan-sept-check" icon={controlIcon('print')} title={t('septCheck.open')} onPress={onCheck} />
      )}
      {view === null ? (
        <Text style={[styles.body, align]}>{t('classPlan.noPack')}</Text>
      ) : (
        <>
          {units(view.main, view.units, postponed)}
          {view.td.length > 0 && (
            <View style={styles.group}>
              <Text accessibilityRole="header" style={[styles.label, align]}>
                {t('classPlan.td')}
              </Text>
              {view.td.map((one) => row(one))}
            </View>
          )}
        </>
      )}
      {(tests.length > 0 || onTests !== undefined) && (
        <View style={styles.group}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('tests.title')}
          </Text>
          {tests.map((test) => (
            <View key={test.id} testID={`plan-test-${test.id}`} accessible style={styles.row}>
              <Text style={styles.day}>{dayMonth(test.day)}</Text>
              <View style={styles.grow}>
                <Text style={[styles.title, align]}>{test.title}</Text>
                <View style={styles.tags}>
                  <Text style={styles.tag}>{t('tests.fixed')}</Text>
                  {test.common === true && <Text style={styles.tag}>{t('tests.common')}</Text>}
                </View>
              </View>
            </View>
          ))}
          {onTests !== undefined && (
            <Button testID="plan-tests" variant="line" label={t('tests.open')} onPress={onTests} />
          )}
        </View>
      )}
      {onExtra !== undefined && <Button testID="plan-extra" variant="line" label={t('extra.open')} onPress={onExtra} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  group: { gap: spacing['space-2'] },
  row: {
    flexDirection: 'row',
    gap: spacing['space-12'],
    minHeight: 48,
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { backgroundColor: colors.sheet },
  here: { backgroundColor: colors.sheet, borderRadius: radius['radius-control'] },
  grow: { flex: 1, gap: spacing['space-4'] },
  day: { ...typography.caption, color: colors.ink, minWidth: 76 },
  ahead: { color: colors.ink2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-6'] },
  tag: {
    ...typography.caption,
    color: colors.ink2,
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-tag'],
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tagHere: { color: colors.ink, borderColor: colors.ink },
  label: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  struck: { textDecorationLine: 'line-through' },
});
