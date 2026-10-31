// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, sizes, spacing, typography } from '../design/tokens';
import { Icon, type IconName } from '../design/Icon';

/**
 * A display-only result; its stable ID is local to this list, not a record identifier. A kept fact with an icon is
 * drawn with it, in a neutral colour, for what is kept by someone else.
 */
export type KeptFact = {
  readonly id: string;
  readonly text: string;
  readonly kept: boolean;
  readonly icon?: IconName;
};

/** Kept summaries require translated state words because a strike-through is not spoken by TalkBack. */
export type FactsProps =
  | {
      readonly facts: readonly { readonly icon: IconName; readonly text: string }[];
      readonly kept?: never;
    }
  | {
      readonly facts?: never;
      readonly kept: readonly KeptFact[];
      readonly keptLabel: string;
      readonly notKeptLabel: string;
    };

/** At most three promises, or all the results of a step, including explicitly named exclusions. */
export function Facts(props: FactsProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (props.kept !== undefined) {
    return (
      <View style={[styles.list, { direction }]}>
        {props.kept.map((fact) => (
          <View
            key={fact.id}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${fact.kept ? props.keptLabel : props.notKeptLabel}: ${fact.text}`}
            style={styles.kept}
          >
            <Icon
              name={fact.icon ?? (fact.kept ? 'check' : 'cross')}
              size={sizes.icon}
              color={fact.kept && fact.icon === undefined ? colors.board : colors.ink2}
            />
            <Text style={[styles.keptText, align, !fact.kept && styles.notKept]}>{fact.text}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.list, { direction }]}>
      {props.facts.slice(0, 3).map((fact) => (
        <View key={fact.icon} style={styles.fact}>
          <Icon name={fact.icon} size={sizes.icon} color={colors.board} />
          <Text style={[styles.text, align]}>{fact.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-2'] },
  fact: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing['space-12'] },
  text: { ...typography.body, color: colors.ink, flex: 1 },
  kept: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  keptText: { ...typography.fact, color: colors.ink, flex: 1, minWidth: 0 },
  notKept: { color: colors.ink2, textDecorationLine: 'line-through' },
});
