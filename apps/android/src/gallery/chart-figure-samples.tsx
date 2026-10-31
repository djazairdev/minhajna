// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StyleSheet, View } from 'react-native';
import { spacing } from '../design/tokens';
import { ChartFigure } from '../drawing/ChartFigure';
import { chartFigureTexts } from './chart-figure-texts';
import type { SampleProps } from './samples';

/** A chart with its table, the latest figures and an earlier snapshot, one figure held back below the floor (#597). */
export function ChartFigureSamples({ language }: Pick<SampleProps, 'language'>) {
  const texts = chartFigureTexts[language];
  const series = [
    { name: texts.latest, values: [62, null, 71] },
    { name: texts.earlier, values: [48, 52, 55] },
  ];
  return (
    <View style={styles.group}>
      <ChartFigure
        testID="chart-figure-bars"
        categoryLabel={texts.categoryLabel}
        spec={{ kind: 'bar', label: texts.label, categories: texts.categories, series }}
      />
      <ChartFigure
        testID="chart-figure-lines"
        categoryLabel={texts.categoryLabel}
        spec={{ kind: 'line', label: texts.label, categories: texts.categories, series: series.slice(1) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingVertical: spacing['space-12'], gap: spacing['space-16'] },
});
