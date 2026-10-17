// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WeekGrid, type WeekGridCell, type WeekGridDay, type WeekGridSlot } from '../components/WeekGrid';
import { colors, spacing, typography } from '../design/tokens';
import { fill, type SampleProps } from './samples';
import { weekGridTexts, type WeekGridTexts } from './week-grid-texts';

type Week = Readonly<Record<string, WeekGridCell>>;

function grid(text: WeekGridTexts, morning: number, afternoon: number) {
  const days: WeekGridDay[] = text.days.map((label, at) => ({ key: String(at), label }));
  const halves = [
    ['m', text.morning, text.halves[0], morning],
    ['a', text.afternoon, text.halves[1], afternoon],
  ] as const;
  const slots: WeekGridSlot[] = halves.flatMap(([key, short, spoken, count]) =>
    Array.from({ length: count }, (_, at) => ({
      key: `${key}${at + 1}`,
      label: fill(text.short, { half: short, index: at + 1 }),
      spoken: fill(text.spoken, { half: spoken, index: at + 1 }),
      first: at === 0,
    })),
  );
  const cellName = (day: WeekGridDay, slot: WeekGridSlot, cell: WeekGridCell) =>
    fill(text.name, { day: day.label, slot: slot.spoken, content: cell?.label ?? text.empty });
  return { days, slots, cellName };
}

function week(classes: readonly string[], cells: readonly [string, number][], own?: string): Week {
  return Object.fromEntries(
    cells.map(([key, at]) => [key, at < 0 ? { label: own ?? '', kind: 'own' } : { label: classes[at], kind: 'class' }]),
  );
}

/** A middle-school week to read, and a primary week whose cells take turns as they are tapped. */
export function WeekGridSamples({ language }: SampleProps) {
  const text = weekGridTexts[language];
  const middle = grid(text, 4, 3);
  const middleWeek = week(
    text.middleClasses,
    [
      ['0:m1', 1],
      ['1:m1', 0],
      ['2:m1', 2],
      ['3:m1', 0],
      ['4:m1', 1],
      ['2:m2', 1],
      ['3:m2', 2],
      ['4:m2', 0],
      ['0:m3', 0],
      ['1:m3', 1],
      ['2:m3', 0],
      ['3:m3', 1],
      ['4:m3', 2],
      ['1:a1', 2],
      ['0:a2', 2],
      ['2:a1', -1],
      ['2:a2', -1],
    ],
    text.own,
  );
  const primary = grid(text, 3, 2);
  const [primaryWeek, setPrimaryWeek] = useState<Week>(() =>
    week(text.primaryClasses, [
      ['0:m1', 0],
      ['0:m2', 1],
      ['1:m1', 2],
      ['1:m3', 3],
      ['3:a1', 0],
      ['3:a2', 1],
    ]),
  );
  const turn = (day: WeekGridDay, slot: WeekGridSlot) => {
    const key = `${day.key}:${slot.key}`;
    const at = text.primaryClasses.findIndex((name) => name === primaryWeek[key]?.label);
    const next = at + 1 < text.primaryClasses.length ? text.primaryClasses[at + 1] : null;
    setPrimaryWeek({ ...primaryWeek, [key]: next === null ? null : { label: next, kind: 'class' } });
  };
  return (
    <View style={styles.group}>
      <Text style={styles.note}>{text.middle}</Text>
      <WeekGrid
        testID="week-middle"
        days={middle.days}
        slots={middle.slots}
        cell={(day, slot) => middleWeek[`${day.key}:${slot.key}`] ?? null}
        cellName={middle.cellName}
      />
      <Text style={styles.note}>{text.primary}</Text>
      <WeekGrid
        testID="week-primary"
        days={primary.days}
        slots={primary.slots}
        cell={(day, slot) => primaryWeek[`${day.key}:${slot.key}`] ?? null}
        cellName={primary.cellName}
        cellHint={text.hint}
        onPressCell={turn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: spacing['space-16'], gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2 },
});
