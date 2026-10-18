// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock's four dots and its keypad, as on the board in the Lock design:
// round keys of 72dp in rows of three, always left to right as on a phone's
// own keypad, with the fingerprint key at the bottom left and «مسح» at the
// bottom right. The digits are the app's own keys, so the phone's keyboard
// never sees the PIN.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { PIN_LENGTH } from './lock-rules';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

export type PinPadProps = {
  /** The digits typed so far; only their count shows. */
  readonly length: number;
  readonly onDigit: (digit: string) => void;
  readonly onDelete: () => void;
  /** Shows the fingerprint key, which opens the phone's own prompt. */
  readonly onBiometric?: () => void;
  /** No digit answers while a wait runs or a PIN is being checked. */
  readonly disabled?: boolean;
  /** The fingerprint key still works during a wait, but not while the phone's prompt is up. */
  readonly biometricDisabled?: boolean;
};

/** The dots, then the keys. A screen reader hears how many digits are typed, never which. */
export function PinPad({
  length,
  onDigit,
  onDelete,
  onBiometric,
  disabled = false,
  biometricDisabled = false,
}: PinPadProps) {
  const t = useText();
  const digit = (value: string) => (
    <Key key={value} testID={`pin-${value}`} label={value} disabled={disabled} onPress={() => onDigit(value)}>
      <Text style={styles.digit}>{value}</Text>
    </Key>
  );
  return (
    <View style={styles.pad}>
      <View
        accessible
        accessibilityLiveRegion={length === 0 ? 'none' : 'polite'}
        accessibilityLabel={t('lock.entered', { count: length, total: PIN_LENGTH })}
        style={styles.dots}
        testID="pin-dots"
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View key={index} style={[styles.dot, index < length && styles.filled]} />
        ))}
      </View>
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map(digit)}
        </View>
      ))}
      <View style={styles.row}>
        {onBiometric ? (
          <Key
            testID="pin-biometric"
            label={t('lock.biometricLabel')}
            disabled={biometricDisabled}
            onPress={onBiometric}
            ghost
          >
            <Text style={styles.word}>{t('lock.biometric')}</Text>
          </Key>
        ) : (
          <View style={styles.key} />
        )}
        {digit('0')}
        <Key testID="pin-delete" label={t('lock.delete')} disabled={disabled || length === 0} onPress={onDelete} ghost>
          <Text style={styles.word}>{t('lock.delete')}</Text>
        </Key>
      </View>
    </View>
  );
}

function Key({
  label,
  onPress,
  disabled,
  ghost = false,
  testID,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  ghost?: boolean;
  testID: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        !ghost && styles.ring,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: spacing['space-12'], direction: 'ltr' },
  dots: {
    flexDirection: 'row',
    gap: spacing['space-14'],
    minHeight: 48,
    alignItems: 'center',
    paddingHorizontal: spacing['space-12'],
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors['chalk-70'] },
  filled: { backgroundColor: colors.chalk, borderColor: colors.chalk },
  row: { flexDirection: 'row', gap: 22 },
  key: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 1.5, borderColor: colors['chalk-22'] },
  pressed: { backgroundColor: colors['chalk-14'] },
  disabled: { opacity: 0.4 },
  digit: { ...typography.stepper, fontSize: 26, lineHeight: 30, color: colors.chalk },
  word: { ...typography.button, color: colors.chalk, textAlign: 'center' },
});
