// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تعديل فقرة» (#237, Note-edit, R-3.8-33, answers 416 and 419): one plan
// paragraph of a lesson note, written by the teacher. The plan's text, when
// it has one, shows in pencil above the box, and «إعادة نص المخطط» puts it
// back in the box. «حفظ الفقرة» keeps the paragraph in ink, or returns it to
// the plan's grey when the box is left empty; the plan never changes.

import { noteWithoutPlan, noteWithPlan, type Day, type NoteKey } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PageHeading } from '../components/PageHeading';
import { Proposal } from '../components/Proposal';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { NOTE_TEXT_MAX, noteBlocks, planOrder } from './note-rules';
import { useNote } from './useNote';

export type NoteEditProps = {
  readonly sessionKey: string;
  readonly day: Day;
  readonly noteKey: NoteKey;
  /** Goes back to the note, saved or not. */
  readonly onDone: () => void;
};

export function NoteEdit({ sessionKey, day, noteKey, onDone }: NoteEditProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const note = useNote(sessionKey, day);
  const block = note === null ? undefined : noteBlocks(t, note.draft, note.note).find((one) => one.key === noteKey);
  const [text, setText] = useState(block?.text ?? '');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (note === null || block === undefined) {
    return (
      <View style={[styles.screen, { direction }]}>
        <Text testID="note-edit-unavailable" style={[styles.body, styles.pad, align]}>
          {t('notes.unavailable')}
        </Text>
      </View>
    );
  }
  const proposed = block.proposed ?? '';
  const save = () => {
    const kept = text.trim();
    note.keep((one) =>
      kept === '' ? noteWithoutPlan(one, noteKey) : noteWithPlan(one, noteKey, kept, planOrder(note.draft)),
    );
    onDone();
  };
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <PageHeading
          testID="note-edit-heading"
          title={t('notes.edit.heading', { number: note.number })}
          scope={note.scope}
        />
        <Text style={[styles.label, align]}>{block.title}</Text>
        {proposed !== '' && (
          <Proposal testID="note-edit-plan" tag={t('notes.edit.fromPlan')} lines={[{ text: proposed }]} />
        )}
        <TextField
          testID="note-edit-text"
          label={t('notes.edit.label')}
          placeholder={t('notes.edit.placeholder')}
          value={text}
          maxLength={NOTE_TEXT_MAX}
          multiline
          onChangeText={setText}
        />
        <Text style={[styles.hint, align]}>{t('notes.edit.note')}</Text>
        {proposed !== '' && (
          <Button
            testID="note-edit-reset"
            variant="line"
            label={t('notes.edit.reset')}
            disabled={text === proposed}
            onPress={() => setText(proposed)}
          />
        )}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="note-edit-save" label={t('notes.save')} icon={controlIcon('check')} onPress={save} />
        <Button testID="note-edit-cancel" variant="plain" label={t('notes.cancel')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], padding: spacing['space-16'] },
  pad: { padding: spacing['space-16'] },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  hint: { ...typography.caption, color: colors.ink2 },
  foot: {
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-16'],
    paddingTop: spacing['space-12'],
    backgroundColor: colors.paper,
  },
});
