// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the inspector's phone kept of an ended grant's spot-check sheet (#594,
// answer 622), read only: its days, then each note on what the pupils'
// exercise books showed, by its class's number in the grant, its group, day
// and start, in the order of day and start, then the inspector's notes under
// their label; and how a kept note's session is named on an open sheet too,
// by the class and subject the archive gives when known.

import { spotRowOf, type Day, type SpotSheet as Sheet } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { clock } from '../timetable/grid-text';
import { isolate } from '../week/grid-labels';

/** The class and subject each course is named by. */
export type Names = ReadonlyMap<string, { readonly class: string; readonly subject: string }>;

/** A session's class, with its group when it has one. */
export const lesson = (one: { readonly class: string; readonly group: string }) =>
  one.group === '' ? isolate(one.class) : `${isolate(one.class)} · ${isolate(one.group)}`;

/** A kept note's session, by what its key names, its class when known. */
export function keptRow(key: string, names: Names, dayText: (day: Day) => string): string {
  const row = spotRowOf(key);
  if (row === null) return '';
  const name = names.get(row.course);
  const subject = name === undefined || name.subject === '' ? [] : [isolate(name.subject)];
  const head = name === undefined ? [] : [lesson({ class: name.class, group: row.group }), ...subject];
  return [...head, dayText(row.day), isolate(clock(row.start))].join(' · ');
}

/** What the phone kept of an ended grant's sheet, read only. */
export function KeptSheet(props: {
  testID: string;
  kept: Sheet;
  courses: readonly string[];
  dayText: (day: Day) => string;
}) {
  const { testID, kept, courses, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const names: Names = new Map(
    courses.map((course, at) => [course, { class: t('demo.inspectorGrant.class', { number: at + 1 }), subject: '' }]),
  );
  const order = (key: string) => {
    const row = spotRowOf(key);
    return row === null ? '' : `${row.day}\n${String(row.start).padStart(4, '0')}`;
  };
  const books = [...kept.books].sort((a, b) =>
    order(a.row) < order(b.row) ? -1 : order(a.row) > order(b.row) ? 1 : 0,
  );
  return (
    <View testID={`${testID}-kept`} style={styles.day}>
      <Text style={[styles.body, align]}>{t('demo.inspectorGrant.sheetEndedKept')}</Text>
      {kept.days.map((day) => (
        <Text key={day} style={[styles.head, align]}>
          {dayText(day)}
        </Text>
      ))}
      {books.map((one) => (
        <Text key={one.row} style={[styles.body, align]}>
          {t('demo.inspectorGrant.sheetKept', { row: keptRow(one.row, names, dayText), note: one.note })}
        </Text>
      ))}
      {kept.notes !== '' && (
        <>
          <Text style={[styles.label, align]}>{t('demo.inspectorGrant.sheetNotes')}</Text>
          <Text style={[styles.body, align]}>{kept.notes}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
