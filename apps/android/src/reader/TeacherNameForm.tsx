// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Naming the teacher who signs with a key (#246, answer 489): a name and,
// optionally, a school, kept on the reader's own devices only, as their own
// record; a later name replaces the earlier one. An empty name, or one longer than
// the core allows, is not saved.

import { nameTeacher, TEACHER_NAME_LIMIT, type TeacherName } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

export function TeacherNameForm({
  spki,
  named,
  onDone,
}: {
  readonly spki: string;
  readonly named: TeacherName | undefined;
  readonly onDone: () => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const { record } = useAppData();
  const [name, setName] = useState(named?.name ?? '');
  const [school, setSchool] = useState(named?.school ?? '');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  let event: ReturnType<typeof nameTeacher> | null = null;
  try {
    event = nameTeacher(spki, name, school);
  } catch {
    event = null;
  }
  return (
    <View testID="reader-name-form" style={[styles.card, { gap: spacing['space-12'] }]}>
      <TextField
        testID="reader-name"
        label={t('reader.nameLabel')}
        placeholder={t('reader.nameLabel')}
        value={name}
        maxLength={TEACHER_NAME_LIMIT}
        onChangeText={setName}
      />
      <TextField
        testID="reader-school"
        label={t('reader.schoolLabel')}
        placeholder={t('reader.schoolLabel')}
        value={school}
        maxLength={TEACHER_NAME_LIMIT}
        onChangeText={setSchool}
      />
      <Text style={[styles.sub, align]}>{t('reader.nameNote')}</Text>
      <Button
        testID="reader-name-save"
        label={t('reader.save')}
        disabled={event === null}
        onPress={() => {
          if (event === null) return;
          record(event);
          onDone();
        }}
      />
      <Button testID="reader-name-cancel" variant="line" label={t('reader.cancel')} onPress={onDone} />
    </View>
  );
}
