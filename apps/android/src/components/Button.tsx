// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewInstance } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles, type ControlIcon, type ControlProps } from './control';

/** The four action weights and the destructive action from the design system. */
export type ButtonVariant = 'primary' | 'line' | 'soft' | 'plain' | 'danger';

/** A visible label is also the spoken name; only the primary action accepts a leading icon. */
export type ButtonProps = ControlProps & {
  readonly ref?: Ref<ViewInstance>;
  /** A concise action, sized for one line at enlarged text; put lesson details outside the button. */
  readonly label: string;
  /** A spoken name for a button repeated in a list, starting with its label, as «Remove entry 3». */
  readonly name?: string;
} & (
    | { readonly variant?: 'primary'; readonly icon?: ControlIcon }
    | { readonly variant: Exclude<ButtonVariant, 'primary'>; readonly icon?: never }
  );

/** A growing 48dp action (56dp, full width for primary), with one accessible name. */
export function Button({
  ref,
  label,
  name,
  variant = 'primary',
  icon,
  disabled = false,
  onPress,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  const dark = variant === 'primary' || variant === 'danger';
  const color = dark ? colors.chalk : colors.ink;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        { direction },
        pressed && { borderColor: color },
        disabled && controlStyles.disabled,
      ]}
    >
      {variant === 'primary' && icon && (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon({ size: sizes.icon, color })}
        </View>
      )}
      <Text style={[styles.label, variant === 'primary' && typography['button-primary'], { color }]}>{label}</Text>
      {focused && !disabled && (
        <View
          pointerEvents="none"
          accessible={false}
          style={[controlStyles.focus, { borderColor: color, borderRadius: radius['radius-button'] - 2 }]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-16'],
    paddingVertical: spacing['space-12'],
    borderRadius: radius['radius-button'],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  primary: { minHeight: sizes['button-primary'], width: '100%', backgroundColor: colors.board },
  line: { backgroundColor: colors.sheet, borderColor: colorRoles.controlBorder },
  soft: { backgroundColor: colors.soft },
  plain: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  label: { ...typography.button, flexShrink: 1, textAlign: 'center' },
});
