// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report's cards for one pack's figure (#627, answer 680), each saying how
// many classes it rests on: the median sessions by item, a table with the plan
// beside it when the app holds the pack, a median above the plan said in words
// as well as marked, a hidden one said as held back; the items most often
// split, merged, skipped and re-taught, each with its band, never a percentage,
// and how many others share it; and how far classes got, the median and the
// middle half in percent of the plan, drawn on a track the table's words
// already say. On a PC the table is read cell by cell, and on a phone each row
// is one element, as ChartFigure's.

import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { formatFigure } from '../text/figures';
import { currentLanguage } from '../text/i18n';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { Figure } from './figures-read';
import { obsStyles as styles } from './obs-styles';
import { bandWords, CHANGES, classesRange, mostChanged, percentOf, type ReportRow } from './report-figures';

const useAlign = () => {
  const { direction } = useLocale();
  return { writingDirection: direction, textAlign: 'start' } as const;
};

const written = (value: number) => formatFigure(value, currentLanguage());

/** How many classes the items shown rest on. */
function ItemClasses({ rows }: { readonly rows: readonly ReportRow[] }) {
  const t = useDeviceText();
  const align = useAlign();
  const range = classesRange(rows);
  if (range === null) return null;
  const words =
    range.low === range.high
      ? t('demo.obsReport.itemClassesSame', { classes: written(range.low) })
      : t('demo.obsReport.itemClasses', { low: written(range.low), high: written(range.high) });
  return <Text style={[styles.small, align]}>{words}</Text>;
}

/** The median sessions by item, with the plan beside it. */
export function MedianCard({ rows }: { readonly rows: readonly ReportRow[] }) {
  const t = useDeviceText();
  const align = useAlign();
  const web = onPc();
  const heading = t('demo.obsReport.medians');
  const planOf = (row: ReportRow) => (row.plan === null ? t('demo.obsReport.noPlan') : written(row.plan));
  const medianOf = (row: ReportRow) => {
    const median = row.item?.sessions ?? null;
    if (median === null) return t('chart.heldBack');
    return row.above ? t('demo.obsReport.above', { median: written(median) }) : written(median);
  };
  const label = (row: ReportRow) =>
    [
      isolate(row.title),
      `${t('demo.obsReport.plan')}${t('chart.colon')}${planOf(row)}`,
      `${t('demo.obsReport.median')}${t('chart.colon')}${medianOf(row)}`,
    ].join(t('chart.separator'));
  return (
    <View testID="obs-medians" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {heading}
      </Text>
      <View role="table" focusable={web} accessibilityLabel={web ? heading : undefined}>
        <View
          role="row"
          style={styles.row}
          accessibilityElementsHidden={!web}
          importantForAccessibility={web ? 'auto' : 'no-hide-descendants'}
        >
          <Text role="columnheader" style={[styles.small, styles.wide, align]}>
            {t('demo.obsReport.item')}
          </Text>
          <Text role="columnheader" style={[styles.small, styles.cell, align]}>
            {t('demo.obsReport.plan')}
          </Text>
          <Text role="columnheader" style={[styles.small, styles.cell, align]}>
            {t('demo.obsReport.median')}
          </Text>
        </View>
        {rows.map((row) => (
          <View
            key={row.id}
            testID={`obs-median-${row.id}`}
            role="row"
            accessible={!web}
            accessibilityLabel={web ? undefined : label(row)}
            style={[styles.row, styles.ruled]}
          >
            <Text role="rowheader" style={[styles.small, styles.wide, align]}>
              {isolate(row.title)}
            </Text>
            <Text role="cell" style={[styles.small, styles.cell, align]}>
              {planOf(row)}
            </Text>
            <Text role="cell" style={[row.above ? styles.above : styles.small, styles.cell, align]}>
              {medianOf(row)}
            </Text>
          </View>
        ))}
      </View>
      <ItemClasses rows={rows} />
    </View>
  );
}

/** The items most often changed, each with its band. */
export function ChangedCard({ rows }: { readonly rows: readonly ReportRow[] }) {
  const t = useDeviceText();
  const align = useAlign();
  return (
    <View testID="obs-changed" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.obsReport.changed')}
      </Text>
      {CHANGES.map((change) => {
        const most = mostChanged(rows, change);
        if (most === null) return null;
        const { key, low, high } = bandWords(most.band);
        return (
          <View key={change} testID={`obs-most-${change}`} accessible style={styles.changed}>
            <Text style={[styles.small, align]}>{t(`demo.obsReport.most.${change}`)}</Text>
            <Text style={[styles.body, align]}>{isolate(most.row.title)}</Text>
            <Text style={styles.band}>{t(`demo.obsReport.band.${key}`, { low, high })}</Text>
            {most.others > 0 && (
              <Text style={[styles.small, align]}>
                {t('demo.obsReport.sameBand', { others: written(most.others) })}
              </Text>
            )}
          </View>
        );
      })}
      <Text style={[styles.small, align]}>{t('demo.obsReport.bands')}</Text>
      <ItemClasses rows={rows} />
    </View>
  );
}

/** How far classes got by the term's end. */
export function ReachedCard({ figure }: { readonly figure: Figure }) {
  const t = useDeviceText();
  const align = useAlign();
  const { low, median, high } = figure.reached;
  return (
    <View testID="obs-reached" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.obsReport.reached')}
      </Text>
      <View
        style={styles.track}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <View style={[styles.middle, { start: `${percentOf(low)}%`, width: `${percentOf(high - low)}%` }]} />
        <View style={[styles.mark, { start: `${Math.min(percentOf(median), 99)}%` }]} />
      </View>
      <Text style={[styles.body, align]}>
        {t('demo.obsReport.reachedMedian', { median: written(percentOf(median)) })}
      </Text>
      <Text style={[styles.small, align]}>
        {t('demo.obsReport.reachedMiddle', { low: written(percentOf(low)), high: written(percentOf(high)) })}
      </Text>
      <Text style={[styles.small, align]}>
        {t('demo.obsReport.figureClasses', { classes: written(figure.classes) })}
      </Text>
    </View>
  );
}
