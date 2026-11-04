// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Obs-Report's state on the observatory's PC (#627, answer 680): the latest
// term whose end the world's date has reached, never the clock's, and its packs
// as the server gives them (figures-read.ts), read when the page opens, when
// the date brings another term and when asked again, never on a timer; a term's
// figures stand still once formed, so a date moving within it reads nothing. A
// term whose figures are not ready yet is ended by the device holding the
// world's starter token, then read again, and is `forming` if still not ready;
// ending it twice changes nothing on the server. Any other device is `waiting`
// for the starting device to end it. Once ready, one pack's figures are read at
// a time, the first unless another place is chosen; another term drops the
// choice, and a term with no pack shown is `empty`. A problem is said in the
// catalogue's words. Any new reading, and leaving the page, drops a slower
// answer and sends nothing more for the reading it belonged to.

import { endedTerm, type SchoolYear } from '@minhajna/core';
import { useEffect, useEffectEvent, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import { problemOf, type ProblemKey } from '../demo/world-problems';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { closeTerm, packFigures, termPacks, type PackFigures, type PackHeading, type ReportTerm } from './figures-read';

/** Where a term's report stands: no term ended yet, read, awaiting its end, formed, no pack, ready or failed. */
export type ReportState = 'none' | 'reading' | 'waiting' | 'forming' | 'empty' | 'ready' | 'problem';

/** What Obs-Report shows, and the pack it can choose. */
export interface TermFigures {
  /** The term reported, or null before the world's date reaches the first term's end. */
  readonly term: ReportTerm | null;
  readonly state: ReportState;
  /** The term's packs once ready, in the server's order; else none. */
  readonly packs: readonly PackHeading[];
  /** The chosen pack's place among them. */
  readonly at: number;
  /** The chosen pack's figures; undefined while read, after a problem, or with no pack. */
  readonly figures: PackFigures | undefined;
  /** The term's problem, or once it is ready the chosen pack's. */
  readonly problem: ProblemKey | null;
  readonly choose: (at: number) => void;
  /** Reads the term, and its chosen pack, again. */
  readonly again: () => void;
}

type Got<T> = { readonly key: string } & ({ readonly value: T } | { readonly problem: ProblemKey });

export type TermRead = readonly PackHeading[] | 'waiting' | 'forming';

/** The term's packs, ending its collection first on the device holding the starter token. */
export async function readTerm(
  world: string,
  starter: string | null,
  asked: ReportTerm,
  send: Send,
  live: () => boolean,
): Promise<TermRead> {
  const first = await termPacks(world, asked, send);
  if (first !== 'unready') return first;
  if (starter === null || !live()) return 'waiting';
  await closeTerm(world, starter, asked, send);
  if (!live()) return 'forming';
  const again = await termPacks(world, asked, send);
  return again === 'unready' ? 'forming' : again;
}

/** Reads `read` whenever `key` changes, unless `asked` is null, and keeps only the answer for the latest key. */
function useRead<T>(key: string, asked: boolean, read: (live: () => boolean) => Promise<T>) {
  const [got, setGot] = useState<Got<T> | null>(null);
  const reading = useEffectEvent(read);
  useEffect(() => {
    if (!asked) return;
    let live = true;
    reading(() => live).then(
      (value) => {
        if (live) setGot({ key, value });
      },
      (error: unknown) => {
        if (live) setGot({ key, problem: problemOf(error) });
      },
    );
    return () => {
      live = false;
    };
  }, [key, asked]);
  return got?.key === key ? got : null;
}

/** The observatory's report on the latest term the open world's date has ended, in the world's school year. */
export function useTermFigures(
  world: Pick<OpenWorld, 'world' | 'date' | 'starter'>,
  year: SchoolYear,
  send: Send = worldRequest,
): TermFigures {
  const ended = endedTerm(year, world.date);
  const term: ReportTerm | null = ended === null ? null : { year: year.id, term: ended.number };
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState<{ readonly which: string; readonly at: number } | null>(null);
  const which = JSON.stringify([world.world, term]);
  const termKey = JSON.stringify([which, world.starter, round]);
  const read = useRead(termKey, term !== null, (live) => readTerm(world.world, world.starter, term!, send, live));
  const value = read !== null && 'value' in read ? read.value : null;
  const ready = value !== null && typeof value !== 'string';
  const packs = ready ? value : [];
  const at = chosen?.which === which && chosen.at < packs.length ? chosen.at : 0;
  const packKey = JSON.stringify([termKey, at]);
  const pack = useRead(packKey, ready && packs.length > 0, () => packFigures(world.world, term!, at, send));
  const shown = ready ? pack : null;
  const held = packs.length > 0 ? 'ready' : 'empty';
  const state: ReportState =
    term === null ? 'none' : read === null ? 'reading' : value === null ? 'problem' : ready ? held : value;
  return {
    term,
    state,
    packs,
    at,
    figures: shown !== null && 'value' in shown ? shown.value : undefined,
    problem:
      read !== null && 'problem' in read ? read.problem : shown !== null && 'problem' in shown ? shown.problem : null,
    choose: (place) => {
      if (Number.isSafeInteger(place) && place >= 0) setChosen({ which, at: place });
    },
    again: () => setRound((one) => one + 1),
  };
}
