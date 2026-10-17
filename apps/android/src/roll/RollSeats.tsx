// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll call on the seating plan (Roll-seats, #41): a tap on a seat marks
// an absence, a second a lateness, a third the pupil present again, the
// same marks as the list (PRD §3.4, R-3.4-13). Pupils without a seat, such
// as one who joined after the plan was made, are listed below it.

import type { Pupil, SeatedRoll } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { RollCallRow } from '../components/RollCallRow';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { givenName } from '../seats/seat-names';
import { SeatGrid, type SeatCell } from '../seats/SeatGrid';
import { useText } from '../text/i18n';

export function RollSeats(props: {
  head: ReactNode;
  seated: SeatedRoll;
  rows: number;
  columns: number;
  aisleEvery: number;
  numbers: ReadonlyMap<string, number>;
  absent: ReadonlySet<string>;
  late: ReadonlySet<string>;
  onSeat: (pupilId: string) => void;
  onMark: (pupilId: string, kind: 'absent' | 'late', on: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { seated, numbers, absent, late } = props;
  const state = (pupil: Pupil) => (absent.has(pupil.id) ? 'absent' : late.has(pupil.id) ? 'late' : 'present');
  const cell = (row: number, column: number): SeatCell => {
    const pupil = seated.seats[row]?.[column] ?? null;
    const place = { row: row + 1, seat: column + 1 };
    if (pupil === null) return { tone: 'empty', spoken: t('seats.seatSpoken', { ...place, who: t('seats.empty') }) };
    const now = state(pupil);
    const who = `${numbers.get(pupil.id) ?? ''} ${pupil.name} · ${t(`roll.${now}`)}`;
    return {
      tone: now === 'present' ? 'seated' : now,
      number: numbers.get(pupil.id),
      name: givenName(pupil.name),
      spoken: t('seats.seatSpoken', { ...place, who }),
    };
  };
  return (
    <ScrollView
      testID="roll-seats-view"
      contentContainerStyle={[
        styles.content,
        { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: spacing['space-16'] },
      ]}
    >
      {props.head}
      <View style={styles.body}>
        <SeatGrid
          testID="roll-seat"
          rows={props.rows}
          columns={props.columns}
          aisleEvery={props.aisleEvery}
          cell={cell}
          onSeat={(row, column) => {
            const pupil = seated.seats[row]?.[column];
            if (pupil) props.onSeat(pupil.id);
          }}
        />
        <Text style={[styles.note, align]}>{t('seats.rollHint')}</Text>
        {seated.unseated.length > 0 && (
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('seats.unseated', { n: seated.unseated.length })}
          </Text>
        )}
      </View>
      {seated.unseated.map((pupil) => (
        <RollCallRow
          key={pupil.id}
          testID={`roll-${numbers.get(pupil.id) ?? 0}`}
          number={numbers.get(pupil.id) ?? 0}
          name={pupil.name}
          absent={absent.has(pupil.id)}
          late={late.has(pupil.id)}
          onAbsent={(on) => props.onMark(pupil.id, 'absent', on)}
          onLate={(on) => props.onMark(pupil.id, 'late', on)}
        />
      ))}
      <View style={styles.body}>
        <Notice icon={controlIcon('lock')} message={t('seats.private')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing['space-12'] },
  body: { gap: spacing['space-12'], paddingHorizontal: spacing['space-16'] },
  label: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
