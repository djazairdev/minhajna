// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «فقرة جديدة» (#237, Note-add, R-3.8-33, answers 416 and 419): a paragraph
// of the teacher's own, with its title and text, added in ink at the end of
// the note and printed with it. Opened from one already kept, it changes it,
// or «حذف الفقرة» takes it out once confirmed. «حفظ الفقرة» needs both the
// title and the text.

import { noteWithOwn, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PageHeading } from '../components/PageHeading';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { NOTE_TEXT_MAX, NOTE_TITLE_MAX } from './note-rules';
import { useNote } from './useNote';

export type NoteOwnProps = {
  readonly sessionKey: string;
  readonly day: Day;
  /** The teacher's own paragraph to change, counted from 0 among them; a new one when not given. */
  readonly index?: number;
  /** Goes back to the note, saved or not. */
  readonly onDone: () => void;
};

export function NoteOwn({ sessionKey, day, index, onDone }: NoteOwnProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const note = useNote(sessionKey, day);
  const own = note?.note?.paragraphs.filter((one) => one.key === undefined) ?? [];
  const kept = index === undefined ? undefined : own[index];
  const [title, setTitle] = useState(kept?.title ?? '');
  const [text, setText] = useState(kept?.text ?? '');
  const [removing, setRemoving] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (note === null || (index !== undefined && kept === undefined)) {
    return (
      <View style={[styles.screen, { direction }]}>
        <Text testID="note-own-unavailable" style={[styles.body, styles.pad, align]}>
          {t('notes.unavailable')}
        </Text>
      </View>
    );
  }
  const ready = title.trim() !== '' && text.trim() !== '';
  const save = () => {
    note.keep((one) => noteWithOwn(one, index ?? Number.MAX_SAFE_INTEGER, { title: title.trim(), text: text.trim() }));
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
          testID="note-own-heading"
          title={t(kept === undefined ? 'notes.own.heading' : 'notes.own.editHeading', { number: note.number })}
          scope={note.scope}
        />
        <TextField
          testID="note-own-title"
          label={t('notes.own.titleLabel')}
          placeholder={t('notes.own.titlePlaceholder')}
          value={title}
          maxLength={NOTE_TITLE_MAX}
          onChangeText={(value) => setTitle(value.replace(/[\r\n\t]+/g, ' '))}
        />
        <TextField
          testID="note-own-text"
          label={t('notes.edit.label')}
          placeholder={t('notes.edit.placeholder')}
          value={text}
          maxLength={NOTE_TEXT_MAX}
          multiline
          onChangeText={setText}
        />
        <Text style={[styles.hint, align]}>{t('notes.own.note')}</Text>
        {kept !== undefined && !removing && (
          <Button
            testID="note-own-remove"
            variant="plain"
            label={t('notes.own.remove')}
            onPress={() => setRemoving(true)}
          />
        )}
        {kept !== undefined && removing && (
          <>
            <Text style={[styles.hint, align]}>{t('notes.own.removeNote')}</Text>
            <Button
              testID="note-own-confirm"
              variant="danger"
              label={t('notes.own.confirmRemove')}
              onPress={() => {
                note.keep((one) => noteWithOwn(one, index ?? -1, null));
                onDone();
              }}
            />
            <Button
              testID="note-own-keep"
              variant="plain"
              label={t('notes.own.keep')}
              onPress={() => setRemoving(false)}
            />
          </>
        )}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button
          testID="note-own-save"
          label={t('notes.save')}
          icon={controlIcon('check')}
          disabled={!ready}
          onPress={save}
        />
        <Button testID="note-own-cancel" variant="plain" label={t('notes.cancel')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], padding: spacing['space-16'] },
  pad: { padding: spacing['space-16'] },
  body: { ...typography.body, color: colors.ink },
  hint: { ...typography.caption, color: colors.ink2 },
  foot: {
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-16'],
    paddingTop: spacing['space-12'],
    backgroundColor: colors.paper,
  },
});
