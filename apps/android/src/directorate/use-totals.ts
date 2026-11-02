// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals' state on the directorate's PC (#598, answer 629): the announced
// days the world's date has reached that shares are sent for (share-send.ts),
// the latest chosen unless another is, and the directorate's figures for the
// chosen day, read when the page opens, when the world's date moves and when
// another day is chosen, never on a timer. While a day is read its figures
// wait; a day the server does not answer yet is null; a problem is said in the
// catalogue's words. Leaving the page, the date moving or another day chosen
// drops a slower answer.

import type { Day, SchoolCalendar } from '@minhajna/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { sharedDays } from '../director/share-send';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { readTotals, type DirectorateFigures } from './totals-read';

/** What M-Totals shows, and the day it can choose. */
export interface TotalsView {
  /** The announced days reached, each with its term's first day. */
  readonly days: readonly { readonly day: Day; readonly from: Day }[];
  readonly day: Day | null;
  /** The chosen day's figures; null when not added up yet, undefined while read or after a problem. */
  readonly figures: DirectorateFigures | null | undefined;
  readonly problem: ReturnType<typeof problemOf> | null;
  readonly choose: (day: Day) => void;
}

type Read = { readonly key: string } & (
  { readonly figures: DirectorateFigures | null } | { readonly problem: ReturnType<typeof problemOf> }
);

/** The directorate's totals in an open world, for the announced days its date reached. */
export function useDirectorateTotals(
  world: Pick<OpenWorld, 'world' | 'date'>,
  calendar: SchoolCalendar,
  directorate: string,
  send: Send = worldRequest,
): TotalsView {
  const days = useMemo(() => sharedDays(calendar, world.date), [calendar, world.date]);
  const [chosen, setChosen] = useState<Day | null>(null);
  const day = days.find((one) => one.day === chosen)?.day ?? days.at(-1)?.day ?? null;
  const key = `${world.world}:${world.date}:${day ?? ''}`;
  const [read, setRead] = useState<Read | null>(null);
  const live = useRef(key);
  useEffect(() => {
    live.current = key;
    if (day === null) return;
    readTotals(world.world, day, directorate, send)
      .then((figures) => live.current === key && setRead({ key, figures }))
      .catch((error: unknown) => live.current === key && setRead({ key, problem: problemOf(error) }));
    return () => {
      live.current = '';
    };
  }, [key, world.world, day, directorate, send]);
  const now = read?.key === key ? read : null;
  return {
    days,
    day,
    figures: now !== null && 'figures' in now ? now.figures : undefined,
    problem: now !== null && 'problem' in now ? now.problem : null,
    choose: setChosen,
  };
}
