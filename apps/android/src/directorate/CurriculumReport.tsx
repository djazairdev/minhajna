// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curriculum report, M-Totals' second tab (#598, R-7.9-06, answer 629): for
// each subject the directorate holds, its classes, how far they got on average,
// in percent of their plans, and the plans that run long, then a table with a
// row for each plan item, in the packs' order, named by its title when the
// packs agree on one (item-names.ts) and by its ID otherwise, and a column for
// its sessions and for the classes that merged, skipped or re-taught it, as the
// owed table does (OwedTable.tsx), the item's column twice as wide; a subject
// with no item says so. A hidden subject or item says it is under the minimum
// group sizes, an item in one cell across the figures' columns. Every item is
// drawn at once, as the demo's packs hold under 100 each (answer 629).

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { ItemNames } from './item-names';
import type { DirectorateFigures, Figure } from './totals-read';

const ITEM = ['sessions', 'merged', 'skipped', 'retaught'] as const;

export type CurriculumReportProps = {
  readonly figures: DirectorateFigures;
  /** A subject's name in the interface's language. */
  readonly subject: (code: string) => string;
  readonly names: ItemNames;
};

/** How far a subject's classes got on average, in whole percent never above it, as the dashboard says it. */
export const averageReached = (figure: Pick<Figure, 'reached' | 'classes'>) =>
  figure.classes === 0 ? 0 : Math.floor(figure.reached / figure.classes / 10);

/** The report's sections, one for each subject the directorate holds. */
export function CurriculumReport({ figures, subject, names }: CurriculumReportProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const cell = (key: string, words: string, role: 'columnheader' | 'rowheader' | 'cell', weight = 1, span = 1) => (
    <View
      key={key}
      role={role}
      {...(span > 1 ? ({ 'aria-colspan': span } as object) : {})}
      style={[styles.cell, { flex: weight }, role === 'columnheader' && styles.head]}
    >
      <Text style={[role === 'cell' ? styles.value : styles.label, align]}>{words}</Text>
    </View>
  );
  return (
    <View testID="curriculum-report" style={styles.report}>
      {figures.subjects.map(([code, figure]) => (
        <View key={code} testID={`report-${code}`} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {subject(code)}
          </Text>
          {figure === null ? (
            <Text style={[styles.body, align]}>{t('demo.totals.hidden')}</Text>
          ) : (
            <>
              <Text style={[styles.body, align]}>
                {t('demo.totals.reportLine', {
                  classes: figure.classes,
                  reached: averageReached(figure),
                  long: figure.runLong,
                })}
              </Text>
              {figure.items.length === 0 ? (
                <Text style={[styles.body, align]}>{t('demo.totals.noItems')}</Text>
              ) : (
                <View
                  role="table"
                  focusable
                  accessibilityLabel={t('demo.totals.items', { subject: subject(code) })}
                  style={styles.table}
                >
                  <View role="row" style={styles.row}>
                    {cell('item', t('demo.totals.column.item'), 'columnheader', 2)}
                    {ITEM.map((one) => cell(one, t(`demo.totals.column.${one}`), 'columnheader'))}
                  </View>
                  {names.sorted(code, figure.items).map(([item, one]) => (
                    <View key={item} testID={`report-${code}-${item}`} role="row" style={[styles.row, styles.ruled]}>
                      {cell('item', names.title(code, item) ?? item, 'rowheader', 2)}
                      {one === null
                        ? cell('hidden', t('demo.totals.hidden'), 'cell', ITEM.length, ITEM.length)
                        : ITEM.map((field) => cell(field, String(one[field]), 'cell'))}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  report: { gap: spacing['space-16'] },
  section: { gap: spacing['space-8'] },
  heading: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink2 },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  cell: { minWidth: 0, paddingVertical: spacing['space-8'], paddingHorizontal: spacing['space-8'] },
  head: { backgroundColor: colors.well },
  label: { ...typography.label, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
});
