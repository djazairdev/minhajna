// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The mark keypad, as on the Marks-test board: the quick quarters, then the
// digits in rows of three from 7, always left to right like a calculator,
// with the point and «مسح» beside 0. The keys are the app's own, so the
// phone's keyboard never covers the list.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

const QUARTERS = ['.25', '.5', '.75'] as const;

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'erase'] as const;

export type MarkPadProps = {
  readonly onKey: (key: (typeof KEYS)[number]) => void;
  readonly onQuarter: (quarter: (typeof QUARTERS)[number]) => void;
};

export function MarkPad({ onKey, onQuarter }: MarkPadProps) {
  const t = useText();
  const spoken = (key: (typeof KEYS)[number]) =>
    key === 'erase' ? t('marks.entry.erase') : key === '.' ? t('marks.entry.point') : key;
  return (
    <View style={styles.pad}>
      {QUARTERS.map((quarter) => (
        <Pressable
          key={quarter}
          testID={`pad-${quarter}`}
          accessibilityRole="button"
          accessibilityLabel={quarter}
          onPress={() => onQuarter(quarter)}
          style={({ pressed }) => [styles.key, styles.quarter, pressed && styles.pressed]}
        >
          <Text style={[styles.label, styles.small]}>{quarter}</Text>
        </Pressable>
      ))}
      {KEYS.map((key) => (
        <Pressable
          key={key}
          testID={`pad-${key}`}
          accessibilityRole="button"
          accessibilityLabel={spoken(key)}
          onPress={() => onKey(key)}
          style={({ pressed }) => [styles.key, styles.digit, pressed && styles.pressed]}
        >
          <Text style={[styles.label, key === 'erase' && styles.small]}>
            {key === 'erase' ? t('marks.entry.erase') : key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'], direction: 'ltr' },
  key: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['radius-card'],
  },
  digit: { minHeight: 48, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.sheet },
  quarter: { minHeight: 48, backgroundColor: colors.soft },
  pressed: { backgroundColor: colors.hover },
  label: { ...typography.stepper, fontSize: 22, lineHeight: 28, color: colors.ink },
  small: { ...typography.button, color: colors.ink },
});
