// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '../components/CheckRow';
import { OptionRow } from '../components/OptionRow';
import type { ControlIcon } from '../components/control';
import { colors, spacing, typography } from '../design/tokens';
import { choiceTexts } from './choice-texts';
import { fill, type SampleProps } from './samples';

/** A neutral geometric decoration, not a second accessible control or a font-dependent glyph. */
const optionIcon: ControlIcon = ({ size, color }) => (
  <View style={{ width: size, height: size, borderWidth: 1.5, borderColor: color, borderRadius: size / 2 }} />
);

/** Independent toggles demonstrate both values, disabled states and an intentionally long row label. */
export function CheckRowSamples({ sample, language }: SampleProps) {
  const text = choiceTexts[language];
  const [values, setValues] = useState([true, false, false]);
  const labels = [text.stage, text.check, sample.longHeading];
  return (
    <View style={styles.group}>
      {labels.map((label, index) => (
        <CheckRow
          key={index}
          testID={`check-${index}`}
          label={label}
          checked={values[index]}
          onCheckedChange={(checked) =>
            setValues((previous) => previous.map((value, at) => (at === index ? checked : value)))
          }
        />
      ))}
      <Text style={styles.note}>{sample.disabled}</Text>
      {[false, true].map((checked) => (
        <CheckRow
          key={String(checked)}
          testID={`check-disabled-${checked}`}
          label={text.check}
          checked={checked}
          disabled
          onCheckedChange={() => undefined}
        />
      ))}
    </View>
  );
}

/** One action, a mutually exclusive pair of choice buttons, and disabled previews; no session is recorded. */
export function OptionRowSamples({ sample, language }: SampleProps) {
  const text = choiceTexts[language];
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);
  return (
    <View style={styles.group}>
      <OptionRow
        testID="option-action"
        icon={optionIcon}
        label={text.other}
        onPress={() => setCount((previous) => previous + 1)}
      />
      <View style={styles.group}>
        <OptionRow
          testID="option-0"
          icon={optionIcon}
          label={text.option}
          sub={text.privacy}
          selected={selected === 0}
          onPress={() => setSelected(0)}
        />
        <OptionRow
          testID="option-1"
          icon={optionIcon}
          label={sample.longHeading}
          sub={text.privacy}
          selected={selected === 1}
          onPress={() => setSelected(1)}
        />
      </View>
      <Text style={styles.note}>{sample.disabled}</Text>
      {[false, true].map((chosen) => (
        <OptionRow
          key={String(chosen)}
          testID={`option-disabled-${chosen}`}
          icon={optionIcon}
          label={text.option}
          sub={text.privacy}
          selected={chosen}
          disabled
          onPress={() => setCount((previous) => previous + 1)}
        />
      ))}
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {fill(sample.activations, { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'], paddingHorizontal: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
