// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One rung of «خيارات الاستدراك» (#228, #229, Catchup): its number, then
// its title as a header, then what it offers.

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

export function Rung({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  const { direction } = useLocale();
  return (
    <View testID={`catchup-rung-${number}`} style={styles.rung}>
      <Text style={styles.number}>{number}</Text>
      <View style={styles.grow}>
        <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rung: {
    flexDirection: 'row',
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  number: { ...typography.label, color: colors.ink2, minWidth: 20 },
  grow: { flex: 1, gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
});
