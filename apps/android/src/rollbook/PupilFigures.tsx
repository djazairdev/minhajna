// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A pupil's figures in the roll-call book (#217, Pupil and Pupil-year): for
// a month, «ح-ك», «غ», «ح-ف» and the rate side by side, each read as its
// figure and its full name; for the year, a row for each month and one for
// the year, months to come empty. Figures use Western digits.

import type { PupilCount } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { percent } from './month-rules';

const FIELDS = ['possible', 'absent', 'present', 'rate'] as const;

function values(count: PupilCount | null): string[] {
  if (count === null || count.possible === 0) return ['', '', '', ''];
  return [String(count.possible), String(count.absent), String(count.present), `${percent(count.rate)}%`];
}

/** The month's four figures. */
export function PupilFigures(props: { readonly count: PupilCount | null }) {
  const t = useText();
  const { direction } = useLocale();
  const figures = values(props.count);
  const long = [t('rollBook.possibleLong'), t('rollBook.absentLong'), t('rollBook.presentLong'), t('pupilPage.rate')];
  return (
    <View testID="pupil-figures" style={[styles.table, styles.row, { direction }]}>
      {FIELDS.map((field, index) => (
        <View
          key={field}
          accessible
          accessibilityLabel={figures[index] === '' ? long[index] : `${figures[index]} ${long[index]}`}
          style={[styles.figure, index > 0 && styles.divider]}
        >
          <Text style={styles.head}>{field === 'rate' ? t('pupilPage.rate') : t(`rollBook.${field}`)}</Text>
          <Text style={styles.value}>{figures[index]}</Text>
        </View>
      ))}
    </View>
  );
}

/** Each month's figures, then the year's. */
export function PupilYearTable(props: {
  readonly months: readonly { readonly month: string; readonly name: string; readonly count: PupilCount | null }[];
  readonly year: PupilCount | null;
}) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const long = [
    t('rollBook.possibleLong'),
    t('rollBook.absentLong'),
    t('rollBook.presentLong'),
    t('rollBook.rateLong'),
  ];
  const line = (key: string, name: string, count: PupilCount | null, total = false) => {
    const figures = values(count);
    return (
      <View
        key={key}
        testID={`pupil-year-${key}`}
        accessible
        accessibilityLabel={[name, ...figures.map((figure, index) => (figure === '' ? '' : `${long[index]} ${figure}`))]
          .filter(Boolean)
          .join('، ')}
        style={[styles.row, styles.line, total && styles.total]}
      >
        <Text style={[styles.month, align, total && styles.bold]}>{name}</Text>
        {figures.map((figure, index) => (
          <Text key={FIELDS[index]} style={[styles.cell, total && styles.bold]}>
            {figure}
          </Text>
        ))}
      </View>
    );
  };
  return (
    <View testID="pupil-year" style={[styles.table, { direction }]}>
      <View style={[styles.row, styles.line]} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.month, styles.head, align]}>{t('pupilPage.monthCol')}</Text>
        {FIELDS.map((field) => (
          <Text key={field} style={[styles.cell, styles.head]}>
            {field === 'rate' ? t('pupilPage.rate') : t(`rollBook.${field}`)}
          </Text>
        ))}
      </View>
      {props.months.map((one) => line(one.month, one.name, one.count))}
      {line('year', t('pupilPage.yearRow'), props.year, true)}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1.5,
    borderColor: colors.pencil,
    borderRadius: radius['radius-control'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  row: { flexDirection: 'row' },
  figure: { flex: 1, alignItems: 'center', paddingVertical: spacing['space-10'], gap: spacing['space-6'] },
  divider: { borderStartWidth: 1, borderStartColor: colors.grid },
  head: { ...typography.label, color: colors.ink2 },
  value: { ...typography.stat, color: colors.ink },
  line: {
    minHeight: sizes.target,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing['space-10'],
  },
  month: { ...typography.body, color: colors.ink, flex: 1.4 },
  cell: { ...typography['grid-head'], color: colors.ink, flex: 1, textAlign: 'center' },
  total: { backgroundColor: colors.soft, borderBottomWidth: 0 },
  bold: { fontWeight: '700' },
});
