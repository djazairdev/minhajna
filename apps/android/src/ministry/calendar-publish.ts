// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Publishing the Ministry's draft as the world's next calendar release (#608,
// answer 624): the calendar stream of the world's national space is read with
// the world's keys, held in memory, and the draft becomes the release after the
// latest it holds, published on the world's date as this device knows it,
// signed with the world's key and put once on the stream, the national space
// opened first. A release another device put meanwhile is built on, the draft
// laid over it. When the latest release already makes the same change it is not
// put again, so publishing after a failure finishes what was begun. Read back,
// the release counting must be this one; otherwise the relay did not keep what
// it took, and E_CALENDAR_RACE says so, the draft kept. The world's announced
// days after its date, read from the server, are then replaced by those of the
// calendar with every release read laid over it; when the date moved before
// they arrive, it is read and they are worked out again, once, a refusal while
// it stayed being the server's. The page publishes one draft at a time, then
// keeps the draft empty and has the world's calendar read again, saying the
// release is out even when the empty draft could not be kept, and that it was
// not; a problem is said in the catalogue's words.

import {
  announcedDaysOf,
  EMPTY_DRAFT,
  canonicalJson,
  draftUpdate,
  isDay,
  sealWorldCalendar,
  updateCounts,
  worldCalendar,
  worldCalendarFile,
  worldCalendarFiles,
  worldCalendarPlace,
  worldCalendarUpdates,
  type CalendarDraft,
  type CalendarUpdate,
  type CountryProfile,
  type Day,
  type SealedBatch,
  type SchoolCalendar,
} from '@minhajna/core';
import { useRef, useState } from 'react';
import { NATIONAL_SPACE, type HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, WORLD_SIGNER, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest, type WorldAnswer } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { spaceBatches } from '../school/space-read';
import { putOnce } from '../school/stream-put';

/** What the page says went wrong publishing. */
export type PublishProblem = ReturnType<typeof problemOf> | 'demo.ministryCalendar.publish.notEmptied';

/** What publishing reads the stream with and signs. */
export interface Publishing {
  readonly held: HeldWorld;
  /** The world's date, which the release is published on. */
  readonly date: Day;
  /** The world's calendar as this page read it, and the profile. */
  readonly reference: { readonly profile: CountryProfile; readonly calendar: SchoolCalendar };
  readonly draft: CalendarDraft;
  readonly kit: Pick<WorldKit, 'mac' | 'cipher' | 'verify' | 'sign'>;
}

/** Whether two updates make the same change, whatever their release and day. */
const sameChange = (a: Pick<CalendarUpdate, 'entries' | 'removed'>, b: Pick<CalendarUpdate, 'entries' | 'removed'>) =>
  canonicalJson({ entries: a.entries, removed: a.removed }) ===
  canonicalJson({ entries: b.entries, removed: b.removed });

/** The releases on the stream after the calendar the page read. */
async function releases(
  place: Awaited<ReturnType<typeof worldCalendarPlace>>,
  batches: readonly SealedBatch[],
  publishing: Publishing,
) {
  const { held, reference, kit } = publishing;
  const files = await worldCalendarFiles(place, batches, kit.cipher);
  const { release, year } = reference.calendar;
  const trusted = { world: held.world, trusted: held.keys.trusted };
  return worldCalendarUpdates(files, trusted, kit.verify, { release, year }, reference.profile);
}

/**
 * Replaces the world's announced days after its date, as read, with the
 * calendar's; read again once if refused, and the refusal kept when the date
 * did not move.
 */
async function announce(publishing: Publishing, updates: readonly CalendarUpdate[], send: Send): Promise<void> {
  const { held, reference } = publishing;
  const { entries } = worldCalendar(reference.calendar.entries, reference.calendar.release, updates);
  let refused: { readonly date: string; readonly answer: WorldAnswer } | null = null;
  for (let tries = 0; tries < 2; tries += 1) {
    const read = await send({ method: 'GET', path: `/worlds/${held.world}/date` });
    if (read.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
    const date = (read.body as { date?: unknown } | null)?.date;
    if (read.status !== 200 || typeof date !== 'string' || !isDay(date)) throw unexpected(read);
    if (refused !== null && refused.date === date) throw unexpected(refused.answer);
    const announcedDays = announcedDaysOf(reference.calendar.year, entries, date);
    const path = `/worlds/${held.world}/announced-days`;
    const answer = await send({ method: 'PUT', path, body: { announcedDays } });
    if (answer.status === 200) return;
    if (answer.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
    if (answer.status !== 409 && answer.status !== 400) throw unexpected(answer);
    refused = { date, answer };
  }
  throw failed('The world’s date kept moving', 'E_WORLD_SERVER');
}

/** Publishes the draft as the world's next release, and gives the release that counts. */
export async function publishCalendar(publishing: Publishing, send: Send = worldRequest): Promise<CalendarUpdate> {
  const { held, reference, draft, kit, date } = publishing;
  const { release } = reference.calendar;
  const place = await kitStep(() => worldCalendarPlace(held.sealing, kit.mac));
  const found: { mine: CalendarUpdate | null } = { mine: null };
  await putOnce(
    {
      world: held.world,
      space: NATIONAL_SPACE,
      kind: 'national',
      stream: place.stream,
      open: (batches) => releases(place, batches, publishing),
      there: (records) => {
        const last = (records as readonly CalendarUpdate[]).at(-1);
        const update = draftUpdate(draft, reference.profile, reference.calendar.year, last?.release ?? release, date);
        found.mine = last !== undefined && sameChange(last, update) ? last : update;
        return found.mine === last;
      },
      seal: async (first) => {
        const file = await worldCalendarFile(held.keys, WORLD_SIGNER, found.mine!, kit.sign);
        return sealWorldCalendar(place, file, first, kit.cipher);
      },
    },
    send,
  );
  const published = found.mine!;
  const batches = (await spaceBatches(held.world, NATIONAL_SPACE, send)).get(place.stream) ?? [];
  const updates = await kitStep(() => releases(place, batches, publishing));
  if (!updateCounts(updates, published)) throw failed('The relay did not keep the release', 'E_CALENDAR_RACE');
  await announce(publishing, updates, send);
  return published;
}

/**
 * Publishing from the Ministry's calendar page: one at a time, then the draft
 * kept empty under the world's date and `onPublished` told, the release said
 * even when the empty draft could not be kept; a problem is in the catalogue's
 * words, counted so the same one twice is said twice.
 */
export function useCalendarPublish(
  world: Pick<OpenWorld, 'book' | 'date'>,
  held: HeldWorld | null,
  reference: Publishing['reference'],
  kit: Publishing['kit'],
  onPublished: () => void,
  send?: Send,
) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ words: PublishProblem; count: number } | null>(null);
  const [published, setPublished] = useState<{ release: string; count: number } | null>(null);
  const working = useRef(false);
  const publish = (draft: CalendarDraft) => {
    if (working.current || held === null) return;
    working.current = true;
    setBusy(true);
    publishCalendar({ held, date: world.date, reference, draft, kit }, send)
      .then(async (update) => {
        const emptied = await world.book.record(world.date, { kind: 'ministry.calendar', draft: EMPTY_DRAFT }).then(
          () => true,
          () => false,
        );
        setProblem((before) =>
          emptied ? null : { words: 'demo.ministryCalendar.publish.notEmptied', count: (before?.count ?? 0) + 1 },
        );
        setPublished((before) => ({ release: update.release, count: (before?.count ?? 0) + 1 }));
        onPublished();
      })
      .catch((error: unknown) => setProblem((before) => ({ words: problemOf(error), count: (before?.count ?? 0) + 1 })))
      .finally(() => {
        working.current = false;
        setBusy(false);
      });
  };
  return { busy, problem, published, publish, ready: held !== null };
}
