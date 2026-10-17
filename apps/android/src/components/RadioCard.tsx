// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles, type ControlProps } from './control';

/** One caller-owned choice, with its explanation read as part of the same target. */
export type RadioCardProps = ControlProps & {
  readonly label: string;
  readonly description: string;
  readonly selected: boolean;
};

/** A full-width radio with a dot and an inset selected ring; it cannot deselect itself. */
export function RadioCard({
  label,
  description,
  selected,
  disabled = false,
  onPress,
  accessibilityHint,
  testID,
}: RadioCardProps) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${description}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : (event) => !selected && onPress(event)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.card,
        { direction },
        pressed && styles.pressed,
        selected && styles.selected,
        disabled && controlStyles.disabled,
      ]}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.radio, selected && styles.selectedRadio]}
      >
        {selected && <View style={styles.dot} />}
      </View>
      <View style={styles.words}>
        <Text style={[styles.label, align]}>{label}</Text>
        <Text style={[styles.description, align]}>{description}</Text>
      </View>
      {selected && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.selectedRing}
        />
      )}
      {focused && !disabled && (
        <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />
      )}
    </Pressable>
  );
}

/** A translated choice; an unavailable pack can remain readable without being selectable. */
export type RadioCardChoice<T extends string> = Pick<RadioCardProps, 'label' | 'description' | 'disabled'> & {
  readonly value: T;
};

/** A named, mutually exclusive group; null means the teacher has not chosen yet. */
export type RadioCardGroupProps<T extends string> = {
  readonly label: string;
  readonly choices: readonly RadioCardChoice<T>[];
  readonly selected: T | null;
  readonly onSelect: (value: T) => void;
  readonly disabled?: boolean;
  /** Each card's test ID is this, a hyphen and its value. */
  readonly testID?: string;
};

/** Keep group text and individual radios separate so no accessible parent hides its choices. */
export function RadioCardGroup<T extends string>({
  label,
  choices,
  selected,
  onSelect,
  disabled = false,
  testID,
}: RadioCardGroupProps<T>) {
  const { direction } = useLocale();
  return (
    <View style={[styles.group, { direction }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[styles.groupLabel, { writingDirection: direction }]}>{label}</Text>
      {choices.map((choice) => (
        <RadioCard
          key={choice.value}
          testID={testID && `${testID}-${choice.value}`}
          label={choice.label}
          description={choice.description}
          selected={choice.value === selected}
          disabled={disabled || choice.disabled}
          onPress={() => onSelect(choice.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { width: '100%', gap: spacing['space-8'] },
  groupLabel: { ...typography.label, color: colors.ink2, textAlign: 'start' },
  card: {
    width: '100%',
    minWidth: sizes.target,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    borderRadius: radius['radius-button'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    backgroundColor: colors.sheet,
  },
  words: { flex: 1, minWidth: 0, gap: spacing['space-2'] },
  label: { ...typography.body, color: colors.ink },
  description: { ...typography.caption, color: colors.ink2 },
  radio: {
    width: sizes.icon,
    height: sizes.icon,
    borderRadius: sizes.icon / 2,
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: { borderColor: colors.board },
  dot: { width: spacing['space-10'], height: spacing['space-10'], borderRadius: 5, backgroundColor: colors.board },
  selected: { borderColor: colors.board },
  selectedRing: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    start: 1,
    end: 1,
    borderWidth: 1,
    borderColor: colors.board,
    borderRadius: radius['radius-button'] - 1,
  },
  pressed: { backgroundColor: colors.soft },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-button'] - 2 },
});
