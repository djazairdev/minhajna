// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The styles Obs-Report's page and cards share (#627): the page's gap, cards,
// headings, text, a table's rows and cells, a median above the plan, the band's
// pill, the track of how far classes got, and a problem in the error ink.

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

export const obsStyles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  quiet: { height: 0, marginBottom: -spacing['space-12'] },
  problem: { ...typography.body, color: colors['error-ink'] },
  row: { flexDirection: 'row', gap: spacing['space-8'], paddingVertical: spacing['space-4'] },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  wide: { flex: 2, minWidth: 0 },
  cell: { flex: 1, minWidth: 0 },
  above: { ...typography.label, color: colors['warn-ink'] },
  changed: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  band: {
    ...typography.small,
    color: colors.ink,
    backgroundColor: colors.well,
    borderRadius: radius['radius-card'],
    paddingHorizontal: spacing['space-8'],
  },
  track: { height: spacing['space-8'], borderRadius: radius['radius-card'], backgroundColor: colors.well },
  middle: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.rule },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.board },
});
