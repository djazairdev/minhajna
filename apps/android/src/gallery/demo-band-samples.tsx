// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, View } from 'react-native';
import { DemoBand } from '../demo/DemoBand';
import { spacing } from '../design/tokens';
import { demoBandTexts } from './demo-band-texts';
import type { SampleProps } from './samples';

/** The demo band with a world's date, and before its date is known (#557). */
export function DemoBandSamples({ language }: Pick<SampleProps, 'language'>) {
  return (
    <View style={styles.group}>
      <DemoBand testID="demo-band-dated" date={demoBandTexts[language].date} />
      <DemoBand testID="demo-band-undated" date={null} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingVertical: spacing['space-12'], gap: spacing['space-12'] },
});
