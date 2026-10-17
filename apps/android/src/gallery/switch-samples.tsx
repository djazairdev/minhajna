// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Switch } from '../components/Switch';
import { colors, spacing, typography } from '../design/tokens';
import type { SampleProps } from './samples';
import { switchTexts } from './switch-texts';

/** On/off and disabled states, with all changes confined to the preview. */
export function SwitchSamples({ sample, language }: SampleProps) {
  const text = switchTexts[language];
  const [values, setValues] = useState([false, true]);
  return (
    <View style={styles.group}>
      <Switch
        testID="switch-short"
        label={text.label}
        value={values[0]}
        onValueChange={(value) => setValues((old) => [value, old[1]])}
      />
      <Switch
        testID="switch-long"
        label={text.details}
        description={text.description}
        value={values[1]}
        onValueChange={(value) => setValues((old) => [old[0], value])}
      />
      <Text style={styles.note}>{sample.disabled}</Text>
      {[false, true].map((value) => (
        <Switch
          key={String(value)}
          testID={`switch-disabled-${value}`}
          label={text.label}
          value={value}
          disabled
          onValueChange={() => undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
