// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../design/tokens';

/**
 * The thin bar of steps at the top of Getting started: one segment per step,
 * board once reached. Decoration only: TalkBack skips it, as the screen's
 * title says the step.
 */
export function SetupSteps({ count, reached, testID }: { count: number; reached: number; testID?: string }) {
  const { direction } = useLocale();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.bar, { direction }]}
    >
      {Array.from({ length: count }, (_, step) => (
        <View key={step} style={[styles.step, step < reached && styles.reached]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing['space-4'],
    paddingHorizontal: spacing['space-16'],
    paddingBottom: spacing['space-10'],
  },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  reached: { backgroundColor: colors.board },
});
