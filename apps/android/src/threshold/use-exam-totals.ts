// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's totals a teacher's exam page shows (#602, answer 634): its
// figures for a directorate exam's figures day, as the demo server adds them
// up (totals-read.ts), read as the page opens, when the world's date moves,
// and when asked again, never on a timer, and not at all while there is no
// day or directorate to read; a day the server does not answer yet is null,
// and a problem is said in the catalogue's words. Any new reading, and leaving
// the page, drops a slower answer.

import type { Day } from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { readTotals, type DirectorateFigures } from '../directorate/totals-read';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';

/** The figures as read: null when not added up yet, undefined while read or after a problem. */
export interface ExamTotalsRead {
  readonly figures: DirectorateFigures | null | undefined;
  readonly problem: ReturnType<typeof problemOf> | null;
  readonly reading: boolean;
  readonly again: () => void;
}

type Got = { readonly key: string } & (
  { readonly figures: DirectorateFigures | null } | { readonly problem: ReturnType<typeof problemOf> }
);

/** A directorate's figures for a day in an open world, or nothing while the day or directorate is unknown. */
export function useExamTotals(
  world: Pick<OpenWorld, 'world' | 'date'>,
  day: Day | null,
  directorate: string | null,
  send: Send = worldRequest,
): ExamTotalsRead {
  const [round, setRound] = useState(0);
  const [got, setGot] = useState<Got | null>(null);
  const key = JSON.stringify([world.world, world.date, day, directorate, round]);
  const reading = useEffectEvent((on: Day, of: string) => readTotals(world.world, on, of, send));
  useEffect(() => {
    if (day === null || directorate === null) return;
    let live = true;
    reading(day, directorate)
      .then((figures) => live && setGot({ key, figures }))
      .catch((error: unknown) => live && setGot({ key, problem: problemOf(error) }));
    return () => {
      live = false;
    };
  }, [key, day, directorate]);
  const now = got?.key === key ? got : null;
  return {
    figures: now !== null && 'figures' in now ? now.figures : undefined,
    problem: now !== null && 'problem' in now ? now.problem : null,
    reading: day !== null && directorate !== null && now === null,
    again: () => setRound((one) => one + 1),
  };
}
