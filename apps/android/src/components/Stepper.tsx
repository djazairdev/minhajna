// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles } from './control';

/** Inclusive, non-negative safe-integer bounds; the screen owns and saves the count. Button names must name what they count. */
export type StepperProps = {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onValueChange: (value: number) => void;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly disabled?: boolean;
  /** Button IDs append -decrease/-increase; the live value appends -value. */
  readonly testID?: string;
};

/** Changes one at a time without clamping a caller's invalid value or rounding it silently. */
export function Stepper({
  label,
  unit,
  value,
  min,
  max,
  onValueChange,
  decreaseLabel,
  increaseLabel,
  disabled = false,
  testID,
}: StepperProps) {
  const { direction } = useLocale();
  if (![value, min, max].every(Number.isSafeInteger) || min < 0 || min > max || value < min || value > max) {
    throw new RangeError('Stepper requires non-negative safe-integer bounds and an in-range count');
  }
  return (
    <View style={[styles.group, { direction }]}>
      <View style={styles.row}>
        <CountButton
          testID={testID && `${testID}-decrease`}
          label={decreaseLabel}
          disabled={disabled || value === min}
          onPress={() => onValueChange(value - 1)}
        />
        <Text
          testID={testID && `${testID}-value`}
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${label}: ${value}. ${unit}`}
          style={styles.value}
        >
          {String(value)}
        </Text>
        <CountButton
          testID={testID && `${testID}-increase`}
          label={increaseLabel}
          increase
          disabled={disabled || value === max}
          onPress={() => onValueChange(value + 1)}
        />
      </View>
      <Text
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.unit, { writingDirection: direction }]}
      >
        {unit}
      </Text>
    </View>
  );
}

function CountButton({
  label,
  increase = false,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  increase?: boolean;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && controlStyles.disabled]}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.icon}
      >
        <View style={styles.minus} />
        {increase && <View style={styles.plus} />}
      </View>
      {focused && !disabled && (
        <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    maxWidth: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing['space-4'],
    paddingVertical: spacing['space-8'],
  },
  row: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-6'],
  },
  button: {
    width: sizes.target,
    height: sizes.target,
    minWidth: sizes.target,
    minHeight: sizes.target,
    borderRadius: radius['radius-control'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    backgroundColor: colors.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...typography.stepper,
    color: colors.ink,
    writingDirection: 'ltr',
    textAlign: 'center',
    minWidth: 30,
    flexShrink: 1,
    padding: spacing['space-4'],
  },
  unit: { ...typography.caption, color: colors.ink2, textAlign: 'center', flexShrink: 1 },
  icon: { direction: 'ltr', width: sizes.icon, height: sizes.icon, alignItems: 'center', justifyContent: 'center' },
  minus: { position: 'absolute', width: 14, height: 2, backgroundColor: colors.ink },
  plus: { position: 'absolute', width: 2, height: 14, backgroundColor: colors.ink },
  pressed: { backgroundColor: colors.soft, borderColor: colors.ink },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-control'] - 2 },
});
