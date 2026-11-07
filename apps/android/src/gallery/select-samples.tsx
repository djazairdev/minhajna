// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Select } from '../components/Select';
import { colors, spacing, typography } from '../design/tokens';
import type { SampleProps } from './samples';
import { selectTexts } from './select-texts';

/** A short list with a choice, a long one that searches, and one with no options. */
export function SelectSamples({ sample, language }: SampleProps) {
  const text = selectTexts[language];
  const [colour, setColour] = useState<string | null>('1');
  const [town, setTown] = useState<string | null>(null);
  const colours = text.colours.map((label, at) => ({ value: String(at), label }));
  const towns = Array.from({ length: 12 }, (_, at) => ({ value: `t${at + 1}`, label: `${text.town} ${at + 1}` }));
  return (
    <View style={styles.group}>
      <Select testID="select-short" label={text.short} options={colours} value={colour} onChange={setColour} />
      <Select testID="select-long" label={text.long} options={towns} value={town} onChange={setTown} />
      <Text style={styles.note}>{sample.disabled}</Text>
      <Select testID="select-empty" label={text.long} options={[]} value={null} onChange={setTown} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2 },
});
