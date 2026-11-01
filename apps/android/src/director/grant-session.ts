// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The grant requests on the director's device in a demo world (#593, answer
// 621): with the school key held on this device, not started, the requests on
// the school's request stream sealed for this device, each once, in the order
// they came, and the school's records of the grants it made, read on the
// stream of every epoch of the keyring, each grant once. Each request resolves
// to the signed weeks of its classes' courses in its range, as the director
// reads the records (records-session.ts), each with its class and teacher, and
// to the classes with none, under the keyring's latest epoch; a course's week
// read from two teachers' channels is taken at its highest version, the first
// read winning a tie. A request reads as lapsed once the world's date is past
// its end, and as relayed when a relay for it is on its inspector's stream of
// the directorate's space, a claim; a directorate's space not there yet holds
// none. Errors carry world-session.ts's codes and those of holding the key.

import {
  compareDays,
  directorateSpace,
  grantRecordPlace,
  grantsMade,
  grantWeeksOf,
  latestEpoch,
  openGrantEnvelopes,
  openGrantRelays,
  openGrantRequests,
  openGrantsMade,
  relayedRequests,
  relayPlace,
  requestPlace,
  type DemoSchool,
  type GrantMade,
  type GrantRequest,
  type SealedBatch,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { readingMissing } from '../school/stream-put';
import { holdSchool, PUBLIC_KEY_BYTES, type HeldDesk } from './issue-session';
import { recordsOf, type RecordedWeek } from './records-session';

export type GrantWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;
/** The school as the director's device knows it: its name, staff list and directorate. */
export type GrantSchool = Pick<DemoSchool, 'name' | 'teachers' | 'directorateId'>;

/** A signed week as a request resolves to it: its course's class and teacher, and the week as read. */
export interface ResolvedWeek {
  readonly class: string;
  readonly teacher: string;
  readonly recorded: RecordedWeek;
}

/** A request addressed to this device, and how it stands. */
export interface AskedGrant {
  readonly request: GrantRequest;
  /** The school's record of the grant made for it, the first recorded, or null. */
  readonly made: GrantMade | null;
  readonly weeks: readonly ResolvedWeek[];
  /** The classes the request names that have no signed week in its range. */
  readonly missing: readonly string[];
  readonly lapsed: boolean;
  /** Whether a relay for it is on its inspector's stream of the directorate's space: a claim. */
  readonly relayed: boolean;
}

/** What the access page reads: the desk held, the signed weeks by course and first day, and the requests. */
export interface GrantsRead {
  readonly desk: HeldDesk;
  readonly signed: ReadonlyMap<string, ResolvedWeek>;
  readonly asked: readonly AskedGrant[];
}

/** How a signed week is named among the weeks read. */
export const weekName = (course: string, week: string) => `${course}/${week}`;

async function signedWeeks(world: GrantWorld, desk: HeldDesk, school: GrantSchool, kit: WorldKit, send: Send) {
  const found = new Map<string, ResolvedWeek>();
  for (const one of await recordsOf(world, desk, school, kit, send)) {
    for (const course of one.courses) {
      for (const recorded of course.weeks) {
        const name = weekName(recorded.week.course, recorded.week.week);
        const before = found.get(name);
        if (before === undefined || recorded.week.version > before.recorded.week.version)
          found.set(name, { class: course.class, teacher: course.teacher, recorded });
      }
    }
  }
  return found;
}

/** The school's records of the grants it made, on every epoch's stream, each grant once. */
export async function grantsOf(desk: HeldDesk, batches: ReadonlyMap<string, SealedBatch[]>, kit: WorldKit) {
  const records: unknown[] = [];
  for (let epoch = 0; epoch < desk.opened.keys.length; epoch += 1) {
    const place = await kitStep(() => grantRecordPlace(desk.opened, epoch, desk.crypto, kit.mac));
    records.push(...(await kitStep(() => openGrantsMade(place, batches.get(place.stream) ?? [], kit.cipher))));
  }
  return grantsMade(records, desk.held.school, PUBLIC_KEY_BYTES);
}

async function requestsTo(desk: HeldDesk, batches: ReadonlyMap<string, SealedBatch[]>, kit: WorldKit) {
  const place = await kitStep(() => requestPlace(desk.held.school, kit.mac));
  const records = await kitStep(() => openGrantEnvelopes(place, batches.get(place.stream) ?? [], kit.cipher));
  return kitStep(() => openGrantRequests(records, desk.held.school, desk.held.device, desk.crypto, kit.cipher));
}

/** The requests relayed on each inspector's stream, by the inspector's public key. */
async function relaysFor(
  world: string,
  directorate: string,
  requests: readonly GrantRequest[],
  kit: WorldKit,
  send: Send,
) {
  const empty = { status: 200, body: { batches: [], more: false }, retryAfter: null };
  const space = await kitStep(() => directorateSpace(world, directorate, kit.mac));
  const batches = await spaceBatches(
    world,
    space,
    readingMissing(world, send, () => empty),
  );
  const found = new Map<string, ReadonlySet<string>>();
  for (const { inspector } of requests) {
    if (found.has(inspector.publicKey)) continue;
    const place = await kitStep(() => relayPlace(inspector, kit.mac));
    const records = await kitStep(() => openGrantRelays(place, batches.get(place.stream) ?? [], kit.cipher));
    found.set(inspector.publicKey, relayedRequests(records));
  }
  return found;
}

/** The requests addressed to this device, each resolved to its signed weeks, with the grants made for them. */
export async function readGrants(
  world: GrantWorld,
  school: GrantSchool,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<GrantsRead> {
  const desk = await holdSchool(world, kit, send, false);
  const signed = await signedWeeks(world, desk, school, kit, send);
  const batches = await spaceBatches(world.world, desk.held.school, send);
  const requests = await requestsTo(desk, batches, kit);
  const made = await grantsOf(desk, batches, kit);
  const relayed = await relaysFor(world.world, school.directorateId, requests, kit, send);
  const seen = [...signed.values()].map(({ recorded }) => ({ course: recorded.week.course, week: recorded.week.week }));
  const epoch = latestEpoch(desk.opened);
  const asked: AskedGrant[] = [];
  for (const request of requests) {
    const resolved = await kitStep(() => grantWeeksOf(request, seen, epoch, kit.mac));
    asked.push({
      request,
      made: made.find((one) => one.request === request.id) ?? null,
      weeks: resolved.weeks.flatMap((one) => signed.get(weekName(one.course, one.week)) ?? []),
      missing: resolved.missing,
      lapsed: compareDays(world.date, request.until) > 0,
      relayed: relayed.get(request.inspector.publicKey)?.has(request.id) ?? false,
    });
  }
  return { desk, signed, asked };
}
