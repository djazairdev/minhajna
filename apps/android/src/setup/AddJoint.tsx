// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «قسم مشترك (ابتدائي)» on Setup-4-Classes (#43, Setup-4d-Joint): a primary
// class with two or three years in one room, each on its own plan (PRD
// §3.2). The school, when several teach primary, the years and the class's
// name; the class is saved when it is added. Each pupil's year is chosen when
// the list is typed, and each year's pack at the plan step.

import type { School, SchoolClass } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { jointGrades, jointSchools, newJointClass, yearsValid } from './joint-rules';
import { localized } from './names';

/** The form, open until the class is added or the teacher cancels. */
export function AddJoint({ schools, onDone }: { schools: readonly School[]; onDone: (added?: SchoolClass) => void }) {
  const { direction } = useLocale();
  const t = useText();
  const { profile, record, newId } = useAppData();
  const primary = jointSchools(schools);
  const [schoolId, setSchoolId] = useState<string | null>(primary[0]?.id ?? null);
  const [grades, setGrades] = useState<string[]>([]);
  const [name, setName] = useState('');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const school = primary.find((candidate) => candidate.id === schoolId);
  const ready = school !== undefined && yearsValid(profile, grades) && name.trim() !== '';
  const add = () => {
    if (!ready || school === undefined) return;
    const schoolClass = newJointClass({ id: newId(), groupId: newId() }, profile, school, grades, name, newId);
    record({ kind: 'class.set', schoolClass });
    onDone(schoolClass);
  };
  return (
    <View testID="add-joint" style={styles.card}>
      <View>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('joint.title')}
        </Text>
        <Text style={[styles.sub, align]}>{t('joint.sub')}</Text>
      </View>
      {primary.length > 1 && (
        <ChipGroup
          testID="joint-school"
          label={t('setup.school')}
          choices={primary.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          selected={schoolId}
          onSelect={setSchoolId}
        />
      )}
      <ChipGroup
        testID="joint-years"
        multiple
        label={t('joint.levels')}
        hint={t('joint.levelsHint')}
        choices={jointGrades(profile).map((grade) => ({ value: grade.code, label: localized(grade.name) }))}
        selected={grades}
        onSelect={setGrades}
      />
      <TextField
        testID="joint-name"
        label={t('setup.className')}
        placeholder={t('setup.classNamePlaceholder')}
        value={name}
        onChangeText={setName}
        onSubmitEditing={add}
        returnKeyType="done"
      />
      <View style={styles.actions}>
        <Button testID="joint-add" variant="soft" label={t('joint.add')} disabled={!ready} onPress={add} />
        <Button testID="joint-cancel" variant="plain" label={t('setup.cancel')} onPress={() => onDone()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-16'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.label, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
