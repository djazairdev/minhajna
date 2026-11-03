// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What I-Grant reads on the inspector's phone in a demo world (#594, answer
// 622). The grants relayed to this device on its stream of the directorate's
// space, each once, opened on the world's date: one that opens is listed, one
// past its end is listed as ended, and one not yet open or that does not open
// for this device is left out; newest first by the day it was made, then by ID;
// each with the seeded school whose space it opens, as the directorate's
// listing names it, or null when none does. Opening a class of a grant takes
// the keys of the class's weeks through the grant on the world's date, then
// posts, before reading anything, one use for each of those weeks on its week's
// stream of the school's space, once a day (school/stream-put.ts), and only
// then reads each week's archive (grant-records.ts), which the class's delivery
// is counted from (course-delivery.ts), with how many corrections and
// director's visas the weeks hold and every version read, or null when no
// week's archive reads. A grant that has ended is E_GRANT_ENDED, and one that
// no longer opens for this device E_GRANT_FORGED. A directorate's space not
// there yet holds no grant. Errors otherwise carry world-session.ts's codes and
// those of school/stream-put.ts.

import {
  addDays,
  compareDays,
  courseDeliveries,
  directorateSpace,
  grantedWeekPlace,
  listedSchools,
  listingPlace,
  openDirectorateRecords,
  openGrant,
  openGrantedWeek,
  openGrantRelays,
  openGrantUses,
  openRelayed,
  relayPlace,
  sealGrantUse,
  useGrant as takeWeek,
  usePlace as placeOfUses,
  type CourseDelivery,
  type Day,
  type DeliveryReading,
  type Grant,
  type GrantUse,
  type WeekRecord,
} from '@minhajna/core';
import { worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnce, readingMissing } from '../school/stream-put';
import { inspectorDevice } from './inspector-key-session';

type InspectorWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** A grant relayed to this device, as I-Grant lists it. */
export interface InspectorGrant {
  readonly request: string;
  readonly grant: Grant;
  /** The seeded school whose space the grant opens, as the directorate lists it, or null. */
  readonly school: string | null;
  /** Past its end by the world's date, so no class of it opens. */
  readonly ended: boolean;
}

async function device(world: InspectorWorld, kit: WorldKit) {
  const own = await inspectorDevice(world, kit);
  return { own, crypto: worldKeyCrypto(kit, own), holder: { id: own.device, publicKey: own.publicKey } };
}

/** The grants relayed to this device that open or have ended, newest first. */
export async function readInspectorGrants(
  world: InspectorWorld,
  directorate: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<InspectorGrant[]> {
  const { own, crypto, holder } = await device(world, kit);
  const space = await kitStep(() => directorateSpace(world.world, directorate, kit.mac));
  const [relays, listing] = await kitStep(() =>
    Promise.all([relayPlace(holder, kit.mac), listingPlace(space, kit.mac)]),
  );
  const empty = { status: 200, body: { batches: [], more: false }, retryAfter: null };
  const batches = await spaceBatches(
    world.world,
    space,
    readingMissing(world.world, send, () => empty),
  );
  const relayed = await kitStep(async () =>
    openRelayed(await openGrantRelays(relays, batches.get(relays.stream) ?? [], kit.cipher), holder, crypto),
  );
  const listed = listedSchools(
    await kitStep(() => openDirectorateRecords(listing, batches.get(listing.stream) ?? [], kit.cipher)),
    world.world,
  );
  const seedOf = (school: string) => [...listed].find(([, one]) => one === school)?.[0] ?? null;
  const found: InspectorGrant[] = [];
  for (const { request, grant } of relayed) {
    const opened = await kitStep(() => openGrant(grant, world.date, own.device, crypto));
    if (opened === 'forged' || opened === 'not-yet') continue;
    found.push({ request, grant, school: seedOf(grant.school), ended: opened === 'ended' });
  }
  return found.sort((a, b) => compareDays(b.grant.from, a.grant.from) || a.grant.id.localeCompare(b.grant.id));
}

const sameUse = (one: unknown, use: GrantUse) =>
  typeof one === 'object' &&
  one !== null &&
  (Object.keys(use) as (keyof GrantUse)[]).every((key) => (one as Record<string, unknown>)[key] === use[key]);

/** A class as its archived weeks give it: its delivery, and how many corrections and visas those weeks hold. */
export interface GrantClassRead {
  readonly delivery: CourseDelivery;
  /** Versions above the first, over the class's weeks. */
  readonly corrections: number;
  readonly visas: number;
  /** Every version of the class's weeks read from the archive. */
  readonly weeks: readonly WeekRecord[];
}

/** Opens a class of a grant, its uses posted first, and answers what its archived weeks give, or null. */
export async function openGrantClass(
  world: InspectorWorld,
  grant: Grant,
  course: string,
  reading: DeliveryReading,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<GrantClassRead | null> {
  const { own, crypto } = await device(world, kit);
  const opened = await kitStep(() => openGrant(grant, world.date, own.device, crypto));
  if (opened === 'ended') throw failed('The grant has ended', 'E_GRANT_ENDED');
  if (typeof opened === 'string') throw failed('The grant does not open on this device', 'E_GRANT_FORGED');
  const weeks = grant.weeks.filter((one) => one.course === course);
  const taken = [];
  for (const week of weeks) {
    const used = await kitStep(() => takeWeek(opened, course, week.week, world.date, crypto));
    if (used === null) throw failed('The grant does not name the week', 'E_GRANT_FORGED');
    taken.push({ week, ...used });
  }
  for (const { use, useKey } of taken) {
    const place = await kitStep(() => placeOfUses(useKey, kit.mac));
    await putOnce(
      {
        world: world.world,
        space: grant.school,
        kind: 'school',
        stream: place.stream,
        open: (batches) => openGrantUses(place, batches, kit.cipher),
        there: (records) => records.some((one) => sameUse(one, use)),
        seal: (first) => sealGrantUse(place, use, first, kit.cipher),
      },
      send,
    );
  }
  const archives = await spaceBatches(world.world, grant.school, send);
  const ca = { key: await caKey(world.world, send), checker: kit };
  const records: WeekRecord[] = [];
  let [corrections, visas] = [0, 0];
  for (const { week, key } of taken) {
    const place = await kitStep(() => grantedWeekPlace(key, grant.id, kit.mac));
    const read = await kitStep(() =>
      openGrantedWeek(place, archives.get(place.stream) ?? [], course, week.week, world.world, ca, kit.cipher),
    );
    if (read === null) continue;
    records.push(...read.versions.map((one) => one.week));
    corrections += read.versions.length - 1;
    visas += read.visas.length;
  }
  if (records.length === 0) return null;
  const days = weeks.map((one) => one.week).sort(compareDays);
  const last: Day = addDays(days.at(-1)!, 6);
  const [delivery] = courseDeliveries(records, days[0], last, reading);
  return delivery === undefined ? null : { delivery, corrections, visas, weeks: records };
}
