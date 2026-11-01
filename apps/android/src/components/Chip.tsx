// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { colorRoles, colors, fontFamilies, radius, sizes, spacing, typography } from '../design/tokens';
import { controlStyles } from './control';

/** One choice; a name in another script, such as «Français» in Arabic, keeps its own font and direction. */
export type ChipChoice<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly script?: 'arabic' | 'latin';
};

type Common<T extends string> = {
  /** Shown above the chips and spoken as the group's name. */
  readonly label: string;
  /** One line under the chips, such as how many may be chosen. */
  readonly hint?: string;
  readonly choices: readonly ChipChoice<T>[];
  /** Each chip's test ID is this, a hyphen and its value. */
  readonly testID?: string;
  /** A last chip that shows more choices, such as «مواد أخرى»; a button, not a choice. */
  readonly more?: { readonly label: string; readonly onPress: () => void };
};

/** The screen owns the selection: one value, or several. */
export type ChipGroupProps<T extends string> = Common<T> &
  (
    | { readonly multiple?: false; readonly selected: T | null; readonly onSelect: (value: T) => void }
    | { readonly multiple: true; readonly selected: readonly T[]; readonly onSelect: (values: T[]) => void }
  );

/**
 * A wrapping row of 48dp chips (the canvas draws 44): radios for one choice,
 * checkboxes for several. The chosen chips are board with chalk text.
 */
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' } as const;
  const chosen = (value: T) => (props.multiple ? props.selected.includes(value) : props.selected === value);
  const press = (value: T) => {
    if (!props.multiple) return props.onSelect(value);
    const values = props.choices.map((choice) => choice.value);
    const next = chosen(value) ? props.selected.filter((item) => item !== value) : [...props.selected, value];
    props.onSelect(values.filter((item) => next.includes(item)));
  };
  return (
    <View style={[styles.group, { direction }]}>
      <Text style={[styles.label, align]}>{props.label}</Text>
      <View
        style={styles.chips}
        accessibilityRole={props.multiple ? undefined : 'radiogroup'}
        accessibilityLabel={props.label}
      >
        {props.choices.map((choice) => (
          <Chip
            key={choice.value}
            testID={props.testID && `${props.testID}-${choice.value}`}
            label={choice.label}
            script={choice.script}
            role={props.multiple ? 'checkbox' : 'radio'}
            selected={chosen(choice.value)}
            onPress={() => press(choice.value)}
          />
        ))}
        {props.more && (
          <Chip
            testID={props.testID && `${props.testID}-more`}
            label={props.more.label}
            role="button"
            selected={false}
            onPress={props.more.onPress}
          />
        )}
      </View>
      {props.hint !== undefined && <Text style={[styles.hint, align]}>{props.hint}</Text>}
    </View>
  );
}

function Chip({
  label,
  script,
  role,
  selected,
  onPress,
  testID,
}: {
  label: string;
  script?: 'arabic' | 'latin';
  role: 'radio' | 'checkbox' | 'button';
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'button' ? undefined : { checked: selected }}
      aria-checked={role === 'button' ? undefined : selected}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.chip, selected && styles.chosen, pressed && !selected && styles.pressed]}
    >
      <Text
        style={[
          styles.name,
          script === 'latin' && styles.latin,
          script === 'arabic' && styles.arabic,
          selected && styles.chosenName,
        ]}
      >
        {label}
      </Text>
      {focused && <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', gap: spacing['space-6'] },
  label: { ...typography.label, color: colors.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  chip: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-14'],
    borderRadius: radius['radius-chip'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    backgroundColor: colors.sheet,
  },
  chosen: { backgroundColor: colors.board, borderColor: colors.board },
  pressed: { borderColor: colors.ink },
  name: { ...typography.chip, color: colors.ink, textAlign: 'center' },
  arabic: { writingDirection: 'rtl' },
  latin: { fontFamily: fontFamilyForWeight(fontFamilies.latin, '500'), writingDirection: 'ltr' },
  chosenName: { color: colors.chalk },
  hint: { ...typography.caption, color: colors.ink2 },
  focus: { borderColor: colors.focus, borderRadius: radius['radius-chip'] - 2 },
});
