// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { TextField, type TextFieldProps } from './TextField';

/** Translated words and a caller-owned value; this panel neither saves nor routes a note. */
export type PrivateNoteProps = Pick<
  TextFieldProps,
  | 'label'
  | 'placeholder'
  | 'value'
  | 'onChangeText'
  | 'editable'
  | 'optionalLabel'
  | 'error'
  | 'maxLength'
  | 'testID'
  | 'ref'
  | 'onFocus'
  | 'onBlur'
> & {
  /** Say that the note does not leave the teacher's own devices. */
  readonly assurance: string;
  /** Ask the teacher not to enter pupils' health or disciplinary details. */
  readonly reminder: string;
};

const lock = controlIcon('lock');

/** A distinct private ground, one associated title/assurance, a growing field and the visible reminder. */
export function PrivateNote({ label, assurance, reminder, ...field }: PrivateNoteProps) {
  const { direction } = useLocale();
  return (
    <View style={[styles.panel, { direction }]}>
      <TextField {...field} label={`${label} · ${assurance}`} labelIcon={lock} multiline />
      <Text style={[styles.reminder, { writingDirection: direction, textAlign: 'start' }]}>{reminder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.private,
    borderRadius: radius['radius-button'],
    padding: spacing['space-12'],
    gap: spacing['space-8'],
    alignSelf: 'stretch',
  },
  reminder: { ...typography.small, color: colors.ink2 },
});
