// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's calendar on every device in a demo world (#608, answer 624): the
// calendar releases the Ministry published on the calendar stream of the
// world's national space, opened with the world's sealing key and checked
// against the world's own keys, both held in memory while the world is open,
// laid over the bundled calendar. A national space not opened yet holds no
// release. It is read when the world opens, again when its date moves, and when
// a page asks, as after publishing; while a reading is under way the last one
// read in this world stands, or the bundled calendar before any, and a reading
// that fails says so in the catalogue's words and leaves the calendar as it
// stood.

import {
  worldCalendar,
  worldCalendarFiles,
  worldCalendarPlace,
  worldCalendarUpdates,
  type CalendarUpdate,
  type CountryProfile,
  type Day,
  type SchoolCalendar,
  type WorldKeys,
} from '@minhajna/core';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { worldRequest } from '../network/world-network';
import type { ReferenceResult } from '../reference';
import { problemOf } from '../school/school-join-session';
import { spaceBatches } from '../school/space-read';
import { readingMissing } from '../school/stream-put';
import { kitStep, type Send, type WorldKit } from './world-session';

/** The world's national space, which every device of the world reads. */
export const NATIONAL_SPACE = 'national';

/** What a device holds of an open world in memory, and never keeps. */
export interface HeldWorld {
  readonly world: string;
  readonly keys: WorldKeys;
  readonly sealing: Uint8Array;
}

/** The world's calendar: the bundled one with the releases the world holds laid over it, and those releases. */
export interface WorldCalendar {
  readonly calendar: SchoolCalendar;
  readonly updates: readonly CalendarUpdate[];
}

/** The releases published in the world, read from its national space and laid over the bundled calendar. */
export async function readWorldCalendar(
  held: HeldWorld,
  reference: { readonly profile: CountryProfile; readonly calendar: SchoolCalendar },
  kit: Pick<WorldKit, 'mac' | 'cipher' | 'verify'>,
  send: Send = worldRequest,
): Promise<WorldCalendar> {
  const { profile, calendar } = reference;
  const empty = () => ({ status: 200, body: { batches: [], more: false }, retryAfter: null });
  const batches = await spaceBatches(held.world, NATIONAL_SPACE, readingMissing(held.world, send, empty));
  const place = await kitStep(() => worldCalendarPlace(held.sealing, kit.mac));
  const files = await kitStep(() => worldCalendarFiles(place, batches.get(place.stream) ?? [], kit.cipher));
  const trusted = { world: held.world, trusted: held.keys.trusted };
  const updates = await kitStep(() =>
    worldCalendarUpdates(files, trusted, kit.verify, { release: calendar.release, year: calendar.year }, profile),
  );
  const laid = worldCalendar(calendar.entries, calendar.release, updates);
  return { calendar: { ...calendar, entries: laid.entries, release: laid.release }, updates };
}

type Reference = Extract<ReferenceResult, { ok: true }>;

/**
 * The world's calendar, read when the world opens, when its date moves and when
 * asked `again`, and the reference data with it in place of the bundled one;
 * the bundled calendar without a world held or the reference data, or before
 * the first reading.
 */
export function useWorldCalendar(
  held: HeldWorld | null,
  date: Day | undefined,
  bundled: SchoolCalendar,
  reference: Reference | undefined,
  kit: WorldKit,
  send?: Send,
) {
  const [round, setRound] = useState(0);
  const key = held === null || reference === undefined ? '' : `${held.world}:${date ?? ''}:${round}`;
  const [found, setFound] = useState<{ world: string; read: WorldCalendar } | null>(null);
  const [problem, setProblem] = useState<{ key: string; words: ReturnType<typeof problemOf> } | null>(null);
  const live = useRef(key);
  const read = useEffectEvent(() =>
    held === null || reference === undefined ? null : readWorldCalendar(held, reference, kit, send),
  );
  useEffect(() => {
    live.current = key;
    const reading = read();
    if (reading === null) return;
    const world = key.slice(0, key.indexOf(':'));
    reading.then(
      (calendar) => live.current === key && setFound({ world, read: calendar }),
      (error: unknown) => live.current === key && setProblem({ key, words: problemOf(error) }),
    );
    return () => {
      live.current = '';
    };
  }, [key]);
  const world = held?.world ?? null;
  const last = found !== null && found.world === world ? found.read : null;
  const calendar = last?.calendar ?? reference?.calendar ?? bundled;
  const worldReference = useMemo(() => reference && { ...reference, calendar }, [reference, calendar]);
  return {
    read: last,
    calendar,
    reference: worldReference,
    problem: problem !== null && problem.key === key ? problem.words : null,
    again: useCallback(() => setRound((one) => one + 1), []),
  };
}
