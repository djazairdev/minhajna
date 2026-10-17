// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles, type ControlProps } from './control';

/** A screen owns the value; tapping any part of the row requests the opposite checked state. */
export type CheckRowProps = Omit<ControlProps, 'onPress'> & {
  readonly label: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
};

/** One growing checkbox target, not a small box and a separately focusable label. */
export function CheckRow({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  accessibilityHint,
  testID,
}: CheckRowProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : () => onCheckedChange(!checked)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.row,
        { direction },
        pressed && styles.pressed,
        disabled && controlStyles.disabled,
      ]}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.box, checked && styles.checked]}>{checked && <View style={styles.tick} />}</View>
      </View>
      <Text style={[styles.label, { writingDirection: direction }]}>{label}</Text>
      {focused && !disabled && (
        <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: sizes.target,
    minHeight: sizes.target,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-6'],
    borderRadius: radius['radius-control'],
  },
  box: {
    direction: 'ltr',
    width: sizes.icon,
    height: sizes.icon,
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    backgroundColor: colors.sheet,
    borderRadius: spacing['space-4'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { borderColor: colors.board, backgroundColor: colors.board },
  tick: {
    width: 6,
    height: 11,
    borderEndWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.chalk,
    transform: [{ rotate: '45deg' }],
  },
  label: { ...typography.body, color: colors.ink, flex: 1, minWidth: 0, textAlign: 'start' },
  pressed: { backgroundColor: colors.soft },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-control'] - 2 },
});
