// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { SetupSteps } from '../components/SetupSteps';
import { colors, spacing, typography } from '../design/tokens';
import { chipTexts } from './chip-texts';
import { fill, type SampleProps } from './samples';

type Type = 'ordinary' | 'revision' | 'assessment';
type Level = 'primary' | 'middle' | 'secondary' | 'long';

/**
 * One choice, several with a hint, a long label behind «more» that wraps, and
 * short two-word labels that must never wrap out of sight (#185); selections
 * stay in this sample.
 */
export function ChipSamples({ language }: SampleProps) {
  const text = chipTexts[language];
  const [type, setType] = useState<Type | null>('ordinary');
  const [levels, setLevels] = useState<Level[]>(['middle']);
  const [all, setAll] = useState(false);
  const [pair, setPair] = useState<string | null>(null);
  const types = (['ordinary', 'revision', 'assessment'] as const).map((value, at) => ({
    value,
    label: text.types[at],
  }));
  const levelChoices = [
    ...(['primary', 'middle', 'secondary'] as const).map((value, at) => ({ value, label: text.levels[at] })),
    ...(all ? [{ value: 'long' as const, label: text.long }] : []),
  ];
  return (
    <View style={styles.group}>
      <ChipGroup testID="chip-type" label={text.type} choices={types} selected={type} onSelect={setType} />
      <ChipGroup
        testID="chip-level"
        multiple
        label={text.level}
        hint={text.levelHint}
        choices={levelChoices}
        selected={levels}
        onSelect={setLevels}
        more={all ? undefined : { label: text.more, onPress: () => setAll(true) }}
      />
      <ChipGroup
        testID="chip-pair"
        label={text.pair}
        choices={text.pairs.map((label) => ({ value: label, label }))}
        selected={pair}
        onSelect={setPair}
      />
    </View>
  );
}

/** The bar at the first, a middle and the last step, each with the words a screen's title would carry. */
export function SetupStepsSamples({ language }: SampleProps) {
  const text = chipTexts[language];
  return (
    <View style={styles.steps}>
      {[1, 3, 5].map((reached) => (
        <View key={reached} style={styles.step}>
          <Text style={styles.note}>{fill(text.step, { step: reached, count: 5 })}</Text>
          <SetupSteps testID={`steps-${reached}`} count={5} reached={reached} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-16'] },
  steps: { paddingVertical: spacing['space-16'], gap: spacing['space-12'] },
  step: { gap: spacing['space-6'] },
  note: { ...typography.caption, color: colors.ink2, paddingHorizontal: spacing['space-16'] },
});
