// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly timetable at a glance (WeekGrid, #133): the caller's days
// across, in the reading direction, and slots down, never clock times (PRD
// §4.6). A class sits on its subject colour, the teacher's own time on a soft
// ground, and an empty slot on the sheet, dashed when it can be pressed.
// Columns keep a 48dp target and grow with the text, so at 200% the grid
// scrolls sideways rather than clipping or shrinking its text.

import { useLocale } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';

export type WeekGridDay = { readonly key: string; readonly label: string };

/** `label` is printed by the row, `spoken` names the slot to a screen reader; `first` starts a half-day. */
export type WeekGridSlot = {
  readonly key: string;
  readonly label: string;
  readonly spoken: string;
  readonly first?: boolean;
};

export type WeekGridCell = { readonly label: string; readonly kind: 'class' | 'own' } | null;

export type WeekGridProps = {
  readonly testID?: string;
  readonly days: readonly WeekGridDay[];
  readonly slots: readonly WeekGridSlot[];
  readonly cell: (day: WeekGridDay, slot: WeekGridSlot) => WeekGridCell;
  /** The spoken name of a cell: its day, its slot and its class, or that it is empty. */
  readonly cellName: (day: WeekGridDay, slot: WeekGridSlot, cell: WeekGridCell) => string;
  readonly onPressCell?: (day: WeekGridDay, slot: WeekGridSlot) => void;
  readonly cellHint?: string;
};

const SLOT_COLUMN = 44;
const COLUMN = 52;

/** The grid; with `onPressCell`, every cell is a 48dp button. */
export function WeekGrid({ testID, days, slots, cell, cellName, onPressCell, cellHint }: WeekGridProps) {
  const { direction } = useLocale();
  const { fontScale } = useWindowDimensions();
  const column = { width: Math.max(COLUMN, COLUMN * fontScale) };
  const slotColumn = { width: Math.max(SLOT_COLUMN, SLOT_COLUMN * fontScale) };
  const pressable = onPressCell !== undefined;
  return (
    <ScrollView testID={testID} horizontal contentContainerStyle={styles.scroll} style={{ direction }}>
      <View style={styles.grid}>
        <View style={styles.row} importantForAccessibility="no-hide-descendants">
          <View style={slotColumn} />
          {days.map((day) => (
            <Text key={day.key} style={[styles.head, column]}>
              {day.label}
            </Text>
          ))}
        </View>
        {slots.map((slot) => (
          <View key={slot.key} style={[styles.row, slot.first && styles.half]}>
            <Text importantForAccessibility="no" style={[styles.slot, slotColumn]}>
              {slot.label}
            </Text>
            {days.map((day) => {
              const content = cell(day, slot);
              const look = [
                styles.cell,
                column,
                pressable && styles.target,
                content === null && pressable && styles.open,
                content?.kind === 'class' && styles.class,
                content?.kind === 'own' && styles.own,
              ];
              const inner = content && (
                <Text style={content.kind === 'class' ? styles.classText : styles.ownText}>{content.label}</Text>
              );
              const name = cellName(day, slot, content);
              return pressable ? (
                <Pressable
                  key={day.key}
                  testID={testID && `${testID}-${day.key}-${slot.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityHint={cellHint}
                  onPress={() => onPressCell(day, slot)}
                  style={({ pressed }) => [look, pressed && styles.pressed]}
                >
                  {inner}
                </Pressable>
              ) : (
                <View key={day.key} accessible accessibilityLabel={name} style={look}>
                  {inner}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  grid: { flexGrow: 1, gap: spacing['space-4'] },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing['space-4'] },
  half: { marginTop: spacing['space-8'] },
  head: { ...typography['grid-head'], color: colors.ink, textAlign: 'center', flexGrow: 1 },
  slot: { ...typography['grid-head'], color: colors.ink2, textAlign: 'center', alignSelf: 'center' },
  cell: {
    flexGrow: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-2'],
    paddingVertical: spacing['space-4'],
    borderRadius: radius['radius-badge'],
    backgroundColor: colors.sheet,
  },
  target: { minHeight: sizes.target, minWidth: sizes.target },
  open: { borderWidth: 1, borderStyle: 'dashed', borderColor: colorRoles.controlBorder },
  class: { backgroundColor: colors.subject },
  own: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colorRoles.controlBorder },
  pressed: { opacity: 0.8 },
  classText: { ...typography['class-chip'], color: colors['on-subject'], textAlign: 'center' },
  ownText: { ...typography.badge, color: colors.ink, textAlign: 'center' },
});
