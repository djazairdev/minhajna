// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Classes' third panel tab, «استعمال الزمن» (answer 809): the school's
// working days by the morning's and afternoon's slots, each cell a select of
// the class's subjects or none. A subject whose teacher is already in another
// class at that time is refused, and the tab says which class.

import type { BookClass, Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { useDeviceText } from '../text/device-text';
import { PickField } from './PickField';
import { unitsOf } from './school-rules';
import type { SchoolDeskView } from './SchoolDesk';
import { busyElsewhere, sessionAt, slotCounts, slotsOf, withCell } from './week-rules';

const NONE = '-';

/** The class's week. */
export function WeekTab({
  profile,
  bells,
  list,
  school,
  book,
  update,
  schoolClass,
}: SchoolDeskView & { readonly schoolClass: BookClass }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [refused, setRefused] = useState<string | null>(null);
  const level = list.levels.find((one) => one.code === school.level);
  const subjects = [...new Set(unitsOf(level).flatMap((unit) => unit.subjects))];
  const choices = [
    { value: NONE, label: t('dashboard.week.none') },
    ...subjects.map((code) => ({ value: code, label: subjectName(profile, code) })),
  ];
  const days = profile.workingDays;
  const slots = slotsOf(slotCounts(bells, school.level));
  const set = (weekday: Weekday, slot: (typeof slots)[number], value: string) => {
    const subject = value === NONE ? null : value;
    const other = subject === null ? null : busyElsewhere(book, schoolClass.id, subject, weekday, slot);
    if (other !== null) {
      setRefused(t('dashboard.week.busy', { name: other }));
      return;
    }
    setRefused(null);
    update((current) => withCell(current, schoolClass.id, weekday, slot, subject));
  };
  return (
    <View style={styles.tab}>
      {refused !== null && (
        <Text testID="week-refused" accessibilityRole="alert" style={[styles.warn, align]}>
          {refused}
        </Text>
      )}
      <View role="table" accessibilityLabel={t('dashboard.classes.tab.week')} style={styles.grid}>
        <View role="row" style={styles.row}>
          <View style={styles.slot} />
          {days.map((day) => (
            <View key={day} role="columnheader" style={styles.cell}>
              <Text style={[styles.head, align]}>{t(`week.days.${day}`)}</Text>
            </View>
          ))}
        </View>
        {slots.map((slot) => (
          <View key={`${slot.half}-${slot.index}`} role="row" style={[styles.row, slot.index === 1 && styles.half]}>
            <View role="rowheader" style={styles.slot}>
              <Text style={[styles.head, align]}>{t(`dashboard.week.${slot.half}`, { index: slot.index })}</Text>
            </View>
            {days.map((day) => {
              const session = sessionAt(book, schoolClass.id, day, slot);
              return (
                <View key={day} role="cell" style={styles.cell}>
                  <PickField
                    compact
                    testID={`week-${day}-${slot.half}-${slot.index}`}
                    label={`${t(`week.days.${day}`)} · ${t(`dashboard.week.${slot.half}`, { index: slot.index })}`}
                    choices={choices}
                    value={session?.subject ?? NONE}
                    onChange={(value) => set(day, slot, value)}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: spacing['space-8'] },
  warn: { ...typography.label, color: colors['notice-ink'] },
  grid: { gap: spacing['space-2'] },
  row: { flexDirection: 'row', gap: spacing['space-2'], alignItems: 'center' },
  half: { marginTop: spacing['space-6'] },
  slot: { width: 34 },
  cell: { flex: 1, minWidth: 0 },
  head: { ...typography.small, color: colors.ink2 },
});
