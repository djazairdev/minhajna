// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The room's shape: the rows from the board to the back, the seats in each
// row not counting the aisles, and how often an aisle comes.

import type { Aisle } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { Stepper } from '../components/Stepper';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export function RoomShape(props: {
  rows: number;
  columns: number;
  aisleEvery: Aisle;
  maxRows: number;
  maxColumns: number;
  aisles: readonly Aisle[];
  onSize: (rows: number, columns: number) => void;
  onAisle: (aisleEvery: Aisle) => void;
}) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View style={[styles.card, { direction }]}>
      <View style={styles.line}>
        <View style={styles.words}>
          <Text style={[styles.label, align]}>{t('seats.rows')}</Text>
        </View>
        <Stepper
          testID="seats-rows"
          label={t('seats.rows')}
          unit={t('seats.rowsUnit')}
          value={props.rows}
          min={1}
          max={props.maxRows}
          decreaseLabel={t('seats.rowsLess')}
          increaseLabel={t('seats.rowsMore')}
          onValueChange={(rows) => props.onSize(rows, props.columns)}
        />
      </View>
      <View style={[styles.line, styles.ruled]}>
        <View style={styles.words}>
          <Text style={[styles.label, align]}>{t('seats.columns')}</Text>
        </View>
        <Stepper
          testID="seats-columns"
          label={t('seats.columns')}
          unit={t('seats.columnsUnit')}
          value={props.columns}
          min={1}
          max={props.maxColumns}
          decreaseLabel={t('seats.columnsLess')}
          increaseLabel={t('seats.columnsMore')}
          onValueChange={(columns) => props.onSize(props.rows, columns)}
        />
      </View>
      <View style={styles.ruled}>
        <ChipGroup
          testID="seats-aisles"
          label={t('seats.aisles')}
          choices={props.aisles.map((value) => ({ value: String(value), label: t(`seats.aisle${value}`) }))}
          selected={String(props.aisleEvery)}
          onSelect={(value) => props.onAisle(Number(value) as Aisle)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  ruled: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing['space-12'] },
  words: { flex: 1, minWidth: 140, gap: spacing['space-2'] },
  label: { ...typography.label, color: colors.ink },
});
