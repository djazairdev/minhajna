// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' new class (answer 807): its year, a select of the school's
// level's years, and its name, as the school writes it, such as 4م5.

import type { CountryProfile, Grade, SchoolBook } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { PickField } from './PickField';
import { withClass } from './school-rules';

export type NewClassFormProps = {
  readonly profile: CountryProfile;
  readonly grades: readonly Grade[];
  readonly onDone: (step: ((book: SchoolBook) => SchoolBook) | null) => void;
};

/** A new class's year and name. */
export function NewClassForm({ grades, onDone }: NewClassFormProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const [grade, setGrade] = useState<string | null>(null);
  const [name, setName] = useState('');
  const ready = grade !== null && name.trim() !== '' && name.trim().length <= 120;
  const save = () => {
    if (ready) onDone((book) => withClass(book, grade, name));
  };
  return (
    <View testID="class-form" style={styles.form}>
      <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
        {t('dashboard.classes.new')}
      </Text>
      <PickField
        testID="class-form-grade"
        label={t('dashboard.classes.year')}
        choices={grades.map((one) => ({ value: one.code, label: localized(one.name) }))}
        value={grade}
        onChange={setGrade}
      />
      <TextField
        testID="class-form-name"
        label={t('dashboard.classes.name')}
        value={name}
        onChangeText={setName}
        maxLength={120}
        onSubmitEditing={save}
      />
      <View style={styles.buttons}>
        <Button
          testID="class-form-save"
          icon={controlIcon('plus')}
          label={t('dashboard.classes.addOne')}
          disabled={!ready}
          onPress={save}
        />
        <Button testID="class-form-cancel" variant="line" label={t('dashboard.cancel')} onPress={() => onDone(null)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-14'] },
  title: { ...typography.h3, color: colors.ink },
  buttons: { gap: spacing['space-8'] },
});
