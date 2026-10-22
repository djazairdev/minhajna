// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary day on Today (#230, P-Today, answers 373, 379 and 380): the
// sessions in a morning band and an afternoon band, «الصبيحة» and «المساء»,
// each with one roll call for each class's half day, and the afternoon's
// taken on its own; a class called session by session keeps its roll call on
// its cards. Then «تأكيد اليوم كله كما هو مقترح», which records every
// session still awaiting as proposed, and «الكراس اليومي».

import {
  type Context,
  type Half,
  type RollCallUnit,
  type Session,
  type State,
  type TodaySession,
} from '@minhajna/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { DueStrip, type DueStripProps } from '../components/DueStrip';
import { SectionHeader } from '../components/SectionHeader';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { recordedMarks, unitOf } from '../roll/roll-rules';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { TodayEntry } from './joint-today';
import { rollStrip } from './roll-strip';

const HALVES: readonly Half[] = ['morning', 'afternoon'];

/** Whether the day's sessions are all of primary classes, so Today shows them in bands. */
export function isPrimaryDay(state: State, items: readonly TodaySession[]): boolean {
  return items.length > 0 && items.every((item) => state.classes.get(item.course.classId)?.level === 'primary');
}

const itemsOf = (entry: TodayEntry) => (entry.kind === 'one' ? [entry.item] : entry.items);

/** Whether the session's roll call is a half day's, which a band shows instead of its card. */
export function bandRoll(context: Context, session: Session): boolean {
  return unitOf(context, session.key, session.day)?.key.startsWith('half-day:') === true;
}

export type DayBandsProps = {
  readonly entries: readonly TodayEntry[];
  readonly render: (entry: TodayEntry) => ReactNode;
  readonly context: Context;
  readonly onRoll: (session: Session) => void;
  /** Records every session still awaiting as proposed; set when two or more are. */
  readonly onConfirmDay?: () => void;
  readonly onJournal?: () => void;
};

export function DayBands({ entries, render, context, onRoll, onConfirmDay, onJournal }: DayBandsProps) {
  const t = useText();
  const bands = HALVES.map((half) => ({
    half,
    entries: entries.filter((entry) => itemsOf(entry)[0]?.session.slot.half === half),
  })).filter((band) => band.entries.length > 0);
  const strips = (half: Half, sessions: readonly Session[]): DueStripProps[] => {
    const units = new Map<string, { readonly unit: RollCallUnit; readonly session: Session }>();
    for (const session of sessions) {
      const unit = unitOf(context, session.key, session.day);
      if (unit !== null && bandRoll(context, session) && !units.has(unit.key)) units.set(unit.key, { unit, session });
    }
    const classes = new Set([...units.values()].map(({ unit }) => unit.classId));
    return [...units.values()].flatMap(({ unit, session }) =>
      rollStrip(t, context, session, onRoll).map((strip) => {
        const fact =
          recordedMarks(context, unit) !== null || half === 'morning' ? strip.fact : t('today.afternoonRoll');
        const schoolClass = context.state.classes.get(unit.classId);
        const group =
          unit.rotation === undefined ? undefined : schoolClass?.groups.find((one) => one.id === unit.groupId);
        const named = [classes.size > 1 ? schoolClass?.name : undefined, group?.name].filter(Boolean).join(' · ');
        return {
          ...strip,
          fact: t(named === '' ? 'today.bandRoll' : 'today.bandRollClass', {
            band: t(`today.band.${half}`),
            name: isolate(named),
            fact,
          }),
          testID: `today-band-${half}-roll${units.size > 1 ? `-${unit.key}` : ''}`,
        };
      }),
    );
  };
  return (
    <>
      {bands.map((band) => (
        <View key={band.half} style={styles.band}>
          <SectionHeader testID={`today-band-${band.half}`} label={t(`today.band.${band.half}`)} />
          {strips(
            band.half,
            band.entries.flatMap((entry) => itemsOf(entry).map((item) => item.session)),
          ).map((strip) => (
            <DueStrip key={strip.testID} {...strip} />
          ))}
          {band.entries.map(render)}
        </View>
      ))}
      {onConfirmDay !== undefined && (
        <Button
          testID="today-confirm-day"
          label={t('today.confirmDay')}
          icon={controlIcon('check')}
          onPress={onConfirmDay}
        />
      )}
      {onJournal !== undefined && (
        <Button testID="today-journal" variant="line" label={t('today.journal')} onPress={onJournal} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  band: { gap: spacing['space-10'] },
});
