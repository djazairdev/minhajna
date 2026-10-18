// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, View } from 'react-native';
import { Badge } from '../components/Badge';
import { spacing } from '../design/tokens';
import { badgeTexts } from './badge-texts';
import type { SampleProps } from './samples';

/** Every state, plus a longer two-word label that can wrap at 200% text. */
export function BadgeSamples({ language }: SampleProps) {
  const text = badgeTexts[language];
  return (
    <View style={styles.group}>
      <View style={styles.row}>
        {(['default', 'done', 'warning'] as const).map((variant) => (
          <Badge key={variant} testID={`badge-${variant}`} variant={variant} label={text[variant]} />
        ))}
      </View>
      <Badge testID="badge-long" label={text.long} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-12'], gap: spacing['space-12'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
