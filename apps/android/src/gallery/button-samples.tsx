// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, type ButtonVariant } from '../components/Button';
import { IconButton } from '../components/IconButton';
import type { ControlIcon } from '../components/control';
import { colors, spacing, typography } from '../design/tokens';
import { fill, type Sample } from './samples';

/** Geometric drawings avoid a font glyph's own bidirectional mirroring. */
const add: ControlIcon = ({ size, color }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: size - 4, height: 2, backgroundColor: color }} />
    <View style={{ width: 2, height: size - 4, backgroundColor: color }} />
  </View>
);

const back: ControlIcon = ({ size, color }) => (
  <View
    style={{
      width: size / 2,
      height: size / 2,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderColor: color,
      transform: [{ rotate: '45deg' }],
    }}
  />
);

/** Each weight, enabled and disabled, plus a concise primary action with its optional icon. */
export function ButtonSamples({ sample }: { sample: Sample }) {
  const [count, setCount] = useState(0);
  const variants: readonly ButtonVariant[] = ['primary', 'line', 'soft', 'plain', 'danger'];
  return (
    <View style={styles.group}>
      {([false, true] as const).map((disabled) => (
        <View key={String(disabled)} style={styles.group}>
          <Text style={styles.note}>{disabled ? sample.disabled : sample.enabled}</Text>
          {variants.map((variant) => (
            <Button
              key={variant}
              testID={`sample-${variant}-${disabled ? 'disabled' : 'enabled'}`}
              variant={variant}
              label={sample.buttons[variant]}
              disabled={disabled}
              onPress={() => setCount((previous) => previous + 1)}
            />
          ))}
        </View>
      ))}
      <Button
        testID="sample-add"
        label={sample.addButton}
        icon={add}
        onPress={() => setCount((previous) => previous + 1)}
      />
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {fill(sample.activations, { count })}
      </Text>
    </View>
  );
}

/** Directional and non-directional icons, including disabled actions that cannot change the count. */
export function IconButtonSamples({ sample }: { sample: Sample }) {
  const [count, setCount] = useState(0);
  return (
    <View style={styles.group}>
      {([false, true] as const).map((disabled) => (
        <View key={String(disabled)} style={styles.group}>
          <Text style={styles.note}>{disabled ? sample.disabled : sample.enabled}</Text>
          <View style={styles.row}>
            <IconButton
              icon={back}
              directional
              accessibilityLabel={sample.back}
              disabled={disabled}
              onPress={() => setCount((previous) => previous + 1)}
            />
            <IconButton
              icon={add}
              accessibilityLabel={sample.add}
              disabled={disabled}
              onPress={() => setCount((previous) => previous + 1)}
            />
          </View>
        </View>
      ))}
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {fill(sample.activations, { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-12'], paddingHorizontal: spacing['space-8'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-12'] },
  note: { ...typography.body, color: colors.ink2 },
});
