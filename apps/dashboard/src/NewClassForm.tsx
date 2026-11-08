// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' new class (answer 807): its year, a select of the school's
// level's years, and its name, as the school writes it, which no other class
// of the school has, since a file's pupils find their class by it.

import { MAX_BOOK_CLASSES, type Grade, type SchoolBook } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../android/src/components/Button';
import { TextField } from '../../android/src/components/TextField';
import { controlIcon } from '../../android/src/design/Icon';
import { colors, spacing, typography } from '../../android/src/design/tokens';
import { localized } from '../../android/src/setup/names';
import { useDashboardText } from './text';
import { PickField } from './PickField';
import { classNameTaken, withClass } from './school-rules';

export type NewClassFormProps = {
  readonly book: SchoolBook;
  readonly grades: readonly Grade[];
  readonly onDone: (step: ((book: SchoolBook) => SchoolBook) | null) => void;
};

/** A new class's year and name. */
export function NewClassForm({ book, grades, onDone }: NewClassFormProps) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const [grade, setGrade] = useState<string | null>(null);
  const [name, setName] = useState('');
  const taken = classNameTaken(book, name);
  const full = book.classes.length >= MAX_BOOK_CLASSES;
  const ready = grade !== null && name.trim() !== '' && name.trim().length <= 120 && !taken && !full;
  const save = () => {
    if (ready) onDone((current) => withClass(current, grade, name));
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
        error={taken ? t('dashboard.classes.taken') : full ? t('dashboard.classes.full') : undefined}
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
        <Button
          testID="class-form-cancel"
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
