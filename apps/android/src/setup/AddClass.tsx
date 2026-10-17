// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة قسم» on Setup-4-Classes (#27): the school, when there are several,
// the year among that school's levels, and the class's name as the school
// writes it, such as 4م3. The class is saved when it is added. The same form
// adds the demo class, named «القسم التجريبي» and saved with its 45 made-up
// pupils (PRD §1.5), for trying the app, screenshots and bug reports.

import { DEMO_PUPILS, demoPupils, type School, type SchoolClass } from '@minhajna/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { gradesFor, newClass } from './class-rules';
import { localized } from './names';

/** The form, open until the class is added or the teacher cancels; `demo` adds the demo class. */
export function AddClass({
  schools,
  demo = false,
  onDone,
}: {
  schools: readonly School[];
  demo?: boolean;
  onDone: (added?: SchoolClass) => void;
}) {
  const t = useText();
  const { profile, record, recordAll, newId } = useAppData();
  const [schoolId, setSchoolId] = useState<string | null>(schools[0]?.id ?? null);
  const [grade, setGrade] = useState<string | null>(null);
  const [name, setName] = useState(demo ? t('setup.demoName') : '');
  const school = schools.find((candidate) => candidate.id === schoolId);
  const grades = school ? gradesFor(profile, school) : [];
  const chosen = grades.find((choice) => choice.grade.code === grade);
  const ready = school !== undefined && chosen !== undefined && name.trim() !== '';
  const add = () => {
    if (!ready) return;
    const made = newClass({ id: newId(), groupId: newId() }, school, chosen, name);
    if (demo) {
      const schoolClass = { ...made, demo: true as const };
      const pupils = demoPupils(schoolClass.id, newId).map((pupil) => ({ kind: 'pupil.set' as const, pupil }));
      recordAll([{ kind: 'class.set', schoolClass }, ...pupils]);
      onDone(schoolClass);
    } else {
      record({ kind: 'class.set', schoolClass: made });
      onDone(made);
    }
  };
  return (
    <View testID="add-class" style={styles.card}>
      {demo && (
        <Notice
          testID="demo-note"
          icon={controlIcon('info')}
          message={t('setup.demoNote', { pupils: t('setup.pupils', { count: DEMO_PUPILS.length }) })}
        />
      )}
      {schools.length > 1 && (
        <ChipGroup
          testID="class-school"
          label={t('setup.school')}
          choices={schools.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
          selected={schoolId}
          onSelect={(id) => {
            setSchoolId(id);
            setGrade(null);
          }}
        />
      )}
      <ChipGroup
        testID="class-grade"
        label={t('setup.grade')}
        choices={grades.map((choice) => ({ value: choice.grade.code, label: localized(choice.grade.name) }))}
        selected={grade}
        onSelect={setGrade}
      />
      <TextField
        testID="class-name"
        label={t('setup.className')}
        placeholder={t('setup.classNamePlaceholder')}
        value={name}
        onChangeText={setName}
        onSubmitEditing={add}
        returnKeyType="done"
      />
      <View style={styles.actions}>
        <Button testID="class-add" variant="soft" label={t('setup.add')} disabled={!ready} onPress={add} />
        <Button testID="class-cancel" variant="plain" label={t('setup.cancel')} onPress={() => onDone()} />
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
