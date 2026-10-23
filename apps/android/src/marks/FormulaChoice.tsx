// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «صيغة المعدل، كما تحددها الإدارة للمادة» on «كشف النقاط» (#240, L-Marks,
// answer 463): for a subject with more than one formula, as lycée's are, the
// level's, «مع الأعمال التطبيقية» and «مع الشفهي», each with the formula in
// words. The administration sets it; the teacher records it for the class and
// subject and the whole year, and the last one recorded counts. A class
// archived after a reorientation shows it but takes no new choice.

import { courseFormula, formulaChoices, type FormulaId } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { RadioCardGroup } from '../components/RadioCard';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { assessmentData, formulaText } from './marks-rules';

const NAMES: Partial<Record<FormulaId, string>> = {
  lycee: 'marks.formulaName.lycee',
  'lycee-practical': 'marks.formulaName.lyceePractical',
  'lycee-oral': 'marks.formulaName.lyceeOral',
};

/** The choice of the class and subject's formula; nothing for a subject with one formula or none. */
export function FormulaChoice({ courseId }: { readonly courseId: string }) {
  const t = useText();
  const { direction } = useLocale();
  const { state, profile, record } = useAppData();
  const data = assessmentData(profile);
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  if (data === null || course === undefined || room === undefined) return null;
  const choices = formulaChoices(data, room.level, course.subject);
  const followed = courseFormula(state, data, courseId);
  if (choices.length < 2 || followed === undefined) return null;
  const name = (id: FormulaId) => {
    const key = NAMES[id];
    return key === undefined ? id : t(key as 'marks.formulaName.lycee');
  };
  return (
    <View style={styles.choice}>
      <RadioCardGroup
        testID="book-formula-choice"
        label={t('marks.book.formulaChoice')}
        selected={followed.id}
        disabled={room.archivedFrom !== undefined}
        onSelect={(formula) => {
          if (formula !== followed.id) record({ kind: 'formula.set', courseId, formula });
        }}
        choices={choices.map((one) => ({ value: one.id, label: name(one.id), description: formulaText(t, one) }))}
      />
      <Text style={[styles.note, { writingDirection: direction, textAlign: 'start' }]}>
        {t('marks.book.formulaNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { gap: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
