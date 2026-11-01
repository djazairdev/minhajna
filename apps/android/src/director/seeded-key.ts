// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking a seeded school's key on a director's device (#548, answer 625). A
// national world seeded when it started keeps, on its national space, the
// seeded keys, which the world's sealing key alone opens: for each school, its
// space and the agreement key of the device that holds its key; a national
// space not there yet holds none. A device that holds no key, and waits for
// none, may take its school's on D-Keys, acting as that seeded device: the
// school's keyring stream is read and must still hold only the first keyring,
// which the seeded key must open, before anything is kept; a keyring that moved
// on means another device took the key and changed it, and this one is to be
// added instead (E_SEED_TAKEN). Two devices that take it before either changes
// the keyring act as one device, which the seeded note tells a second device
// not to do. Then the device keeps the key, marked as taken, which its log says
// and later keyrings carry, as D-Issue keeps a key it started, and the first
// issue of each seeded teacher's code under the first epoch, as the seeding
// made it, so the codes page reads every seeded teacher joined, and following
// the school's stream brings the keyring up to date. A take that stopped
// partway is finished by the next: on a device that holds a taken key, each
// teacher with no issue kept gets the seeding's; any other key held takes
// nothing. One change at a time in a world. Errors carry world-session.ts's
// codes: E_NO_SCHOOL_KEY when the world holds no seeded key for the school, or
// for a device that holds none of the world's keys, E_SCHOOL_KEY when it does
// not open, E_SEED_TAKEN when another device took it and changed it,
// E_SCHOOL_WAITING on a device waiting to be added.

import {
  assignmentId,
  keptIssues,
  keptWaiting,
  keyringStream,
  latestHeld,
  openKeyring,
  openSeededKeys,
  readKeyrings,
  seededKeysPlace,
  type DemoSchool,
  type SeededSchoolKey,
} from '@minhajna/core';
import { NATIONAL_SPACE, type HeldWorld } from '../demo/world-calendar-read';
import { worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { readingMissing } from '../school/stream-put';
import { inTurn } from './keys-session';
import { PUBLIC_KEY_BYTES } from './school-desk';

type TakeWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The seeded key of a school, by its seeded ID, or null when the world holds none for it. */
export async function seededKeyOf(
  held: HeldWorld,
  school: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<SeededSchoolKey | null> {
  const place = await kitStep(() => seededKeysPlace(held.sealing, kit.mac));
  const empty = () => ({ status: 200, body: { batches: [], more: false }, retryAfter: null });
  const reading = readingMissing(held.world, send, empty);
  const batches = (await spaceBatches(held.world, NATIONAL_SPACE, reading)).get(place.stream) ?? [];
  const keys = await kitStep(() => openSeededKeys(place, batches, held.world, kit.cipher));
  return keys?.schools.find((one) => one.seed === school) ?? null;
}

/** Whether the key this device holds is a school's seeded key it took. */
export const tookSeeded = (world: Pick<OpenWorld, 'book'>): boolean =>
  latestHeld(world.book.entries, PUBLIC_KEY_BYTES)?.seeded === true;

async function keepSeededIssues(world: TakeWorld, space: string, school: Pick<DemoSchool, 'teachers'>, kit: WorldKit) {
  const assignments = await kitStep(() =>
    Promise.all(school.teachers.map((one) => assignmentId(space, one.id, kit.mac))),
  );
  const kept = keptIssues(world.book.entries, space);
  for (const assignment of assignments.filter((one) => !kept.has(one))) {
    const issued = { school: space, assignment, issue: 1, epoch: 0, access: 'phone' as const, keyNumber: null };
    await world.book.record(world.date, { kind: 'school.issued', issued });
  }
}

/** Keeps the school's seeded key here, with each teacher's first code, or finishes keeping it. */
export function takeSeededKey(
  world: TakeWorld,
  held: HeldWorld | null,
  school: Pick<DemoSchool, 'id' | 'teachers'>,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  return inTurn(world.world, async () => {
    const holding = latestHeld(world.book.entries, PUBLIC_KEY_BYTES);
    if (holding !== null) {
      if (holding.seeded === true) await keepSeededIssues(world, holding.school, school, kit);
      return;
    }
    if (keptWaiting(world.book.entries, PUBLIC_KEY_BYTES) !== null) {
      throw failed('This device waits to hold the key another device holds', 'E_SCHOOL_WAITING');
    }
    const seeded = held === null ? null : await seededKeyOf(held, school.id, kit, send);
    if (seeded === null) throw failed('The world holds no seeded key for this school', 'E_NO_SCHOOL_KEY');
    const stream = await kitStep(() => keyringStream(seeded.space, kit.mac));
    const batches = (await spaceBatches(world.world, seeded.space, send)).get(stream) ?? [];
    const rings = await kitStep(() => readKeyrings(seeded.space, batches, PUBLIC_KEY_BYTES, kit.cipher, kit.mac));
    if (rings.length > 1) throw failed('Another device took the seeded key and changed it', 'E_SEED_TAKEN');
    const [ring] = rings;
    const publicKey = ring?.holders.find((one) => one.id === seeded.device)?.publicKey;
    if (ring === undefined || publicKey === undefined) {
      throw failed('The seeded keyring is not there', 'E_SCHOOL_KEY');
    }
    const crypto = worldKeyCrypto(kit, { publicKey, pkcs8: seeded.agreement });
    const opened = await kitStep(() => openKeyring(ring, seeded.device, crypto));
    if (typeof opened === 'string') throw failed(`The seeded key does not open here: ${opened}`, 'E_SCHOOL_KEY');
    const kept = { school: seeded.space, device: seeded.device, publicKey, pkcs8: seeded.agreement, ring };
    await world.book.record(world.date, { kind: 'school.held', held: { ...kept, seeded: true as const } });
    await keepSeededIssues(world, seeded.space, school, kit);
  });
}
