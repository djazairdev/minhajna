// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

/** The read-only month scrolls horizontally when enlarged text needs room. */
export const calendarStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  heading: { ...typography.label, color: colors.ink, flex: 1, textAlign: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  grid: { flexGrow: 1 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['space-6'] },
  day: { ...typography.small, color: colors.ink, textAlign: 'center' },
  outside: { color: colors.ink2 },
  rest: { backgroundColor: colors.soft },
  today: { borderWidth: 2, borderColor: colors.board, borderRadius: 8 },
  events: { color: colors.board, fontWeight: '700' },
});
