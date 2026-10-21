// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مخطط الجلوس» (Roll-seats-setup, #41): the room arranged once for a class
// or one of its groups. The rows from the board, the seats in each row and
// the aisles shape it; a pupil is chosen from those without a seat, or by
// their seat, then placed with a tap. Each change is recorded at once, in
// the private layer (PRD §3.4, §6.8); emptying every seat can be undone.
// A joint class's years share the room, so they are not groups to seat.

import {
  AISLES,
  MAX_COLUMNS,
  MAX_ROWS,
  emptyAll,
  emptySeat,
  fillInListOrder,
  groupPupils,
  newPlan,
  planOf,
  pupilAt,
  resizePlan,
  seatOf,
  seatPupil,
  setSeating,
  type Aisle,
  type SeatingPlan,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { listNumbers } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { GroupChoice } from './GroupChoice';
import { RoomShape } from './RoomShape';
import { SeatGrid, type SeatCell } from './SeatGrid';
import { givenName } from './seat-names';

export function SeatsSetup(props: { classId: string; groupId: string }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs, today, record } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const [groupId, setGroupId] = useState(props.groupId);
  const [chosen, setChosen] = useState<string | null>(null);
  const [undo, setUndo] = useState<SeatingPlan | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const schoolClass = state.classes.get(props.classId);
  const group = schoolClass?.groups.find((one) => one.id === groupId);
  const seatGroups = schoolClass?.groups.filter((one) => one.kind !== 'level') ?? [];
  const pupils = groupPupils(context, props.classId, groupId, today());
  const byId = new Map(pupils.map((pupil) => [pupil.id, pupil]));
  const numbers = listNumbers(context, props.classId);
  const recorded = planOf(context, props.classId, groupId);
  const stored = recorded ?? newPlan(props.classId, groupId);
  const plan = { ...stored, seats: stored.seats.filter((seat) => byId.has(seat.pupilId)) };
  const unseated = pupils.filter((pupil) => seatOf(plan, pupil.id) === null);
  const chosenPupil = chosen === null ? undefined : byId.get(chosen);
  const label = (id: string) => `${numbers.get(id) ?? ''} ${byId.get(id)?.name ?? ''}`.trim();

  const save = (next: SeatingPlan) => {
    record(setSeating(context, next));
    setUndo(null);
  };
  const onSeat = (row: number, column: number) => {
    const occupant = pupilAt(plan, row, column);
    if (chosen === null) setChosen(occupant);
    else {
      save(occupant === chosen ? emptySeat(plan, row, column) : seatPupil(plan, chosen, row, column));
      setChosen(null);
    }
  };
  const cell = (row: number, column: number): SeatCell => {
    const id = pupilAt(plan, row, column);
    const pupil = id === null ? undefined : byId.get(id);
    const place = { row: row + 1, seat: column + 1 };
    if (pupil === undefined)
      return { tone: 'empty', spoken: t('seats.seatSpoken', { ...place, who: t('seats.empty') }) };
    return {
      tone: pupil.id === chosen ? 'chosen' : 'seated',
      number: numbers.get(pupil.id),
      name: givenName(pupil.name),
      spoken: t('seats.seatSpoken', { ...place, who: label(pupil.id) }),
    };
  };
  const hint =
    chosenPupil === undefined
      ? t('seats.hint')
      : t(seatOf(plan, chosenPupil.id) === null ? 'seats.chosen' : 'seats.chosenSeated', { name: chosenPupil.name });

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + spacing['space-24'] + (undo === null ? 0 : 96),
          },
        ]}
      >
        <Text style={[styles.scope, align]}>
          {[schoolClass?.name, recorded === null ? t('seats.firstUse') : null].filter(Boolean).join(' · ')}
        </Text>
        <Text style={[styles.body, align]}>{t('seats.intro')}</Text>
        {seatGroups.length > 1 && (
          <GroupChoice
            groups={seatGroups}
            selected={groupId}
            onSelect={(id) => {
              setGroupId(id);
              setChosen(null);
              setUndo(null);
            }}
          />
        )}
        <Text style={[styles.note, align]}>
          {t('seats.scope', {
            pupils: t('setup.pupils', { count: pupils.length }),
            group: group?.kind === 'whole' ? t('seats.wholeClass') : (group?.name ?? ''),
          })}
        </Text>
        <RoomShape
          rows={plan.rows}
          columns={plan.columns}
          aisleEvery={(plan.aisleEvery ?? 0) as Aisle}
          maxRows={MAX_ROWS}
          maxColumns={MAX_COLUMNS}
          aisles={AISLES}
          onSize={(rows, columns) => save(resizePlan(plan, rows, columns))}
          onAisle={(aisleEvery) => save({ ...plan, aisleEvery })}
        />
        <Text style={[styles.note, align]}>
          {t('seats.count', {
            seats: t('seats.seatCount', { count: plan.rows * plan.columns }),
            empty: plan.rows * plan.columns - plan.seats.length,
          })}{' '}
          {t('seats.room', { most: MAX_ROWS * MAX_COLUMNS, rows: MAX_ROWS, columns: MAX_COLUMNS })}
        </Text>
        <SeatGrid
          testID="seats-grid"
          rows={plan.rows}
          columns={plan.columns}
          aisleEvery={plan.aisleEvery ?? 0}
          cell={cell}
          onSeat={onSeat}
        />
        <Text accessibilityLiveRegion="polite" style={[styles.note, align]}>
          {hint}
        </Text>
        <View style={styles.actions}>
          <Button
            testID="seats-fill"
            variant="line"
            label={t('seats.fill')}
            disabled={unseated.length === 0 || plan.seats.length === plan.rows * plan.columns}
            onPress={() => {
              save(fillInListOrder(plan, pupils));
              setChosen(null);
            }}
          />
          <Button
            testID="seats-empty"
            variant="line"
            label={t('seats.emptyAll')}
            disabled={plan.seats.length === 0}
            onPress={() => {
              record(setSeating(context, emptyAll(plan)));
              setUndo(plan);
              setChosen(null);
            }}
          />
        </View>
        {unseated.length > 0 ? (
          <ChipGroup
            testID="seats-unseated"
            label={t('seats.unseated', { n: unseated.length })}
            choices={unseated.map((pupil) => ({ value: pupil.id, label: label(pupil.id) }))}
            selected={chosenPupil !== undefined && seatOf(plan, chosenPupil.id) === null ? chosenPupil.id : null}
            onSelect={(id) => setChosen(id === chosen ? null : id)}
          />
        ) : (
          <Text style={[styles.note, align]}>{t('seats.allSeated')}</Text>
        )}
        <Notice testID="seats-private" icon={controlIcon('lock')} message={t('seats.private')} />
        <Text style={[styles.note, align]}>{t('seats.saved')}</Text>
      </ScrollView>
      {undo !== null && (
        <Snackbar
          testID="seats-undo"
          message={t('seats.emptied')}
          undoLabel={t('seats.undo')}
          bottomOffset={insets.bottom}
          onUndo={() => save(undo)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  scope: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
