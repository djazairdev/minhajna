// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Insights-compare's table and lines (#623), its columns sharing one set of
// ratios so numbers stay under their headings at any text size.

import { StyleSheet } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, spacing } from '../design/tokens';

export const compareStyles = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: radius['radius-card'], overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  stacked: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  heading: { borderTopWidth: 0 },
  title: { flex: 2.4 },
  titleAbove: { width: '100%' },
  count: { flex: 1, textAlign: 'center' },
  over: { fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700' },
  change: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  changeLine: { flex: 1, minWidth: 160 },
  band: { flexShrink: 0 },
  place: { gap: spacing['space-2'] },
});
