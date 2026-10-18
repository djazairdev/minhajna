// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { rowLinkTexts } from './row-link-texts';
import { fill, type SampleProps } from './samples';

/** Local activation feedback proves the whole row works without opening a destination. */
export function RowLinkSamples({ language, sample }: SampleProps) {
  const [count, setCount] = useState(0);
  const text = rowLinkTexts[language];
  const activate = () => setCount((current) => current + 1);
  return (
    <View style={styles.group}>
      <RowLink testID="row-link-short" icon={controlIcon('info')} title={text.short} onPress={activate} />
      <RowLink
        testID="row-link-long"
        icon={controlIcon('school')}
        title={text.long}
        description={text.description}
        onPress={activate}
      />
      <RowLink
        testID="row-link-disabled"
        disabled
        icon={controlIcon('lock')}
        title={text.disabled}
        description={text.unavailable}
        onPress={activate}
      />
      <Text testID="row-link-activations" accessibilityLiveRegion="polite" style={styles.note}>
        {fill(sample.activations, { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-12'], gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2 },
});
