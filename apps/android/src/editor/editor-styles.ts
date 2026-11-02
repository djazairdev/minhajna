// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

export const editorStyles = StyleSheet.create({
  page: { gap: spacing['space-16'], minWidth: 0 },
  row: { gap: spacing['space-8'], flexDirection: 'row', flexWrap: 'wrap' },
  card: { gap: spacing['space-8'], padding: spacing['space-12'], borderWidth: 1, borderColor: colors.line },
  title: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  error: { ...typography.body, color: colors['error-ink'] },
});
