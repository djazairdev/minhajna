// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing, typography } from '../design/tokens';
import type { SampleProps } from './samples';
import { segmentedControlTexts } from './segmented-control-texts';

/** Two or three views, and an inactive pair; each active preview owns only its selection. */
export function SegmentedControlSamples({ sample, language }: SampleProps) {
  const text = segmentedControlTexts[language];
  const [view, setView] = useState<'list' | 'seats'>('list');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const choices = [
    { value: 'list', label: text.views[0] },
    { value: 'seats', label: text.views[1] },
  ] as const;
  return (
    <View style={styles.group}>
      <Text style={styles.note}>{text.view}</Text>
      <SegmentedControl testID="segments-two" label={text.view} choices={choices} selected={view} onSelect={setView} />
      <Text style={styles.note}>{text.period}</Text>
      <SegmentedControl
        testID="segments-three"
        label={text.period}
        choices={[
          { value: 'day', label: text.periods[0] },
          { value: 'week', label: text.periods[1] },
          { value: 'month', label: text.periods[2] },
        ]}
        selected={period}
        onSelect={setPeriod}
      />
      <Text style={styles.note}>{sample.disabled}</Text>
      <SegmentedControl
        label={text.view}
        choices={choices}
        selected="seats"
        onSelect={setView}
        disabled
        testID="segments-disabled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-8'] },
  note: { ...typography.caption, color: colors.ink2 },
});
