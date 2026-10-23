// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ملف مجلس القسم» for a class, subject and term (#244, Council, Council-t2,
// R-3.7-11 to R-3.7-17, answer 470): the class and subject, chips for the
// year's terms, the school and the school year marked «داخلي · سري», then the
// figures, the comparison with the previous term and the ranks, the pupils for
// remediation and distinction with the teacher's thresholds, and the term's
// attendance from the roll-call book. Every figure is taken over the pupils
// with an average, on the full value. A term without averages says so.

import { councilPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { colors, spacing, typography } from '../design/tokens';
import { yearShown } from '../documents/document-data';
import { useDocumentData } from '../documents/useDocumentData';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { CouncilFigures } from './CouncilFigures';
import { CouncilLists } from './CouncilLists';
import { CouncilRanks } from './CouncilRanks';
import { attendanceLine } from './council-rules';
import { assessmentData, termWord } from './marks-rules';

export type MarksCouncilProps = {
  readonly courseId: string;
  readonly term: number;
  readonly onTerm: (term: number) => void;
};

export function MarksCouncil({ courseId, term, onTerm }: MarksCouncilProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const documents = useDocumentData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const data = assessmentData(profile);
  const day = today();
  const pack = useMemo(
    () => (data === null ? null : councilPack(context, data, courseId, term, day)),
    [context, data, courseId, term, day],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  const school = state.schools.get(room?.schoolId ?? '')?.name ?? '';
  const terms = [...year.terms].map((one) => one.number).sort((a, b) => a - b);
  const nameOf = (pupilId: string) => state.pupils.get(pupilId)?.name ?? '';
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
      <Text testID="council-line" style={[styles.heading, align]}>
        {`${courseLabel(t, state, profile, courseId, true)} · ${termWord(t, term)}`}
      </Text>
      {terms.length > 1 && (
        <ChipGroup
          testID="council-term"
          label={t('marks.termLabel')}
          selected={String(term)}
          onSelect={(value) => onTerm(Number(value))}
          choices={terms.map((one) => ({ value: String(one), label: termWord(t, one) }))}
        />
      )}
      <View style={styles.head}>
        <Text style={[styles.note, styles.grow, align]}>
          {t('marks.council.schoolYear', { school, year: yearShown(documents) })}
        </Text>
        <Text style={[styles.title, align]}>{t('documents.confidential')}</Text>
      </View>
      {pack === null || pack.counted === 0 ? (
        <Text testID="council-empty" style={[styles.body, align]}>
          {t(pack === null ? 'marks.council.unavailable' : 'marks.council.noAverages')}
        </Text>
      ) : (
        <>
          <CouncilFigures pack={pack} nameOf={nameOf} />
          <CouncilRanks pack={pack} term={term} nameOf={nameOf} />
          <CouncilLists pack={pack} nameOf={nameOf} />
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('marks.council.attendanceTitle')}
          </Text>
          <Text testID="council-attendance" style={[styles.body, align]}>
            {attendanceLine(t, pack.attendance)}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingBottom: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  grow: { flex: 1 },
  heading: { ...typography.label, color: colors.ink2 },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
