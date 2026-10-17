// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles, type ControlIcon, type ControlProps } from './control';

/** Omit selected for an action; supply it for choice buttons whose selection the screen owns. Long lists may omit the icon. */
export type OptionRowProps = ControlProps & {
  readonly label: string;
  readonly icon?: ControlIcon;
  readonly sub?: string;
  readonly selected?: boolean;
  readonly directional?: boolean;
};

/** A single labelled action or choice, with its explanation spoken together and a non-colour selection cue. */
export function OptionRow({
  label,
  icon,
  sub,
  selected,
  directional = false,
  disabled = false,
  onPress,
  accessibilityHint,
  testID,
}: OptionRowProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  const textDirection = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(selected !== undefined && { selected }) }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.row,
        { direction },
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && controlStyles.disabled,
      ]}
    >
      {icon && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.icon, { transform: [{ scaleX: directional && direction === 'rtl' ? -1 : 1 }] }]}
        >
          {icon({ size: sizes.icon, color: colors.ink })}
        </View>
      )}
      <View style={styles.words}>
        <Text style={[styles.label, textDirection]}>{label}</Text>
        {sub ? <Text style={[styles.sub, textDirection]}>{sub}</Text> : null}
      </View>
      {selected !== undefined && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.selection}
        >
          {selected && <View style={styles.tick} />}
        </View>
      )}
      {focused && !disabled && (
        <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: sizes.target,
    minHeight: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    paddingVertical: spacing['space-6'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-button'],
    backgroundColor: colors.sheet,
  },
  icon: { direction: 'ltr', width: sizes.icon, height: sizes.icon, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0 },
  label: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  selection: { direction: 'ltr', width: sizes.icon, alignItems: 'center', justifyContent: 'center' },
  tick: {
    width: 6,
    height: 11,
    borderEndWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.board,
    transform: [{ rotate: '45deg' }],
  },
  selected: { borderColor: colors.board },
  pressed: { backgroundColor: colors.soft, borderColor: colors.ink },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-button'] - 2 },
});
