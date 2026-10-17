// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, sizes } from '../design/tokens';
import { controlStyles, type ControlIcon, type ControlProps } from './control';

/** The action's name is required even though it has no visible text. Only directional icons mirror. */
export type IconButtonProps = ControlProps & {
  readonly icon: ControlIcon;
  readonly accessibilityLabel: string;
  readonly directional?: boolean;
};

/** A round 48dp action with a decorative, 22dp icon in a stable LTR drawing space. */
export function IconButton({
  icon,
  accessibilityLabel,
  directional = false,
  disabled = false,
  onPress,
  accessibilityHint,
  testID,
}: IconButtonProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, disabled && controlStyles.disabled]}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.icon, { transform: [{ scaleX: directional && direction === 'rtl' ? -1 : 1 }] }]}
      >
        {icon({ size: sizes.icon, color: colors.ink })}
      </View>
      {focused && !disabled && (
        <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: sizes.target,
    height: sizes.target,
    minWidth: sizes.target,
    minHeight: sizes.target,
    borderRadius: radius['radius-icon-button'],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  icon: { direction: 'ltr', width: sizes.icon, height: sizes.icon, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.soft },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-icon-button'] - 2 },
});
