// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مواعيد الفروض» (#221, Test-schedule, R-4.7-09, R-4.7-34, answers 268 and
// 269): a chip for each of the teacher's courses, then the course's tests in
// date order, each with its day, its session and «ثابت», «مشترك» when the
// teacher ticked it, and «حذف». The next exams follow, from the calendar,
// never the pack, with how sure their date is. «إضافة فرض» opens the form,
// which shows what moves before saving. A save or a removal can be taken
// back with «تراجع». Tests come from the teacher only, so there is no
// «من رزنامة المؤسسة» badge until the school's calendar exists.

import { nextExams, type ScheduledTest } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { sessionLabel } from '../extra/AddSessionsChanges';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { AddTest } from './AddTest';
import { courseLabel, termName } from './course-label';
import { courseTests } from './test-rules';

type Said = { readonly kind: 'added' | 'removed'; readonly test: ScheduledTest } | null;

export function TestSchedule({ courseId, onCourse }: { courseId: string; onCourse: (courseId: string) => void }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, profile, year, calendar, packs, today, record, newId } = data;
  const language = currentLanguage();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const [adding, setAdding] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const undone = useRef<ScheduledTest | null>(null);
  const removing = useRef<string | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;

  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const courses = [...state.courses.values()].filter((one) => state.classes.has(one.classId));
  const label = (id: string): string => courseLabel(t, state, profile, id);
  const tests = courseTests(context, courseId);
  const exams = course === undefined ? null : nextExams(context, courseId, today());
  const className = label(courseId);

  const add = (draft: Omit<ScheduledTest, 'id'>) => {
    const test = { ...draft, id: newId() };
    record({ kind: 'test.set', test });
    setAdding(false);
    setSaid({ kind: 'added', test });
  };
  const remove = (test: ScheduledTest) => {
    if (removing.current === test.id) return;
    removing.current = test.id;
    record({ kind: 'test.removed', id: test.id });
    setSaid({ kind: 'removed', test });
  };
  const undo = () => {
    if (said === null || undone.current === said.test) return;
    undone.current = said.test;
    removing.current = null;
    record(said.kind === 'added' ? { kind: 'test.removed', id: said.test.id } : { kind: 'test.set', test: said.test });
    setSaid(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
        {courses.length > 1 && (
          <ChipGroup
            testID="tests-class"
            label={t('tests.class')}
            selected={courseId}
            onSelect={(id) => {
              setAdding(false);
              onCourse(id);
            }}
            choices={courses.map((one) => ({ value: one.id, label: label(one.id) }))}
          />
        )}
        <Text style={[styles.body, align]}>{t('tests.intro')}</Text>
        {tests.length === 0 ? (
          <Text testID="tests-none" style={[styles.note, align]}>
            {t('tests.none', { class: className })}
          </Text>
        ) : (
          tests.map((test) => (
            <View key={test.id} testID={`tests-row-${test.id}`} style={styles.card}>
              <View accessible style={styles.grow}>
                <Text style={[styles.title, align]}>{test.title}</Text>
                <Text style={[styles.body, align]}>
                  {`${dayName(t, test.day, language, profile)} · ${sessionLabel(t, data, test, test.day)}`}
                </Text>
                <View style={styles.tags}>
                  <Badge label={t('tests.fixed')} />
                  {test.common === true && <Badge label={t('tests.common')} />}
                </View>
              </View>
              <IconButton
                testID={`tests-remove-${test.id}`}
                icon={controlIcon('cross')}
                accessibilityLabel={t('tests.removeSpoken', { title: isolate(test.title) })}
                onPress={() => remove(test)}
              />
            </View>
          ))
        )}
        {exams !== null && (
          <View testID="tests-exams" accessible style={styles.card}>
            <View style={styles.grow}>
              <Text style={[styles.title, align]}>{t('tests.exams', { term: termName(t, exams.term) })}</Text>
              <Badge label={t(exams.confidence === 'announced' ? 'tests.announced' : 'tests.expected')} />
              <Text style={[styles.body, align]}>
                {t('tests.examsLine', { day: dayName(t, exams.from, language, profile) })}
              </Text>
            </View>
          </View>
        )}
        {schoolClass === undefined ? null : adding ? (
          <AddTest
            context={context}
            courseId={courseId}
            className={className}
            onCancel={() => setAdding(false)}
            onSave={add}
          />
        ) : (
          <Button
            testID="tests-open-add"
            label={t('tests.add', { class: className })}
            onPress={() => {
              setSaid(null);
              setAdding(true);
            }}
          />
        )}
      </ScrollView>
      {said !== null && (
        <Snackbar
          testID="tests-said"
          message={t(said.kind === 'added' ? 'tests.added' : 'tests.removed', { title: isolate(said.test.title) })}
          undoLabel={t('tests.undo')}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  grow: { flex: 1, gap: spacing['space-4'], alignItems: 'flex-start' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-6'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
