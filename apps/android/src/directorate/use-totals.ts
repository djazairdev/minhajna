// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals' state on the directorate's PC (#598, answer 629), and N-Totals' on
// the Ministry's (#599, answer 630): the announced days the world's date has
// reached that shares are sent for (share-send.ts), by the world's calendar,
// which a director's device sends by, and the bundled one, which the seeded
// schools' shares are sent by, each with its term, the latest chosen unless
// another is, and the view's figures for the chosen day, read when the page
// opens, when the world's date moves, when another day is chosen and when asked
// again, never on a timer. While a day is read its figures wait; a day the
// server does not answer yet is null; a problem is said in the catalogue's
// words. Any new reading, and leaving the page, drops a slower answer.

import type { Day, SchoolCalendar, Term } from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { sharedDays } from '../director/share-send';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { readMinistryTotals, readTotals, type DirectorateFigures, type MinistryFigures } from './totals-read';

/** An announced day reached, with the term it falls in. */
export interface TotalsDay {
  readonly day: Day;
  readonly term: Term;
}

/** What a totals page shows, and the day it can choose. */
export interface TotalsView<T> {
  readonly days: readonly TotalsDay[];
  readonly day: TotalsDay | null;
  /** The chosen day's figures; null when not added up yet, undefined while read or after a problem. */
  readonly figures: T | null | undefined;
  readonly problem: ReturnType<typeof problemOf> | null;
  readonly choose: (day: Day) => void;
  /** Reads the chosen day again. */
  readonly again: () => void;
}

type Read<T> = { readonly key: string } & (
  { readonly figures: T | null } | { readonly problem: ReturnType<typeof problemOf> }
);

/** The announced days reached by any of the calendars, in order, each with its term in the first that has it. */
export function totalsDays(calendars: readonly SchoolCalendar[], date: Day): TotalsDay[] {
  const days = new Map<Day, TotalsDay>();
  for (const calendar of calendars) {
    for (const { day, from } of sharedDays(calendar, date)) {
      const term = calendar.year.terms.find((one) => one.from === from);
      if (term !== undefined && !days.has(day)) days.set(day, { day, term });
    }
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** A view's totals in an open world, for the announced days its date reached, read as `read` reads a day. */
function useDayTotals<T>(
  world: Pick<OpenWorld, 'world' | 'date'>,
  calendars: readonly SchoolCalendar[],
  scope: string | null,
  send: Send,
  read: (day: Day) => Promise<T | null>,
): TotalsView<T> {
  const days = totalsDays(calendars, world.date);
  const [chosen, setChosen] = useState<Day | null>(null);
  const [round, setRound] = useState(0);
  const day = days.find((one) => one.day === chosen) ?? days.at(-1) ?? null;
  const asked = day?.day ?? null;
  const key = JSON.stringify([world.world, world.date, scope, asked, round]);
  const [got, setGot] = useState<Read<T> | null>(null);
  const reading = useEffectEvent(read);
  useEffect(() => {
    if (asked === null) return;
    let live = true;
    reading(asked)
      .then((figures) => live && setGot({ key, figures }))
      .catch((error: unknown) => live && setGot({ key, problem: problemOf(error) }));
    return () => {
      live = false;
    };
  }, [key, asked, send]);
  const now = got?.key === key ? got : null;
  return {
    days,
    day,
    figures: now !== null && 'figures' in now ? now.figures : undefined,
    problem: now !== null && 'problem' in now ? now.problem : null,
    choose: setChosen,
    again: () => setRound((one) => one + 1),
  };
}

/** The directorate's totals in an open world, for the announced days its date reached. */
export function useDirectorateTotals(
  world: Pick<OpenWorld, 'world' | 'date'>,
  calendars: readonly SchoolCalendar[],
  directorate: string,
  send: Send = worldRequest,
): TotalsView<DirectorateFigures> {
  return useDayTotals(world, calendars, directorate, send, (day) => readTotals(world.world, day, directorate, send));
}

/** The Ministry's totals in an open world, for the announced days its date reached. */
export function useMinistryTotals(
  world: Pick<OpenWorld, 'world' | 'date'>,
  calendars: readonly SchoolCalendar[],
  send: Send = worldRequest,
): TotalsView<MinistryFigures> {
  return useDayTotals(world, calendars, null, send, (day) => readMinistryTotals(world.world, day, send));
}
