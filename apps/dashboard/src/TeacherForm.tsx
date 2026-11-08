// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Adding a teacher to the school's book (answer 809): their full name and
// their option, a select of the options the Ministry's list gives the
// school's level, as the teacher picks it in setup.

import type { CountryProfile, DirectoryLevel, SchoolBook } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../android/src/components/Button';
import { TextField } from '../../android/src/components/TextField';
import { controlIcon } from '../../android/src/design/Icon';
import { colors, spacing, typography } from '../../android/src/design/tokens';
import { useDashboardText } from './text';
import { PickField } from './PickField';
import { optionName } from './reference-rules';
import { withTeacher } from './school-rules';

export type TeacherFormProps = {
  readonly profile: CountryProfile;
  readonly level: DirectoryLevel | undefined;
  readonly onDone: (step: ((book: SchoolBook) => SchoolBook) | null) => void;
};

/** A new teacher's name and option. */
export function TeacherForm({ profile, level, onDone }: TeacherFormProps) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const [name, setName] = useState('');
  const [option, setOption] = useState<string | null>(null);
  const ready = name.trim() !== '' && name.trim().length <= 120 && option !== null;
  const save = () => {
    if (ready) onDone((book) => withTeacher(book, name, option));
  };
  return (
    <View testID="teacher-form" style={styles.form}>
      <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
        {t('dashboard.teachers.add')}
      </Text>
      <TextField
        testID="teacher-form-name"
        label={t('dashboard.teachers.name')}
        value={name}
        onChangeText={setName}
        maxLength={120}
        onSubmitEditing={save}
      />
      <PickField
        testID="teacher-form-option"
        label={t('dashboard.teachers.column.option')}
        choices={(level?.options ?? []).map((one) => ({ value: one.code, label: optionName(t, profile, one) }))}
        value={option}
        onChange={setOption}
      />
      <View style={styles.buttons}>
        <Button
          testID="teacher-form-save"
          icon={controlIcon('plus')}
          label={t('dashboard.teachers.add')}
          disabled={!ready}
          onPress={save}
        />
        <Button
          testID="teacher-form-cancel"
          variant="line"
          icon={controlIcon('cross')}
          label={t('dashboard.cancel')}
          onPress={() => onDone(null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-14'] },
  title: { ...typography.h3, color: colors.ink },
  buttons: { gap: spacing['space-8'] },
});
