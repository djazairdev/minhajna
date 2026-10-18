// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

/** A short, translated state of content, never a rating of a teacher. */
export type BadgeProps = {
  readonly label: string;
  readonly variant?: 'default' | 'done' | 'warning';
  readonly testID?: string;
};

/** Static text, not a control or an unsolicited live announcement; enlarged labels can wrap. */
export function Badge({ label, variant = 'default', testID }: BadgeProps) {
  const { direction } = useLocale();
  return (
    <Text
      testID={testID}
      accessible
      accessibilityRole="text"
      style={[styles.badge, styles[variant], { writingDirection: direction }]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...typography.badge,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-badge'],
    textAlign: 'start',
  },
  default: { color: colors.ink2, backgroundColor: colors['pill-on'] },
  done: { color: colors['ok-ink'], backgroundColor: colors.ok },
  warning: { color: colors['notice-ink'], backgroundColor: colors['notice-strong'] },
});
