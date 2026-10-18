// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PrivateNote } from '../components/PrivateNote';
import { spacing } from '../design/tokens';
import { privateNoteTexts } from './private-note-texts';
import type { SampleProps } from './samples';

/** Edits stay in this preview's state and disappear on unmount, never entering the record book. */
function Example({ language, long = false }: Pick<SampleProps, 'language'> & { long?: boolean }) {
  const text = privateNoteTexts[language];
  const [value, setValue] = useState(long ? text.long : '');
  return (
    <PrivateNote
      testID={long ? 'private-note-long' : 'private-note-empty'}
      label={text.label}
      assurance={text.assurance}
      placeholder={text.placeholder}
      reminder={text.reminder}
      value={value}
      onChangeText={setValue}
    />
  );
}

/** Empty and long notes in each interface language; no real setting or storage is touched. */
export function PrivateNoteSamples({ language }: SampleProps) {
  return (
    <View style={styles.group}>
      <Example language={language} />
      <Example language={language} long />
    </View>
  );
}

const styles = StyleSheet.create({ group: { padding: spacing['space-12'], gap: spacing['space-16'] } });
