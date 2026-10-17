// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The weekly timetable at a glance (WeekGrid, #133): the caller's days
// across, in the reading direction, and slots down, never clock times (PRD
// §4.6). A class sits on its subject colour, the teacher's own time on a soft
// ground, and an empty slot on the sheet, dashed when it can be pressed. The
// grid is laid out column by column, so each day is as wide as its longest
// label and at least 48dp, and every row has one height that grows with the
// text. A class name never breaks inside a word, and when the week is wider
// than the screen, at 200% text or with long names, it scrolls sideways. A
// clashing cell gets a dashed warning outline.

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

/**
 * `spoken`, when given, is what a screen reader says for the cell's content instead of its label; `clash` outlines
 * the cell, dashed, so a clash is seen without relying on colour.
 */
export type WeekGridCell = {
  readonly label: string;
  readonly spoken?: string;
  readonly kind: 'class' | 'own';
  readonly clash?: boolean;
} | null;

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
const ROW = 32;
const LINE = Math.max(typography['class-chip'].lineHeight, typography.badge.lineHeight);

/** The grid; with `onPressCell`, every cell is a 48dp button. */
export function WeekGrid({ testID, days, slots, cell, cellName, onPressCell, cellHint }: WeekGridProps) {
  const { direction } = useLocale();
  const { fontScale } = useWindowDimensions();
  const pressable = onPressCell !== undefined;
  const row = { minHeight: Math.max(pressable ? sizes.target : ROW, LINE * fontScale + 2 * spacing['space-6']) };
  const head = { minHeight: typography['grid-head'].lineHeight * fontScale };
  return (
    <ScrollView testID={testID} horizontal contentContainerStyle={styles.scroll} style={{ direction }}>
      <View
        style={[styles.column, { minWidth: SLOT_COLUMN * fontScale }]}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={head} />
        {slots.map((slot) => (
          <View key={slot.key} style={[styles.slotCell, row, slot.first && styles.half]}>
            <Text style={styles.slot}>{slot.label}</Text>
          </View>
        ))}
      </View>
      {days.map((day) => (
        <View key={day.key} style={[styles.column, styles.day, { minWidth: COLUMN * fontScale }]}>
          <Text importantForAccessibility="no" style={[styles.head, head]}>
            {day.label}
          </Text>
          {slots.map((slot) => {
            const content = cell(day, slot);
            const look = [
              styles.cell,
              row,
              slot.first && styles.half,
              pressable && styles.target,
              content === null && pressable && styles.open,
              content?.kind === 'class' && styles.class,
              content?.kind === 'own' && styles.own,
              content?.clash === true && styles.clash,
            ];
            const inner = content && (
              <Text style={content.kind === 'class' ? styles.classText : styles.ownText}>{content.label}</Text>
            );
            const name = cellName(day, slot, content);
            return pressable ? (
              <Pressable
                key={slot.key}
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
              <View key={slot.key} accessible accessibilityLabel={name} style={look}>
                {inner}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, gap: spacing['space-4'] },
  column: { gap: spacing['space-4'] },
  day: { flexGrow: 1 },
  half: { marginTop: spacing['space-8'] },
  head: { ...typography['grid-head'], color: colors.ink, textAlign: 'center' },
  slotCell: { justifyContent: 'center' },
  slot: { ...typography['grid-head'], color: colors.ink2, textAlign: 'center' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-6'],
    paddingVertical: spacing['space-4'],
    borderRadius: radius['radius-badge'],
    backgroundColor: colors.sheet,
  },
  target: { minWidth: sizes.target },
  open: { borderWidth: 1, borderStyle: 'dashed', borderColor: colorRoles.controlBorder },
  class: { backgroundColor: colors.subject },
  own: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colorRoles.controlBorder },
  clash: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors['notice-line'] },
  pressed: { opacity: 0.8 },
  classText: { ...typography['class-chip'], color: colors['on-subject'], textAlign: 'center' },
  ownText: { ...typography.badge, color: colors.ink, textAlign: 'center' },
});
