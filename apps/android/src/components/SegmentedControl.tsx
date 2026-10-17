// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles } from './control';

/** A short, translated name for one view of the same content. */
export type SegmentChoice<T extends string> = { readonly value: T; readonly label: string };

/** Exactly two or three views; the screen owns the current view and its content. */
export type SegmentedControlProps<T extends string> = {
  readonly label: string;
  readonly choices:
    readonly [SegmentChoice<T>, SegmentChoice<T>] | readonly [SegmentChoice<T>, SegmentChoice<T>, SegmentChoice<T>];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly disabled?: boolean;
  /** Each segment's test ID is this, a hyphen and its value. */
  readonly testID?: string;
};

/** Equal-width, growing tabs: an underline marks selection without relying on colour. */
export function SegmentedControl<T extends string>({
  label,
  choices,
  selected,
  onSelect,
  disabled = false,
  testID,
}: SegmentedControlProps<T>) {
  const { direction } = useLocale();
  return (
    <View style={[styles.group, { direction }]} accessibilityRole="tablist" accessibilityLabel={label}>
      {choices.map((choice, index) => (
        <Segment
          key={choice.value}
          label={choice.label}
          selected={choice.value === selected}
          divided={index > 0}
          disabled={disabled}
          testID={testID && `${testID}-${choice.value}`}
          onPress={() => onSelect(choice.value)}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  selected,
  divided,
  disabled,
  testID,
  onPress,
}: {
  label: string;
  selected: boolean;
  divided: boolean;
  disabled: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const { direction } = useLocale();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : () => !selected && onPress()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.segment,
        divided && styles.divider,
        pressed && !selected && styles.pressed,
        selected && styles.selected,
        disabled && controlStyles.disabled,
      ]}
    >
      <Text style={[styles.label, { writingDirection: direction }, selected && styles.selectedLabel]}>{label}</Text>
      {selected && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.mark}
        />
      )}
      {focused && !disabled && (
        <View
          pointerEvents="none"
          accessible={false}
          style={[controlStyles.focus, styles.focus, selected && styles.selectedFocus]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    width: '100%',
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-control'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  segment: {
    flex: 1,
    minWidth: sizes.target,
    minHeight: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-8'],
  },
  divider: { borderStartWidth: 1.5, borderStartColor: colorRoles.controlBorder },
  selected: { backgroundColor: colors.board },
  pressed: { backgroundColor: colors.soft },
  label: { ...typography.segment, color: colors.ink2, textAlign: 'center' },
  selectedLabel: { color: colors.chalk },
  mark: {
    position: 'absolute',
    bottom: spacing['space-3'],
    alignSelf: 'center',
    width: spacing['space-24'],
    height: spacing['space-2'],
    backgroundColor: colors.chalk,
  },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-control'] - 2 },
  selectedFocus: { borderColor: colors['focus-on-board'] },
});
