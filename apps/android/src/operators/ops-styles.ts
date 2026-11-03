// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The styles the operators' pages share (#618, #619): the page's gap, cards,
// headings, body and small text, a row of a label and its figure, and a
// problem in the error ink.

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

export const opsStyles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-4'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing['space-8'] },
  figure: { ...typography.label, color: colors.ink, fontVariant: ['tabular-nums'] },
  problem: { ...typography.body, color: colors['error-ink'] },
});
