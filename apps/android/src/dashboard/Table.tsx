// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A table on the dashboard's wide pages, as the boards rule it: a head row in
// the well's colour over ruled rows, each column a share of the width or a set
// one. Words go in a cell as text; a row chosen is marked by an edge as well as
// its colour.

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';

export type TableColumn = {
  readonly id: string;
  readonly label: string;
  readonly width?: number;
  readonly grow?: number;
  /** A column of actions, whose name is spoken but not shown. */
  readonly quiet?: boolean;
};

export type TableRow = {
  readonly key: string;
  readonly cells: readonly ReactNode[];
  readonly chosen?: boolean;
};

export type TableProps = {
  readonly label: string;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly TableRow[];
  readonly testID?: string;
};

const widthOf = (column: TableColumn) =>
  column.width === undefined ? { flex: column.grow ?? 1, minWidth: 0 } : { width: column.width };

/** The columns over their rows. */
export function Table({ label, columns, rows, testID }: TableProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} role="table" accessibilityLabel={label} style={[styles.table, { direction }]}>
      <View role="row" style={[styles.row, styles.head]}>
        {columns.map((column) => (
          <View
            key={column.id}
            role="columnheader"
            accessibilityLabel={column.quiet === true ? column.label : undefined}
            style={[styles.cell, widthOf(column)]}
          >
            {column.quiet !== true && <Text style={[styles.headWords, align]}>{column.label}</Text>}
          </View>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row.key} role="row" style={[styles.row, styles.ruled, row.chosen === true && styles.chosen]}>
          {row.cells.map((cell, at) => (
            <View
              key={columns[at]?.id ?? at}
              role="cell"
              style={[styles.cell, widthOf(columns[at] ?? ({} as TableColumn))]}
            >
              {typeof cell === 'string' || typeof cell === 'number' ? (
                <Text style={[styles.words, align]}>{cell}</Text>
              ) : (
                cell
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  head: { minHeight: 38, backgroundColor: colors.well },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  chosen: { backgroundColor: colors.due, borderStartWidth: 4, borderStartColor: colors.ink },
  cell: { paddingVertical: spacing['space-4'], paddingHorizontal: spacing['space-10'] },
  headWords: { ...typography.small, fontWeight: '600', color: colors.ink2 },
  words: { ...typography.body, color: colors.ink },
});
