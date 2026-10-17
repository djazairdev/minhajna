// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The room seen from the teacher's desk (Roll-seats, Roll-seats-setup):
// «السبورة» on top, then the rows from the board to the back, with an
// aisle after every few seats. A seat shows its pupil's number and given
// name, or «فارغ» on a dashed edge. An absence is a board-coloured seat
// and a lateness a highlighted one, each with a letter as well, so colour
// is never the only signal. Seats stay 48dp wide; a room too wide for the
// screen scrolls sideways.

import { useLocale } from '@react-navigation/native';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type SeatTone = 'empty' | 'seated' | 'chosen' | 'absent' | 'late';

export type SeatCell = {
  readonly number?: number;
  readonly name?: string;
  /** The full label TalkBack reads, with the seat's place and state. */
  readonly spoken: string;
  readonly tone: SeatTone;
};

export type SeatGridProps = {
  readonly rows: number;
  readonly columns: number;
  readonly aisleEvery: number;
  readonly cell: (row: number, column: number) => SeatCell;
  readonly onSeat: (row: number, column: number) => void;
  readonly testID: string;
};

export function SeatGrid(props: SeatGridProps) {
  const { direction } = useLocale();
  const t = useText();
  const rows = Array.from({ length: props.rows }, (_, row) => row);
  const columns = Array.from({ length: props.columns }, (_, column) => column);
  const [width, setWidth] = useState(0);
  const aisle = (column: number) =>
    props.aisleEvery > 0 && column > 0 && column < props.columns && column % props.aisleEvery === 0;
  const aisles = props.aisleEvery > 0 ? Math.floor((props.columns - 1) / props.aisleEvery) : 0;
  const gaps = (props.columns - 1) * GAP + aisles * AISLE;
  const seat = Math.max(sizes.target, Math.floor((width - gaps) / props.columns));
  return (
    <View testID={props.testID} style={[styles.card, { direction }]}>
      <View style={styles.board} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.boardText}>{t('seats.board')}</Text>
      </View>
      <ScrollView
        horizontal
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.rows}>
          {rows.map((row) => (
            <View key={row} style={styles.row}>
              {columns.map((column) => (
                <View key={column} style={[{ width: seat }, aisle(column) && styles.aisle]}>
                  <Seat
                    testID={`${props.testID}-${row}-${column}`}
                    row={row}
                    column={column}
                    cell={props.cell(row, column)}
                    onSeat={props.onSeat}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const Seat = memo(function Seat(props: {
  testID: string;
  row: number;
  column: number;
  cell: SeatCell;
  onSeat: (row: number, column: number) => void;
}) {
  const t = useText();
  const { tone, number, name, spoken } = props.cell;
  const dark = tone === 'absent';
  const mark = tone === 'absent' ? t('seats.absentMark') : tone === 'late' ? t('seats.lateMark') : null;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={tone === 'chosen' ? { selected: true } : undefined}
      onPress={() => props.onSeat(props.row, props.column)}
      style={({ pressed }) => [
        styles.seat,
        tone === 'empty' && styles.empty,
        tone === 'chosen' && styles.chosen,
        tone === 'absent' && styles.absent,
        tone === 'late' && styles.late,
        pressed && tone !== 'absent' && styles.pressed,
      ]}
    >
      {mark !== null && <Text style={[styles.mark, dark && styles.onDark]}>{mark}</Text>}
      {tone === 'empty' ? (
        <Text style={styles.emptyText}>{t('seats.empty')}</Text>
      ) : (
        <>
          <Text style={[styles.number, dark && styles.onDark]}>{number}</Text>
          <Text numberOfLines={2} style={[styles.name, dark && styles.onDark]}>
            {name}
          </Text>
        </>
      )}
    </Pressable>
  );
});

const GAP = spacing['space-2'];
const AISLE = spacing['space-6'];

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-12'],
    padding: spacing['space-6'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  board: {
    alignSelf: 'center',
    width: '60%',
    paddingVertical: spacing['space-4'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.board,
    alignItems: 'center',
  },
  boardText: { ...typography.caption, color: colors.chalk },
  rows: { gap: spacing['space-6'] },
  row: { flexDirection: 'row', gap: GAP },
  aisle: { marginStart: AISLE },
  seat: {
    minWidth: sizes.target,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-2'],
    paddingVertical: spacing['space-4'],
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  empty: { borderStyle: 'dashed', borderColor: colors.ink2, backgroundColor: colors.paper },
  chosen: { borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.soft },
  absent: { borderColor: colors.board, backgroundColor: colors.board },
  late: { borderColor: colors['late-edge'], backgroundColor: colors.hi },
  pressed: { borderColor: colors.ink },
  number: { ...typography.small, color: colors.ink2, textAlign: 'center' },
  name: { ...typography.small, color: colors.ink, textAlign: 'center' },
  emptyText: { ...typography.small, color: colors.ink2, textAlign: 'center' },
  mark: { ...typography.tag, position: 'absolute', top: 0, start: spacing['space-4'], color: colors.ink },
  onDark: { color: colors.chalk },
});
