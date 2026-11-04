// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights pages' styles (#624), shared by the page and its states, after
// the national system's Help (NationalHelp.tsx).

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

export const insightsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  titles: { flexShrink: 1 },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  row: { gap: spacing['space-2'], paddingVertical: spacing['space-8'] },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  note: { ...typography.small, color: colors.ink },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
