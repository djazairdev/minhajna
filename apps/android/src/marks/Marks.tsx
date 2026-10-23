// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التقويم والنقاط» for one class and subject (#238, Marks, answers 435 and
// 436): the class and subject, chips for the year's terms, open on the term
// whose dates hold today, then the card naming the formula its averages follow,
// with the release and the rules year, and the rows built so far: «التقويم
// المستمر», with the setup in force for the term; «تقويم أثناء الحصة», with
// today's session, disabled with none; «نقاط التقويم المستمر», with how many of
// the term's component cells are filled (answer 451); «كشف النقاط», with how
// many pupils have an average (#240, answer 458); one row for each of the
// term's tests, with its day and how many of its pupils are done, or «لا فرض في
// هذا الفصل بعد» opening «مواعيد الفروض»; «الاختبار», with its window's first
// day, for a subject with a term exam (#239, answer 444); in lycée, «الأعمال
// التطبيقية» or «الشفهي» when the formula the administration chose weighs it
// (#240, answer 463); and «مواعيد الفروض». In a term whose marks descriptive
// observations replace, such as 1AP's first, the card says so and «ملاحظات
// وصفية», with how many pupils have one, takes the place of the rows of marks,
// tests, the exam and «كشف النقاط» (answer 464). A subject with no continuous
// assessment says so, and a class archived after a reorientation shows its
// setup and marks but takes no new ones (#231). «التقديرات», with how many
// pupils have a phrase, follows «كشف النقاط» (#241, answer 465), then «التصدير
// الفصلي», ready or with how many marks and appreciations are missing (#242,
// answer 466). Once the term's last day has passed, a line says its marks
// change only through «تصحيح بعد الفصل», whose row takes the place of the rows
// that enter marks (#243, answer 468). «ملف مجلس القسم», with the class
// average and how many reach the threshold, follows the export (#244).

import { captureSession, courseObserved, gradeBook, termEnded, termFixes, termNumberOn } from '@minhajna/core';
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
import { useText } from '../text/i18n';
import { courseLabel } from '../exams/course-label';
import { captureLine } from './capture-rules';
import { councilRowLine } from './council-rules';
import { componentProgress } from './component-rules';
import { EntryRows } from './EntryRows';
import { levelScale } from './entry-rules';
import { assessmentData, courseMarks, formulaText, setupLine, termWord } from './marks-rules';
import { appreciationList, appreciationSheet, progressLine } from './appreciation-rules';
import { courseExport, exportLine } from './export-rules';
import { observationSheet } from './observation-rules';

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
  /** Opens the term's grade book. */
  readonly onBook: (term: number) => void;
  /** Opens the entry of a test's marks, or of the exam's without a test. */
  readonly onEntry: (term: number, testId?: string) => void;
  /** Opens the entry of lycée's practical work or oral. */
  readonly onPart: (term: number, part: 'practical' | 'oral') => void;
  /** Opens the term's descriptive observations. */
  readonly onObservations: (term: number) => void;
  /** Opens the term's appreciations. */
  readonly onAppreciations: (term: number) => void;
  /** Opens the term's export. */
  readonly onExport: (term: number) => void;
  /** Opens the corrections after the term. */
  readonly onFix: (term: number) => void;
  /** Opens the term's class-council pack. */
  readonly onCouncil: (term: number) => void;
};

export function Marks(props: MarksProps) {
  const { courseId, term: chosen, onTerm, onSetup, onTests, onCapture, onComponents, onBook, onEntry, onPart } = props;
  const { onObservations, onAppreciations, onExport, onFix, onCouncil } = props;
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
  const entering = data !== null && marks !== null && levelScale(data, room.level) !== null;
  const session = captureSession(context, courseId, today());
  const observed = entering && courseObserved(state, data, courseId, term);
  const marking = entering && !observed;
  const ended = marking && termEnded(year, term, today());
  const book = marking ? gradeBook(context, data, courseId, term) : null;
  const phrases = marking && book !== null && appreciationList(profile) !== null;
  const apprec = phrases ? appreciationSheet(context, data, courseId, term, book) : null;
  const exported = apprec === null ? null : courseExport(context, profile, courseId, term, book);
  const noted = observed ? observationSheet(context, courseId, term, today()) : null;
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
          <Text style={[styles.body, align]}>
            {observed ? t('marks.observations.instead', { term: termWord(t, term) }) : formulaText(t, marks.formula)}
          </Text>
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
        {noted !== null && (
          <RowLink
            testID="marks-observations"
            icon={controlIcon('pencil')}
            title={t('marks.observations.title')}
            description={t('marks.observations.rowLine', {
              done: noted.listed.length - noted.counts.missing,
              total: noted.listed.length,
            })}
            onPress={() => onObservations(term)}
          />
        )}
        {ended && (
          <>
            <Text testID="marks-ended" style={[styles.note, align]}>
              {t('marks.fix.ended', { term: termWord(t, term) })}
            </Text>
            <RowLink
              testID="marks-fix"
              icon={controlIcon('pencil')}
              title={t('marks.fix.title')}
              description={t('marks.fix.rowLine', { count: termFixes(state, courseId, term).length })}
              onPress={() => onFix(term)}
            />
          </>
        )}
        {marking && !ended && assessment !== null && (
          <RowLink
            testID="marks-components"
            icon={controlIcon('pencil')}
            title={t('marks.componentMarks.title')}
            description={t('marks.componentMarks.rowLine', componentProgress(context, data, courseId, term, today()))}
            disabled={archived}
            onPress={() => onComponents(term)}
          />
        )}
        {book !== null && (
          <RowLink
            testID="marks-book"
            icon={controlIcon('homework')}
            title={t('marks.book.title')}
            description={t('marks.book.rowLine', { counted: book.figures.counted, total: book.rows.length })}
            onPress={() => onBook(term)}
          />
        )}
        {apprec !== null && (
          <RowLink
            testID="marks-appreciations"
            icon={controlIcon('pencil')}
            title={t('marks.appreciations.title')}
            description={progressLine(t, apprec)}
            onPress={() => onAppreciations(term)}
          />
        )}
        {exported !== null && (
          <RowLink
            testID="marks-export"
            icon={controlIcon('check')}
            title={t('marks.export.title')}
            description={exportLine(t, exported)}
            onPress={() => onExport(term)}
          />
        )}
        {book !== null && book.formula !== null && (
          <RowLink
            testID="marks-council"
            icon={controlIcon('homework')}
            title={t('marks.council.title')}
            description={councilRowLine(t, book)}
            onPress={() => onCouncil(term)}
          />
        )}
        {marking && !ended && (
          <EntryRows
            context={context}
            data={data}
            courseId={courseId}
            term={term}
            formula={marks.formula}
            archived={archived}
            onTests={onTests}
            onEntry={onEntry}
            onPart={onPart}
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
