// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

/** Shared paper screens; all text and rows grow with the phone's text size. */
export const settingsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-8'] },
  card: {
    gap: spacing['space-8'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    padding: spacing['space-14'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  foot: { gap: spacing['space-8'], padding: spacing['space-16'], backgroundColor: colors.paper },
});
