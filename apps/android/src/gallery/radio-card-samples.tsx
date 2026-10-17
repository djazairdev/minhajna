// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RadioCardGroup } from '../components/RadioCard';
import { colors, spacing, typography } from '../design/tokens';
import { radioCardTexts } from './radio-card-texts';
import type { SampleProps } from './samples';

/** A short and a long explanation, plus inactive radios; nothing is pinned or stored. */
export function RadioCardSamples({ sample, language }: SampleProps) {
  const text = radioCardTexts[language];
  const [selected, setSelected] = useState<'first' | 'second' | null>(null);
  const choices = [
    { value: 'first', label: text.first, description: text.firstDescription },
    { value: 'second', label: text.second, description: text.longDescription },
  ] as const;
  return (
    <View style={styles.group}>
      <RadioCardGroup testID="cards" label={text.group} choices={choices} selected={selected} onSelect={setSelected} />
      <Text style={styles.note}>{sample.disabled}</Text>
      <RadioCardGroup
        testID="cards-disabled"
        label={text.group}
        choices={choices}
        selected="first"
        onSelect={setSelected}
        disabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2 },
});
