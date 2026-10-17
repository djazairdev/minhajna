// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, sizes, spacing, typography } from '../design/tokens';
import { controlStyles } from './control';

/** The screen supplies translated, non-sensitive feedback and owns undo, replacement and dismissal. */
export type SnackbarProps = {
  readonly message: string;
  readonly undoLabel: string;
  readonly onUndo: () => void;
  /** Actual distance from this overlay's bottom to the navigation bar's top, including its safe inset. */
  readonly bottomOffset: number;
  readonly testID?: string;
};

/**
 * A polite status above the measured navigation bar, without stealing focus.
 * Mount in a positioned screen container. Reserve content space there too.
 * No timer expires the undo action; persistence and reversal belong to the screen.
 */
export function Snackbar({ message, undoLabel, onUndo, bottomOffset, testID = 'snackbar' }: SnackbarProps) {
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const enlarged = fontScale >= 1.5;
  return (
    <View
      testID={testID}
      style={[
        styles.snack,
        enlarged && styles.stacked,
        {
          direction,
          bottom: bottomOffset + spacing['space-12'],
          left: insets.left + spacing['space-12'],
          right: insets.right + spacing['space-12'],
        },
      ]}
    >
      <Text
        role="status"
        accessibilityLiveRegion="polite"
        style={[styles.message, enlarged && { flex: 0 }, { writingDirection: direction, textAlign: 'start' }]}
      >
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={undoLabel}
        onPress={onUndo}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [styles.undo, pressed && { borderColor: colors.hi }]}
      >
        <Text style={styles.undoLabel}>{undoLabel}</Text>
        {focused && <View pointerEvents="none" accessible={false} style={[controlStyles.focus, styles.focus]} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  snack: {
    position: 'absolute',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    padding: spacing['space-4'],
    paddingStart: spacing['space-16'],
    borderRadius: radius['radius-button'],
    backgroundColor: colors.board,
    boxShadow: shadows['shadow-snack'],
  },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  message: { ...typography.body, color: colors.chalk, flex: 1 },
  undo: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    maxWidth: '100%',
    alignSelf: 'flex-end',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-8'],
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius['radius-button'],
  },
  undoLabel: { ...typography.button, color: colors.hi, textAlign: 'center', flexShrink: 1 },
  focus: { borderColor: colors['focus-on-board'], borderRadius: radius['radius-button'] - 2 },
});
