// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The numbered rows of a list card on Today (#230, #231, P-Today, L-Today):
// each item with where it falls, «اليوم», «الحصة القادمة» or «بعدها», or
// «بعد الفرض» when a test of the class comes before it, read as one line.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

const PLACES = ['today', 'next', 'after'] as const;

export type ListPlace = (typeof PLACES)[number] | 'afterTest';

/** How many rows a list card shows. */
export const LIST_ROWS = PLACES.length;

/** Where each of the days falls from `day`: «اليوم» for that day, then the next session and the ones after. */
export function placesOf(days: readonly Day[], day: Day): (typeof PLACES)[number][] {
  return days.map((one, index) => {
    if (one === day) return 'today';
    const later = days.slice(0, index).filter((other) => other !== day).length;
    return PLACES[later + 1] ?? 'after';
  });
}

export function ListRows({ testID, rows }: { testID: string; rows: readonly { title: string; place: ListPlace }[] }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return rows.map((row, index) => (
    <View
      key={index}
      testID={`${testID}-row-${index}`}
      accessible
      accessibilityLabel={t('listToday.row', {
        n: index + 1,
        title: isolate(row.title),
        place: t(`listToday.${row.place}`),
      })}
      style={styles.row}
    >
      <Text style={styles.number}>{index + 1}</Text>
      <Text style={[styles.body, styles.title, align]}>{row.title}</Text>
      <Badge label={t(`listToday.${row.place}`)} variant={row.place === 'today' ? 'done' : 'default'} />
    </View>
  ));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  number: { ...typography.label, color: colors.ink2, minWidth: 16 },
  title: { flex: 1 },
  body: { ...typography.body, color: colors.ink },
});
