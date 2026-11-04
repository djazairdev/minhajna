// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's comparison with its peers for the latest term the world's date has
// ended (#623, R-8.4-04, answers 680 and 700): worked out on the device, from
// the term's published figures of the class's pack, its wilaya's when shown,
// else the nation's. What was due goes first (settle), a failure stopping there
// so the term stays open for it, since ending a term's collection, which the
// device holding the starter token does as the reading asks, shuts it for good.
// Any other device waits for that device. A pack whose nation's figure is
// hidden is not published, so there is nothing to compare, and that is said, as
// is a class whose sending cannot be worked out. Reading again, or leaving,
// drops a slower answer and sends nothing more.

import {
  endedTerm,
  insightsCompare,
  packKey,
  planScale,
  yearLessons,
  type InsightsComparison,
  type InsightsSending,
  type RandomBytes,
  type RecordBook,
  type Day,
  type WorldMac,
  type WorldTeacher,
} from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import { problemOf, type ProblemKey } from '../demo/world-problems';
import type { Send } from '../demo/world-session';
import { termReference, type TermReference } from '../director/seeded-fill';
import { packFigures, type Figure } from '../observatory/figures-read';
import { readTerm } from '../observatory/use-term-figures';
import { termSendings } from './term-sendings';

/** Where a class's comparison stands. */
export type ClassCompare =
  | { readonly kind: 'reading' | 'waiting' | 'forming' | 'hidden' | 'unmade' }
  | { readonly kind: 'problem'; readonly problem: ProblemKey }
  | {
      readonly kind: 'ready';
      readonly sending: InsightsSending;
      /** Whose figure it is: the wilaya's, or the nation's when the wilaya's is hidden. */
      readonly scope: 'wilaya' | 'nation';
      readonly figure: Figure;
      readonly comparison: InsightsComparison;
      /** Whether the plan's sessions were stretched over the year's lessons. */
      readonly scaled: boolean;
    };

export type ClassCompareInput = {
  /** The open teachers' world, or null outside one. */
  readonly open: {
    readonly world: string;
    readonly starter: string | null;
    readonly date: Day;
    readonly book: RecordBook;
  } | null;
  readonly mine: WorldTeacher | null;
  /** The class compared, or null while none is. */
  readonly classId: string | null;
  readonly reference?: TermReference;
  readonly kit: { readonly mac: WorldMac; readonly random: RandomBytes };
  readonly digest: (text: string) => Promise<string>;
  readonly send: Send;
  /** Sends what is due, if taking part is on, before the term's collection may end. */
  readonly settle: () => Promise<unknown>;
};

type Reading = Omit<ClassCompareInput, 'open' | 'mine' | 'reference' | 'classId'> &
  NonNullable<ClassCompareInput['open']> & {
    readonly mine: WorldTeacher;
    readonly reference: TermReference;
  };

/** Reads the class's comparison. */
async function readCompare(input: Reading, classId: string, live: () => boolean): Promise<ClassCompare> {
  const { world, starter, date, mine, reference, send, settle } = input;
  const term = endedTerm(reference.calendar.year, date);
  if (term === null) return { kind: 'unmade' };
  const made = await termSendings({ ...input, term });
  const sending = made.find((one) => one.classId === classId)?.sending;
  if (sending === undefined || typeof sending === 'string') return { kind: 'unmade' };
  await settle();
  if (!live()) return { kind: 'reading' };
  const asked = { year: reference.calendar.year.id, term: term.number };
  const packs = await readTerm(world, starter, asked, send, live);
  if (packs === 'waiting' || packs === 'forming') return { kind: packs };
  const at = packs.findIndex((one) => one.pack === sending.pack && one.release === sending.release);
  if (at < 0) return { kind: 'hidden' };
  if (!live()) return { kind: 'reading' };
  const { nation, wilayas } = await packFigures(world, asked, at, send);
  const own = wilayas.find(([code]) => code === sending.wilaya)?.[1];
  const figure = own ?? nation;
  if (figure === null) return { kind: 'hidden' };
  const full = termReference(reference);
  const items = full.packs.get(packKey(sending.pack, sending.release))?.items ?? [];
  const one = mine.school.classes.find((each) => each.id === classId);
  const lessons = one === undefined ? 0 : yearLessons(full, mine.school, one, sending.subject);
  const scale = planScale(items, lessons);
  const comparison = insightsCompare(sending, items, figure, scale);
  const scope = own === undefined ? 'nation' : 'wilaya';
  return { kind: 'ready', sending, scope, figure, comparison, scaled: scale > 1 };
}

/** The class's comparison, read when it opens and when asked again. */
export function useClassCompare(input: ClassCompareInput): {
  readonly compare: ClassCompare;
  readonly again: () => void;
} {
  const { open, mine, classId, reference } = input;
  const [round, setRound] = useState(0);
  const key = JSON.stringify([open?.world, open?.starter, open?.date, classId, round]);
  const [got, setGot] = useState<{ readonly key: string; readonly compare: ClassCompare } | null>(null);
  if (classId === null && got !== null) setGot(null);
  const asked = open !== null && mine !== null && reference !== undefined && classId !== null;
  const read = useEffectEvent((live: () => boolean) =>
    readCompare({ ...input, ...open!, mine: mine!, reference: reference! }, classId!, live),
  );
  useEffect(() => {
    if (!asked) return;
    let live = true;
    read(() => live).then(
      (compare) => {
        if (live) setGot({ key, compare });
      },
      (error: unknown) => {
        if (live) setGot({ key, compare: { kind: 'problem', problem: problemOf(error) } });
      },
    );
    return () => {
      live = false;
    };
  }, [key, asked]);
  return {
    compare: got?.key === key ? got.compare : { kind: 'reading' },
    again: () => setRound((one) => one + 1),
  };
}
