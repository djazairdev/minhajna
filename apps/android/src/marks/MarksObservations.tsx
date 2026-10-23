// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ملاحظات وصفية» for a class, subject and term whose marks observations
// replace (#240, P-Obs, answer 464): the line «ملاحظات وصفية · 1 ابتدائي ب»,
// «الفصل الأول: ملاحظات بدل النقاط», chips for the class's subjects observed
// that term when there are several, the counts, a note that each observation is
// chosen by hand, then each pupil on the term's list with «مكتسب»,
// «في طور الاكتساب» and «غير مكتسب». A tap records the choice at once, and a
// second tap on the chosen one clears it. Nothing is filled in for the teacher.
// A class archived after a reorientation shows each pupil's observation but
// takes no new one.

import { OBSERVATIONS, setObservation, type Observation } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { colors, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { assessmentData, termWord } from './marks-rules';
import { countsLine, observationName, observationSheet, observedCourses } from './observation-rules';

export type MarksObservationsProps = {
  readonly courseId: string;
  readonly term: number;
  /** Opens another of the class's subjects observed that term. */
  readonly onCourse: (courseId: string) => void;
};

export function MarksObservations({ courseId, term, onCourse }: MarksObservationsProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, record, today } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const data = assessmentData(profile);
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  if (data === null || room === undefined) return null;
  const courses = observedCourses(t, context, data, profile, courseId, term);
  const { listed, observations, counts } = observationSheet(context, courseId, term, today());
  const archived = room.archivedFrom !== undefined;
  const choose = (pupilId: string, value: Observation) =>
    record(setObservation({ courseId, term, pupilId }, observations.get(pupilId) === value ? null : value));
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
      <View accessible style={styles.head}>
        <Text testID="observations-line" style={[styles.title, align]}>
          {t('marks.observations.line', { class: courseLabel(t, state, profile, courseId, true) })}
        </Text>
        <Text style={[styles.note, align]}>{t('marks.observations.instead', { term: termWord(t, term) })}</Text>
      </View>
      {courses.length > 1 && (
        <ChipGroup
          testID="observations-subject"
          label={t('marks.observations.subject')}
          selected={courseId}
          onSelect={onCourse}
          choices={courses.map((one) => ({ value: one.courseId, label: one.name }))}
        />
      )}
      <Text testID="observations-counts" style={[styles.counts, align]}>
        {countsLine(t, counts)}
      </Text>
      <Text style={[styles.note, align]}>
        {t(archived ? 'marks.observations.archived' : 'marks.observations.byHand')}
      </Text>
      {listed.length === 0 && <Text style={[styles.body, align]}>{t('marks.observations.noPupils')}</Text>}
      {listed.map((pupilId, index) => {
        const name = `${index + 1}. ${isolate(state.pupils.get(pupilId)?.name ?? pupilId)}`;
        const value = observations.get(pupilId) ?? null;
        return archived ? (
          <Text key={pupilId} testID={`observation-${pupilId}`} style={[styles.body, align]}>
            {`${name}: ${value === null ? t('marks.observations.none') : observationName(t, value)}`}
          </Text>
        ) : (
          <View key={pupilId} style={styles.row}>
            <ChipGroup
              testID={`observation-${pupilId}`}
              label={name}
              selected={value}
              onSelect={(chosen) => choose(pupilId, chosen)}
              choices={OBSERVATIONS.map((one) => ({ value: one, label: observationName(t, one) }))}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  head: { gap: spacing['space-2'] },
  row: {
    paddingVertical: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  title: { ...typography.label, color: colors.ink },
  counts: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
