// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

/** The look of Today's special-day, council and cover cards. */
export const specialStyles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  about: { gap: spacing['space-8'] },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  sub: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
