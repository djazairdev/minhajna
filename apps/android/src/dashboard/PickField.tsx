// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A select on the dashboard's pages: its label, what is chosen and a sheet of
// the choices, with a search when there are many. The founder's rule on these
// screens: a select for a long list, no helper text and no placeholder.

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import { Icon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

export type PickChoice = { readonly value: string; readonly label: string };

export type PickFieldProps = {
  readonly label: string;
  readonly choices: readonly PickChoice[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  /** Marks a select left empty that should not be, by its edge as well as its colour. */
  readonly warn?: boolean;
  /** A cell of a grid: the label is spoken and titles the sheet, but is not shown. */
  readonly compact?: boolean;
  readonly testID: string;
};

/** From this many choices, the sheet offers a search. */
const MANY = 9;

/** Whether a choice's words hold what was typed, whatever the case. */
export function pickMatches(choice: PickChoice, typed: string): boolean {
  return choice.label.toLocaleLowerCase().includes(typed.trim().toLocaleLowerCase());
}

/** A labelled select. */
export function PickField(props: PickFieldProps) {
  const { label, choices, value, onChange, disabled = false, warn = false, compact = false, testID } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const opener = useRef<ViewInstance>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const chosen = choices.find((choice) => choice.value === value);
  const shown = choices.filter((choice) => pickMatches(choice, typed));
  const close = () => {
    setOpen(false);
    setTyped('');
  };
  return (
    <View style={compact ? styles.cell : styles.field}>
      {!compact && <Text style={[styles.label, align]}>{label}</Text>}
      <Pressable
        ref={opener}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? ''}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.box, compact && styles.small, warn && styles.warn, disabled && styles.off]}
      >
        <Text numberOfLines={compact ? 2 : 1} style={[styles.value, compact && styles.smallWords, align]}>
          {chosen?.label ?? ''}
        </Text>
        {!compact && (
          <View style={styles.chevron}>
            <Icon name="chevron" size={sizes['icon-small']} color={colors.ink2} />
          </View>
        )}
      </Pressable>
      <BottomSheet visible={open} title={label} context="" reassurance="" onClose={close} returnFocusRef={opener}>
        {choices.length >= MANY && (
          <TextField testID={`${testID}-search`} label={t('dashboard.search')} value={typed} onChangeText={setTyped} />
        )}
        {shown.map((choice) => (
          <OptionRow
            key={choice.value}
            testID={`${testID}-${choice.value}`}
            label={choice.label}
            selected={choice.value === value}
            onPress={() => {
              close();
              onChange(choice.value);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing['space-4'], minWidth: 180, flexShrink: 1 },
  label: { ...typography.small, color: colors.ink2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    minHeight: 44,
    paddingHorizontal: spacing['space-10'],
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  off: { opacity: 0.45 },
  cell: { flex: 1, minWidth: 0 },
  small: { minHeight: 40, paddingHorizontal: spacing['space-4'], borderWidth: 1, borderRadius: radius['radius-tag'] },
  smallWords: { ...typography.small },
  warn: { borderColor: colors['notice-edge'], backgroundColor: colors.notice, borderStartWidth: 4 },
  value: { ...typography.body, color: colors.ink, flex: 1, minWidth: 0 },
  chevron: { transform: [{ rotate: '90deg' }] },
});
