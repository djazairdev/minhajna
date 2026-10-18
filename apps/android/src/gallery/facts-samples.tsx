// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, View } from 'react-native';
import { Facts } from '../components/Facts';
import { spacing } from '../design/tokens';
import { factsTexts } from './facts-texts';
import type { SampleProps } from './samples';
import { FactsSamples as PromiseSamples } from './welcome-samples';

/** The existing welcome promises and every made-up kept result, not limited to three. */
export function FactsSamples({ language }: SampleProps) {
  const text = factsTexts[language];
  return (
    <View style={styles.group}>
      <PromiseSamples />
      <Facts
        keptLabel={text.kept}
        notKeptLabel={text.notKept}
        kept={[
          { id: 'classes', text: text.classes, kept: true },
          { id: 'week', text: text.week, kept: true },
          { id: 'long', text: text.long, kept: true },
          { id: 'excluded', text: text.excluded, kept: false },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ group: { padding: spacing['space-12'], gap: spacing['space-12'] } });
