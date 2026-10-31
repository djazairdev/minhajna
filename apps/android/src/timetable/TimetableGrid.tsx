// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each class's week in the timetable read from a file (#576, D-TT-import,
// R-7.4-10, answer 593), on the timetable page under the checks: the classes
// read, as chips, the first chosen until another is, and the chosen class's
// grid as the core lays it out (timetable-grid.ts). On the PC it is a table, as
// the design draws it: a column for each working day, then any other day a
// session takes, a row for each time with its span as the row header, and each
// session of a cell on its own line, its week when it alternates, its group,
// subject and teacher (grid-text.ts), so a screen reader moves cell by cell,
// the table named for its class. On the phone it is a list by day, each session
// with its span, and a day with no session says so. Under either, the days the
// class has sessions in the morning only are named, as the design's footer
// names a free afternoon. The grid shows the timetable as read.

import { classGrid, timetableClasses, type ImportedSession, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { freeAfternoons, sessionText, spanText } from './grid-text';

export type TimetableGridProps = {
  /** The sessions the reading kept. */
  readonly sessions: readonly ImportedSession[];
  readonly workingDays: readonly Weekday[];
  /** Where the school level's afternoon begins, in minutes from midnight. */
  readonly afternoon: number;
};

/** The chosen class's week: a table on the PC, a list by day on the phone. */
export function TimetableGrid({ sessions, workingDays, afternoon }: TimetableGridProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const classes = timetableClasses(sessions);
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = chosen !== null && classes.includes(chosen) ? chosen : (classes[0] ?? null);
  if (shown === null) return null;
  const grid = classGrid(sessions, shown, workingDays);
  const day = (one: Weekday) => t(`week.days.${one}`);
  const afternoons = freeAfternoons(grid, afternoon);
  const cell = (key: string, role: 'columnheader' | 'rowheader' | 'cell', lines: readonly string[]) => (
    <View key={key} role={role} style={[styles.cell, role === 'columnheader' && styles.head]}>
      {lines.map((line, index) => (
        <Text key={`${key}-${index}`} style={[role === 'cell' ? styles.value : styles.label, align]}>
          {line}
        </Text>
      ))}
    </View>
  );
  return (
    <View testID="tt-grid" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.headText, align]}>
        {t('ttImport.grid')}
      </Text>
      <ChipGroup
        testID="tt-grid-class"
        label={t('ttImport.gridClass')}
        choices={classes.map((one) => ({ value: one, label: one }))}
        selected={shown}
        onSelect={setChosen}
      />
      {onPc() ? (
        <View
          testID="tt-grid-table"
          role="table"
          focusable
          accessibilityLabel={t('ttImport.gridOf', { class: shown })}
          style={styles.table}
        >
          <View role="row" style={styles.row}>
            {cell('time', 'columnheader', [t('ttImport.gridTime')])}
            {grid.days.map((one) => cell(`day-${one}`, 'columnheader', [day(one)]))}
          </View>
          {grid.slots.map((slot) => (
            <View key={`${slot.start}-${slot.end}`} role="row" style={[styles.row, styles.ruled]}>
              {cell('time', 'rowheader', [spanText(slot.start, slot.end)])}
              {slot.cells.map((list, index) =>
                cell(
                  `day-${grid.days[index]}`,
                  'cell',
                  list.map((one) => sessionText(t, one)),
                ),
              )}
            </View>
          ))}
        </View>
      ) : (
        grid.days.map((one, index) => {
          const held = grid.slots.flatMap((slot) =>
            (slot.cells[index] ?? []).map(
              (session) => `${spanText(slot.start, slot.end)} · ${sessionText(t, session)}`,
            ),
          );
          return (
            <View key={one} testID={`tt-grid-day-${one}`} style={styles.day}>
              <Text accessibilityRole="header" style={[styles.label, align]}>
                {day(one)}
              </Text>
              {(held.length === 0 ? [t('ttImport.dayEmpty')] : held).map((line, at) => (
                <Text key={`${one}-${at}`} style={[styles.value, align]}>
                  {line}
                </Text>
              ))}
            </View>
          );
        })
      )}
      {afternoons.length > 0 && (
        <Text style={[styles.value, align]}>
          {t('ttImport.freeAfternoons', { days: afternoons.map(day).join(t('ttImport.listSeparator')) })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: radius['radius-card'], overflow: 'hidden' },
  row: { flexDirection: 'row' },
  ruled: { borderTopWidth: 1, borderColor: colors.line },
  cell: { flex: 1, minWidth: 0, padding: spacing['space-8'], gap: spacing['space-4'] },
  head: { backgroundColor: colors.well },
  day: { gap: spacing['space-4'] },
  headText: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
});
