// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stepper } from '../components/Stepper';
import { colors, spacing, typography } from '../design/tokens';
import type { SampleProps } from './samples';
import { stepperTexts } from './stepper-texts';

/** Independent bounded counters, a disabled counter and equal bounds; no record is written. */
export function StepperSamples({ sample, language }: SampleProps) {
  const text = stepperTexts[language];
  const [value, setValue] = useState(1);
  const [longValue, setLongValue] = useState(36);
  const names = { label: text.label, decreaseLabel: text.decrease, increaseLabel: text.increase };
  return (
    <View style={styles.group}>
      <Text style={styles.note}>{text.label}</Text>
      <Stepper
        {...names}
        testID="stepper-short"
        value={value}
        min={0}
        max={3}
        unit={text.unit}
        onValueChange={setValue}
      />
      <Stepper
        {...names}
        testID="stepper-long"
        value={longValue}
        min={0}
        max={36}
        unit={text.longUnit}
        onValueChange={setLongValue}
      />
      <Text style={styles.note}>{sample.disabled}</Text>
      <Stepper
        {...names}
        testID="stepper-disabled"
        value={2}
        min={0}
        max={3}
        unit={text.unit}
        onValueChange={setValue}
        disabled
      />
      <Stepper {...names} testID="stepper-fixed" value={0} min={0} max={0} unit={text.fixed} onValueChange={setValue} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2 },
});
