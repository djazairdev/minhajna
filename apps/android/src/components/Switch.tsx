// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles, type ControlProps } from './control';

/** The caller owns the value and its default; anything that shares or sends must start off. */
export type SwitchProps = Omit<ControlProps, 'onPress'> & {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
};

/** One growing switch target; its decorative thumb changes position as well as colour. */
export function Switch({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  accessibilityHint,
  testID,
}: SwitchProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : () => onValueChange(!value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.row,
        { direction },
        pressed && styles.pressed,
        disabled && controlStyles.disabled,
      ]}
    >
      <View style={styles.words}>
        <Text style={[styles.label, align]}>{label}</Text>
        {description !== undefined && <Text style={[styles.description, align]}>{description}</Text>}
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.track, value && styles.on]}
      >
        <View style={styles.thumb} />
      </View>
      {focused && !disabled && (
        <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    minWidth: sizes.target,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-8'],
    borderRadius: radius['radius-control'],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  words: { flex: 1, minWidth: 0, gap: spacing['space-2'] },
  label: { ...typography.body, color: colors.ink },
  description: { ...typography.caption, color: colors.ink2 },
  track: {
    width: 44,
    height: 26,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 1.5,
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: 13,
    backgroundColor: colors.rule,
  },
  on: { justifyContent: 'flex-end', backgroundColor: colors.board, borderColor: colors.board },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.board,
    backgroundColor: colors.sheet,
  },
  pressed: { backgroundColor: colors.sheet, borderColor: colors.ink },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-control'] - 2 },
});
