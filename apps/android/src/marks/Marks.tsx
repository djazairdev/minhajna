// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التقويم والنقاط» for one class and subject (#238, Marks, answers 435 and
// 436): the class and subject, chips for the year's terms, open on the term
// whose dates hold today, then the card naming the formula its averages
// follow, with the release and the rules year, and the rows built so far:
// «التقويم المستمر», with the setup in force for the term, and «مواعيد
// الفروض». A subject with no continuous assessment says so, and a class
// archived after a reorientation shows its setup but takes no new one
// (#231). The rows of the grade book, appreciations and the export come
// with their own issues.

import { termNumberOn } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { courseLabel } from '../exams/course-label';
import { assessmentData, courseMarks, formulaText, setupLine, termWord } from './marks-rules';

export type MarksProps = {
  readonly courseId: string;
  /** The term chosen; the one whose dates hold today when not given. */
  readonly term?: number;
  readonly onTerm: (term: number) => void;
  readonly onSetup: (term: number) => void;
  readonly onTests: () => void;
};

export function Marks({ courseId, term: chosen, onTerm, onSetup, onTests }: MarksProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, today } = useAppData();
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
