// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A select input (answers 802 and 804): a labelled field showing the chosen
// option, which opens a bottom sheet of option rows, the chosen one ticked.
// A long list gets a search field at the top of the sheet, which matches any
// part of an option's name as the wilaya search does (zone-search.ts). The
// label is spoken once, as the field's name. The sheet and the search carry
// the field's test ID with a slash, which no option's value holds. Choosing an
// option closes the sheet; closing it chooses nothing. With no options, the
// field is disabled.

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewInstance } from 'react-native';
import { controlIcon } from '../design/Icon';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { fold } from '../setup/zone-search';
import { useText } from '../text/i18n';
import { BottomSheet } from './BottomSheet';
import { controlStyles } from './control';
import { OptionRow } from './OptionRow';
import { TextField } from './TextField';

/** How many options a list holds before the sheet offers a search. */
export const SEARCH_FROM = 8;

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  readonly testID?: string;
}

/** A labelled select; the chosen option's name shows in the field. */
export function Select({ label, options, value, onChange, testID }: SelectProps) {
  const { direction } = useLocale();
  const t = useText();
  const opener = useRef<ViewInstance>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const chosen = options.find((option) => option.value === value);
  const disabled = options.length === 0;
  const wanted = fold(search);
  const shown = wanted === '' ? options : options.filter((option) => fold(option.label).includes(wanted));
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const close = () => {
    setOpen(false);
    setSearch('');
  };
  return (
    <View style={styles.group}>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={[styles.label, align]}>
        {label}
      </Text>
      <Pressable
        ref={opener}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={chosen === undefined ? label : `${label}: ${chosen.label}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { direction },
          pressed && styles.pressed,
          disabled && controlStyles.disabled,
        ]}
      >
        <Text style={[styles.value, align]}>{chosen?.label ?? ''}</Text>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.chevron, { transform: [{ rotate: direction === 'rtl' ? '-90deg' : '90deg' }] }]}
        >
          {controlIcon('chevron')({ size: sizes['icon-small'], color: colors.ink2 })}
        </View>
      </Pressable>
      <BottomSheet
        testID={testID === undefined ? undefined : `${testID}/sheet`}
        visible={open}
        title={label}
        onClose={close}
        returnFocusRef={opener}
      >
        <View style={styles.options}>
          {options.length > SEARCH_FROM && (
            <TextField
              testID={testID === undefined ? undefined : `${testID}/search`}
              label={t('select.search')}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          )}
          {shown.map((option) => (
            <OptionRow
              key={option.value}
              testID={testID === undefined ? undefined : `${testID}-${option.value}`}
              label={option.label}
              selected={option.value === value}
              onPress={() => {
                close();
                onChange(option.value);
              }}
            />
          ))}
          {shown.length === 0 && <Text style={[styles.none, align]}>{t('select.none')}</Text>}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-6'], alignSelf: 'stretch' },
  label: { ...typography.label, color: colors.ink2 },
  field: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingVertical: spacing['space-10'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  pressed: { backgroundColor: colors.soft, borderColor: colors.ink },
  value: { ...typography.body, color: colors.ink, flex: 1, minWidth: 0 },
  chevron: { direction: 'ltr' },
  options: { gap: spacing['space-8'] },
  none: { ...typography.body, color: colors.ink2 },
});
