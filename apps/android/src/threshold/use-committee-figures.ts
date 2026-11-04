// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The totals a committee's page and what is published of it show (#604, #606,
// answers 638, 640): those of the figures day and of the term ends before it,
// read together as the page opens, when the world's date moves, when another
// exam is chosen and when asked again, never on a timer, and not at all with no
// day to read; a day the server does not answer yet is null, and a problem is
// said in the catalogue's words. Any new reading, and leaving the page, drops a
// slower answer.

import type { Day } from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import type { DirectorateFigures } from '../directorate/totals-read';
import { problemOf } from '../school/school-join-session';

/** A level's figures for a day, with each wilaya's for the nation. */
export type LevelFigures = DirectorateFigures & { readonly wilayas?: readonly DirectorateFigures[] };

/** Each day's figures in the order asked, null when not added up; undefined while read or after a problem. */
export interface CommitteeFiguresRead {
  readonly figures: readonly (LevelFigures | null)[] | undefined;
  readonly problem: ReturnType<typeof problemOf> | null;
  readonly reading: boolean;
  readonly again: () => void;
}

type Got = { readonly key: string } & (
  { readonly figures: readonly (LevelFigures | null)[] } | { readonly problem: ReturnType<typeof problemOf> }
);

/** Each day's figures, as `read` reads a day, for a place on the world's date. */
export function useCommitteeFigures(
  place: string,
  days: readonly Day[],
  read: (day: Day) => Promise<LevelFigures | null>,
): CommitteeFiguresRead {
  const [round, setRound] = useState(0);
  const [got, setGot] = useState<Got | null>(null);
  const key = JSON.stringify([place, days, round]);
  const asked = useEffectEvent(() => Promise.all(days.map(read)));
  const none = days.length === 0;
  useEffect(() => {
    if (none) return;
    let live = true;
    asked().then(
      (figures) => live && setGot({ key, figures }),
      (error: unknown) => live && setGot({ key, problem: problemOf(error) }),
    );
    return () => {
      live = false;
    };
  }, [key, none]);
  const now = got?.key === key ? got : null;
  return {
    figures: now !== null && 'figures' in now ? now.figures : undefined,
    problem: now !== null && 'problem' in now ? now.problem : null,
    reading: !none && now === null,
    again: () => setRound((one) => one + 1),
  };
}
