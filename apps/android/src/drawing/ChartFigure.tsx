// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A chart with the table of its figures (#597, §5.2, the design's
// charts-and-maps.md): ECharts has no right-to-left mode and no keyboard
// navigation, so the figure mirrors the chart's axes when the page reads
// right to left, and sets the table of the same figures under it, as the
// design puts it on the canvas. On a PC the table is one keyboard stop, named
// for the chart, which a screen reader reads cell by cell, its rows named by
// their category and its columns by their series. Android gives a screen
// reader no table, so there each row is one element that says its category,
// then each series' name and figure, joined by the language's list mark, and
// the header row is skipped. Where there is no drawing kit, as on the phone,
// the table stands alone. A figure held back below the floor is left out of
// the chart and said in the table, never as a number, in a dashed cell. A
// series' figures are written to one decimal, all with it once one has it, so
// they line up. The heading is the chart's label.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { formatFigure, roundFigure } from '../text/figures';
import { currentLanguage } from '../text/i18n';
import { onPc, useDeviceText } from '../text/device-text';
import { useDrawing, type ChartSpec } from './drawing-kit';

export type ChartFigureProps = {
  /** The figures; the axes follow the page's direction. */
  readonly spec: Omit<ChartSpec, 'rightToLeft'>;
  /** What the categories are, such as the classes, as the table's first column heading. */
  readonly categoryLabel: string;
  readonly testID?: string;
};

/** A table cell: its role, whether its figure is held back, and whether it is the wider category column. */
type Cell = { readonly role: 'columnheader' | 'rowheader' | 'cell'; readonly held?: boolean; readonly wide?: boolean };

/** A chart, where the app draws one, and the table of its figures under it. */
export function ChartFigure({ spec, categoryLabel, testID }: ChartFigureProps) {
  const t = useDeviceText();
  const drawing = useDrawing();
  const { direction } = useLocale();
  if (spec.series.some((one) => one.values.length !== spec.categories.length))
    throw new RangeError('A series misses a category');
  const web = onPc();
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const fixed = spec.series.map((one) =>
    one.values.some((value) => value !== null && !Number.isInteger(roundFigure(value))),
  );
  const written = (value: number | null, place: number) =>
    value === null ? t('chart.heldBack') : formatFigure(value, language, fixed[place]);
  const cell = (key: string, words: string, { role, held = false, wide = false }: Cell) => (
    <View
      key={key}
      role={role}
      style={[styles.cell, role === 'cell' ? null : styles.head, wide && styles.category, held && styles.held]}
    >
      <Text style={[role === 'cell' ? styles.value : styles.label, held && styles.heldText, align]}>{words}</Text>
    </View>
  );
  const rowLabel = (index: number) =>
    [
      spec.categories[index],
      ...spec.series.map((one, place) => `${one.name}${t('chart.colon')}${written(one.values[index] ?? null, place)}`),
    ].join(t('chart.separator'));
  return (
    <View testID={testID} style={[styles.block, { direction }]}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {spec.label}
      </Text>
      {drawing !== null && (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          <drawing.Chart spec={{ ...spec, rightToLeft: direction === 'rtl' }} testID={testID && `${testID}-chart`} />
        </View>
      )}
      <View
        testID={testID && `${testID}-table`}
        role="table"
        focusable={web}
        accessibilityLabel={web ? spec.label : undefined}
        style={styles.table}
      >
        <View
          role="row"
          style={styles.row}
          accessibilityElementsHidden={!web}
          importantForAccessibility={web ? 'auto' : 'no-hide-descendants'}
        >
          {cell('category', categoryLabel, { role: 'columnheader', wide: true })}
          {spec.series.map((one, place) => cell(`series-${place}`, one.name, { role: 'columnheader' }))}
        </View>
        {spec.categories.map((category, index) => (
          <View
            key={`category-${index}`}
            role="row"
            accessible={!web}
            accessibilityLabel={web ? undefined : rowLabel(index)}
            style={[styles.row, styles.ruled]}
          >
            {cell('category', category, { role: 'rowheader', wide: true })}
            {spec.series.map((one, place) => {
              const value = one.values[index] ?? null;
              return cell(`series-${place}`, written(value, place), { role: 'cell', held: value === null });
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  cell: { flex: 1, minWidth: 0, paddingVertical: spacing['space-8'], paddingHorizontal: spacing['space-12'] },
  category: { flex: 1.5 },
  head: { backgroundColor: colors.well },
  held: {
    backgroundColor: colors['hatch-ground'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors['book-edge'],
  },
  label: { ...typography.small, color: colors.ink },
  value: { ...typography.body, color: colors.ink },
  heldText: { color: colors.ink2 },
});
