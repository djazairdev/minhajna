// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../design/Icon';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles, type ControlIcon, type ControlProps } from './control';

/** The caller supplies translated words and an internal navigation action, not an automatically opened URL. */
export type RowLinkProps = ControlProps & {
  readonly icon: ControlIcon;
  readonly title: string;
  readonly description?: string;
};

/** One growing navigation target, named by its title; its optional explanation is a spoken hint. */
export function RowLink({
  icon,
  title,
  description,
  onPress,
  accessibilityHint,
  disabled = false,
  testID,
}: RowLinkProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint ?? description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
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
        {icon({ size: sizes.icon, color: colors.ink })}
      </View>
      <View style={styles.words}>
        <Text style={[styles.title, align]}>{title}</Text>
        {description !== undefined && <Text style={[styles.description, align]}>{description}</Text>}
      </View>
      <Icon name="chevron" size={sizes.icon} color={colors.ink2} />
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
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-button'],
    backgroundColor: colors.sheet,
  },
  words: { flex: 1, minWidth: 0, gap: spacing['space-2'] },
  title: { ...typography.body, color: colors.ink },
  description: { ...typography.caption, color: colors.ink2 },
  pressed: { backgroundColor: colors['link-row'], borderColor: colors.ink },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-button'] - 2 },
});
