// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

/** The recovery key's six numbered groups, left to right in every language, wrapping at large text. */
export const recoveryStyles = StyleSheet.create({
  groups: { flexDirection: 'row', flexWrap: 'wrap', direction: 'ltr', gap: spacing['space-8'] },
  group: {
    alignItems: 'center',
    minWidth: 88,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius['radius-card'],
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    backgroundColor: colors.paper,
  },
  number: { ...typography.small, color: colors.ink2 },
  letters: { ...typography.stat, color: colors.ink, letterSpacing: 2 },
});
