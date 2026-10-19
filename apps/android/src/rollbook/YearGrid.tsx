// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's yearly summary as a table (#217, Month-year): the
// names stay at the start, and each month's «ح-ك», «غ», «ح-ف» and rate
// scroll sideways, then the year's, with the class's totals in the last row.
// Months to come stay empty. A screen reader hears each pupil's row once,
// from the name, with the year's counts; the figures are not read again cell
// by cell.

import type { PupilCount } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { percent, totals, type YearView } from './month-rules';

const NAME = 116;
const FIGURE = 40;
const FIELDS = ['possible', 'absent', 'present', 'rate'] as const;

type Sum = ReturnType<typeof totals>;

/** A count's figures; a pupil's row leaves no absence blank, as the paper book does, and the class's shows 0. */
const figures = (count: PupilCount | Sum | null, zero = ''): string[] =>
  count === null || count.possible === 0
    ? ['', '', '', '']
    : [
        String(count.possible),
        count.absent === 0 ? zero : String(count.absent),
        String(count.present),
        percent(count.rate),
      ];

export function YearGrid(props: {
  readonly view: YearView;
  readonly monthName: (month: string) => string;
  readonly onPupil?: (pupilId: string) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const { fontScale } = useWindowDimensions();
  const scale = Math.max(1, fontScale);
  const { view } = props;
  const row = { height: Math.max(sizes.target, typography.body.lineHeight * scale + spacing['space-8']) };
  const head = { height: Math.max(sizes.target, typography['grid-head'].lineHeight * scale + spacing['space-12']) };
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const groups = [
    ...view.months.map((month, index) => ({
      key: month.month,
      label: props.monthName(month.month),
      cells: view.rows.map((one) => figures(one.months[index] ?? null)),
      total: figures(totals(view.rows.map((one) => one.months[index] ?? null)), '0'),
    })),
    {
      key: 'year',
      label: t('rollBook.yearTotal'),
      cells: view.rows.map((one) => figures(one.year)),
      total: figures(totals(view.rows.map((one) => one.year)), '0'),
    },
  ];
  return (
    <View testID="year-grid" style={[styles.table, { direction }]}>
      <View style={[styles.names, { width: NAME * scale }]}>
        <View style={[styles.cell, head, { height: 2 * head.height }]}>
          <Text style={[styles.headText, align]}>{t('rollBook.name')}</Text>
        </View>
        {view.rows.map((one) =>
          props.onPupil === undefined ? (
            <View
              key={one.id}
              testID={`year-pupil-${one.id}`}
              accessible
              accessibilityLabel={t('rollBook.row', {
                number: one.number,
                name: one.name,
                counts: [
                  t('classPage.absences', { count: one.year?.absent ?? 0 }),
                  `${t('rollBook.presentLong')} ${one.year?.present ?? 0}`,
                  one.year?.rate == null ? null : `${t('rollBook.rateLong')} ${percent(one.year.rate)}%`,
                ]
                  .filter((part) => part !== null)
                  .join('، '),
              })}
              style={[styles.cell, styles.name, row, { width: NAME * scale }]}
            >
              <Text style={styles.number}>{one.number}</Text>
              <Text numberOfLines={1} style={[styles.nameText, align]}>
                {one.name}
              </Text>
            </View>
          ) : (
            <Pressable
              key={one.id}
              testID={`year-pupil-${one.id}`}
              accessible
              accessibilityLabel={t('rollBook.row', {
                number: one.number,
                name: one.name,
                counts: [
                  t('classPage.absences', { count: one.year?.absent ?? 0 }),
                  `${t('rollBook.presentLong')} ${one.year?.present ?? 0}`,
                  one.year?.rate == null ? null : `${t('rollBook.rateLong')} ${percent(one.year.rate)}%`,
                ]
                  .filter((part) => part !== null)
                  .join('، '),
              })}
              style={[styles.cell, styles.name, row, { width: NAME * scale }]}
              accessibilityRole="button"
              onPress={() => props.onPupil?.(one.id)}
            >
              <Text style={styles.number}>{one.number}</Text>
              <Text numberOfLines={1} style={[styles.nameText, align]}>
                {one.name}
              </Text>
            </Pressable>
          ),
        )}
        <View style={[styles.cell, styles.name, styles.sum, row]}>
          <Text style={[styles.label, align]}>{t('rollBook.classTotal')}</Text>
        </View>
      </View>
      <ScrollView horizontal importantForAccessibility="no-hide-descendants" style={[styles.months, { direction }]}>
        {groups.map((group) => (
          <View key={group.key} testID={`year-month-${group.key}`} style={styles.group}>
            <View style={[styles.cell, styles.center, head]}>
              <Text style={styles.headText}>{group.label}</Text>
            </View>
            <View style={styles.fields}>
              {FIELDS.map((field, index) => (
                <View key={field} style={{ width: FIGURE * scale }}>
                  <View style={[styles.cell, styles.center, head]}>
                    <Text style={styles.headText}>{t(`rollBook.${field}`)}</Text>
                  </View>
                  {group.cells.map((cells, at) => (
                    <View key={view.rows[at]?.id ?? at} style={[styles.cell, styles.center, row]}>
                      <Text style={styles.figure}>{cells[index]}</Text>
                    </View>
                  ))}
                  <View style={[styles.cell, styles.center, styles.sum, row]}>
                    <Text style={styles.figure}>{group.total[index]}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.pencil,
    borderRadius: radius['radius-control'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  names: { borderEndWidth: 1, borderEndColor: colors.grid },
  months: { flex: 1 },
  group: { borderEndWidth: 1, borderEndColor: colors.grid },
  fields: { flexDirection: 'row' },
  cell: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-6'],
  },
  center: { alignItems: 'center' },
  headText: { ...typography['grid-head'], color: colors.ink },
  name: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-6'] },
  number: { ...typography['roll-number'], color: colors.pencil, minWidth: 20, textAlign: 'center' },
  nameText: { ...typography.body, color: colors.ink, flex: 1 },
  label: { ...typography.label, color: colors.ink, flex: 1 },
  sum: { backgroundColor: colors.soft, borderBottomWidth: 0 },
  figure: { ...typography['grid-head'], color: colors.ink },
});
