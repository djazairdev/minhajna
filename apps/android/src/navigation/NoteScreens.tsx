// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lesson note's routes (#237): «المذكرة», a plan paragraph to write and
// a paragraph of the teacher's own, each back to the note once done.

import { parseDay, type NoteKey } from '@minhajna/core';
import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Note } from '../notes/Note';
import { NoteEdit } from '../notes/NoteEdit';
import { NoteOwn } from '../notes/NoteOwn';
import type { useText } from '../text/i18n';
import type { RootStackParamList } from './AppNavigator';

export function NoteScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Note'>) {
  const { key, day } = route.params;
  return (
    <Note
      sessionKey={key}
      day={parseDay(day)}
      onWrite={(paragraph) => navigation.navigate('NoteEdit', { key, day, paragraph })}
      onOwn={(index) => navigation.navigate('NoteOwn', { key, day, ...(index !== undefined && { index }) })}
      onPrint={() => navigation.navigate('DocOutput', { id: 'notes', day })}
    />
  );
}

export function NoteEditScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'NoteEdit'>) {
  const { key, day, paragraph } = route.params;
  return (
    <NoteEdit sessionKey={key} day={parseDay(day)} noteKey={paragraph as NoteKey} onDone={() => navigation.goBack()} />
  );
}

export function NoteOwnScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'NoteOwn'>) {
  const { key, day, index } = route.params;
  return (
    <NoteOwn
      sessionKey={key}
      day={parseDay(day)}
      {...(index !== undefined && { index })}
      onDone={() => navigation.goBack()}
    />
  );
}

/** The lesson note's routes, for the app's navigator. */
export function noteRoutes(
  Stack: ReturnType<typeof createNativeStackNavigator<RootStackParamList>>,
  t: ReturnType<typeof useText>,
) {
  const dark = (title: string) => ({ title, statusBarStyle: 'dark' as const });
  return (
    <>
      <Stack.Screen name="Note" component={NoteScreen} options={dark(t('notes.title'))} />
      <Stack.Screen name="NoteEdit" component={NoteEditScreen} options={dark(t('notes.edit.title'))} />
      <Stack.Screen name="NoteOwn" component={NoteOwnScreen} options={dark(t('notes.own.title'))} />
    </>
  );
}
