// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The slots and their times on Settings-times (#29): one 48dp row a slot,
// under its half-day, with its place in the timetable and its time at the
// school, read in the screen's direction. A time the teacher set says so in
// words, not by colour alone.

import type { BellTime, Slot } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import type { gridLabels } from '../week/grid-labels';

export type TimeTableProps = {
  readonly labels: ReturnType<typeof gridLabels>;
  /** One for each of `labels.slots`, in order. */
  readonly times: readonly (BellTime | null)[];
  readonly onOpen: (slot: Slot) => void;
};

/** A range in the reading direction: in Arabic, the start on the right, as the design draws it. */
export function span(from: string, to: string, direction: 'rtl' | 'ltr'): string {
  return `${direction === 'rtl' ? '\u2067' : '\u2066'}${from} – ${to}\u2069`;
}

/** The table; each row opens its slot's time. */
export function TimeTable({ labels, times, onOpen }: TimeTableProps) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="times-table" style={styles.table}>
      <View style={styles.head} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.headText, align]}>{t('times.slotColumn')}</Text>
        <Text style={[styles.headText, align]}>{t('times.timeColumn')}</Text>
      </View>
      {labels.slots.map((row, at) => {
        const time = times[at] ?? null;
        const key = `${row.slot.half === 'morning' ? 'm' : 'a'}${row.slot.index}`;
        const spoken =
          time === null
            ? t('times.rowEmpty', { slot: row.spoken })
            : t(time.by === 'school' ? 'times.rowSchool' : 'times.rowSpoken', {
                slot: row.spoken,
                from: time.from,
                to: time.to,
              });
        return (
          <Fragment key={key}>
            {row.first && (
              <Text accessibilityRole="header" style={[styles.half, align]}>
                {t(row.slot.half === 'morning' ? 'times.morning' : 'times.afternoon')}
              </Text>
            )}
            <Pressable
              testID={`time-${key}`}
              accessibilityRole="button"
              accessibilityLabel={spoken}
              accessibilityHint={t('times.rowHint')}
              onPress={() => onOpen(row.slot)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={[styles.slot, align]}>{row.label}</Text>
              <View style={styles.time}>
                <Text style={[styles.clock, align]}>
                  {time === null ? t('times.noTime') : span(time.from, time.to, direction)}
                </Text>
                {time?.by === 'school' && <Text style={[styles.by, align]}>{t('times.bySchool')}</Text>}
              </View>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    gap: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    paddingVertical: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  headText: { ...typography.caption, color: colors.ink2, flex: 1 },
  half: {
    ...typography.label,
    color: colors.ink,
    paddingHorizontal: spacing['space-14'],
    paddingVertical: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  row: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    paddingVertical: spacing['space-8'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  pressed: { opacity: 0.8 },
  slot: { ...typography.label, color: colors.ink, flex: 1 },
  time: { flex: 1, gap: spacing['space-2'] },
  clock: { ...typography.body, color: colors.ink },
  by: { ...typography.caption, color: colors.ink2 },
});
