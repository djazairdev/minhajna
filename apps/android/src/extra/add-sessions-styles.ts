// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

/** The shared add/edit page grows with text and keeps room above its undo message. */
export const addSessionsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
