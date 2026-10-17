// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../design/tokens';
import { Icon, type IconName } from '../design/Icon';

/** At most three short promises, each one a fact the app keeps (docs/design/system/components/Facts). */
export function Facts({ facts }: { facts: readonly { readonly icon: IconName; readonly text: string }[] }) {
  const { direction } = useLocale();
  return (
    <View style={[styles.list, { direction }]}>
      {facts.slice(0, 3).map((fact) => (
        <View key={fact.icon} style={styles.fact}>
          <Icon name={fact.icon} size={sizes.icon} color={colors.board} />
          <Text style={[styles.text, { writingDirection: direction, textAlign: 'start' }]}>{fact.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-2'] },
  fact: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing['space-12'] },
  text: { ...typography.body, color: colors.ink, flex: 1 },
});
