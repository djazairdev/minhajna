// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التقويم والنقاط» for one class and subject (#238, Marks, answers 435 and
// 436): the class and subject, chips for the year's terms, open on the term
// whose dates hold today, then the card naming the formula its averages follow,
// with the release and the rules year, and the rows built so far: «التقويم
// المستمر», with the setup in force for the term; «تقويم أثناء الحصة», with
// today's session, disabled with none; «نقاط التقويم المستمر», with how many of
// the term's component cells are filled (answer 451); one row for each of the
// term's tests, with its day and how many of its pupils are done, or «لا فرض في
// هذا الفصل بعد» opening «مواعيد الفروض»; «الاختبار», with its window's first
// day, for a subject with a term exam (#239, answer 444); and «مواعيد الفروض».
// A subject with no continuous assessment says so, and a class archived after a
// reorientation shows its setup and marks but takes no new ones (#231). The
// rows of the grade book, appreciations and the export come with their own
// issues.

import { captureSession, termNumberOn, termTests } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { courseLabel } from '../exams/course-label';
import { dayName } from '../today/DayMark';
import { captureLine } from './capture-rules';
import { componentProgress } from './component-rules';
import { entryDone, entrySheet, levelScale, type EntrySheet } from './entry-rules';
import { assessmentData, courseMarks, formulaText, setupLine, termWord } from './marks-rules';

export type MarksProps = {
  readonly courseId: string;
  /** The term chosen; the one whose dates hold today when not given. */
  readonly term?: number;
  readonly onTerm: (term: number) => void;
  readonly onSetup: (term: number) => void;
  readonly onTests: () => void;
  /** Opens capture during today's session. */
  readonly onCapture: () => void;
  /** Opens the term's component marks. */
  readonly onComponents: (term: number) => void;
  /** Opens the entry of a test's marks, or of the exam's without a test. */
  readonly onEntry: (term: number, testId?: string) => void;
};

export function Marks(props: MarksProps) {
  const { courseId, term: chosen, onTerm, onSetup, onTests, onCapture, onComponents, onEntry } = props;
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const app = useAppData();
  const { state, profile, year, calendar, calendarRelease, packs, today } = app;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const data = assessmentData(profile);
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  if (course === undefined || room === undefined) return null;
  const term = chosen ?? termNumberOn(year, today());
  const marks = data === null ? null : courseMarks(state, data, courseId, term);
  const terms = [...year.terms].map((one) => one.number).sort((a, b) => a - b);
  const heading = courseLabel(t, state, profile, courseId, true);
  const archived = room.archivedFrom !== undefined;
  const assessment = marks?.assessment ?? null;
  const setup = () => {
    if (data === null) return { line: t('marks.unavailable') };
    if (assessment === null) return { line: t('marks.noAssessment') };
    const line = setupLine(t, assessment);
    return archived ? { line } : { line, press: () => onSetup(term) };
  };
  const row = setup();
  const sheetOf = (testId?: string) => (data === null ? null : entrySheet(context, data, courseId, term, testId));
  const entryLine = (sheet: EntrySheet) =>
    t('marks.entry.rowLine', {
      day: dayName(t, sheet.day, currentLanguage(), profile),
      done: entryDone(context, courseId, term, sheet).done,
      total: sheet.listed.length,
    });
  const tests = termTests(context, courseId, term);
  const exams = sheetOf();
  const entering = data !== null && marks !== null && levelScale(data, room.level) !== null;
  const session = captureSession(context, courseId, today());
  return (
    <ScrollView
      style={styles.screen}
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
      <Text testID="marks-class" style={[styles.heading, align]}>
        {heading}
      </Text>
      {terms.length > 1 && (
        <ChipGroup
          testID="marks-term"
          label={t('marks.termLabel')}
          selected={String(term)}
          onSelect={(value) => onTerm(Number(value))}
          choices={terms.map((one) => ({ value: String(one), label: termWord(t, one) }))}
        />
      )}
      {marks !== null && (
        <View testID="marks-formula" accessible style={styles.card}>
          <Text style={[styles.title, align]}>{t('marks.formulaTitle')}</Text>
          <Text style={[styles.body, align]}>{formulaText(t, marks.formula)}</Text>
          <Text style={[styles.note, align]}>
            {marks.preset === undefined
              ? t('marks.release', { release: marks.release })
              : t('marks.releaseRules', { release: marks.release, year: marks.preset.rulesYear })}
          </Text>
        </View>
      )}
      <View style={styles.rows}>
        <RowLink
          testID="marks-setup"
          icon={controlIcon('tune')}
          title={t('marks.setupRow')}
          description={row.line}
          disabled={row.press === undefined}
          onPress={row.press ?? (() => undefined)}
        />
        {entering && (
          <RowLink
            testID="marks-capture"
            icon={controlIcon('pupils')}
            title={t('marks.during.title')}
            description={session === null ? t('marks.during.noSession') : captureLine(t, app, session)}
            disabled={archived || session === null}
            onPress={onCapture}
          />
        )}
        {entering && assessment !== null && (
          <RowLink
            testID="marks-components"
            icon={controlIcon('pencil')}
            title={t('marks.componentMarks.title')}
            description={t('marks.componentMarks.rowLine', componentProgress(context, data, courseId, term, today()))}
            disabled={archived}
            onPress={() => onComponents(term)}
          />
        )}
        {entering && tests.length === 0 && (
          <RowLink
            testID="marks-no-tests"
            icon={controlIcon('pencil')}
            title={t('marks.entry.noTests')}
            description={t('tests.openLine')}
            onPress={onTests}
          />
        )}
        {entering &&
          tests.map((test) => {
            const sheet = sheetOf(test.id);
            return (
              <RowLink
                key={test.id}
                testID={`marks-test-${test.id}`}
                icon={controlIcon('pencil')}
                title={test.title}
                description={sheet === null ? '' : entryLine(sheet)}
                disabled={archived || sheet === null}
                onPress={() => onEntry(term, test.id)}
              />
            );
          })}
        {entering && marks.formula !== undefined && (
          <RowLink
            testID="marks-exam"
            icon={controlIcon('pencil')}
            title={t('marks.entry.exam')}
            description={exams === null ? t('marks.entry.noExam') : entryLine(exams)}
            disabled={archived || exams === null}
            onPress={() => onEntry(term)}
          />
        )}
        <RowLink
          testID="marks-tests"
          icon={controlIcon('check')}
          title={t('tests.open')}
          description={t('tests.openLine')}
          onPress={onTests}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  heading: { ...typography.label, color: colors.ink2 },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  rows: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
