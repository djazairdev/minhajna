// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school keyring between a demo world's devices (#571, answer 600). To
// follow the school's stream, a device finds the latest keyring it kept that
// the stream also holds, opens it, and adopts every keyring after it there,
// keeping each in the world's store; when the stream holds nothing newer but
// the device kept keyrings after it, as after part 2, or the stream is empty,
// it puts them there in order. A keyring the device kept that the stream never
// took, because another change came first, is dropped. Each change is proposed
// at the next number the follow read, so a change that landed since takes it
// first, and kept only once the relay took it; when another change took that
// number first, the device follows the stream again and makes the change again
// on top, until what the director chose no longer applies, which is
// E_KEYRING_CHANGED. A device the stream removed, by a holder's proof, gets
// E_KEY_REMOVED. Callers run each change through keys-session.ts's `inTurn`.

import {
  eventOf,
  followKeyrings,
  keyringStream,
  latestHeld,
  openKeyring,
  readKeyrings,
  readSchoolHeld,
  recoveryOrphaned,
  sealKeyring,
  toBase64Url,
  type Entry,
  type OpenedKeyring,
  type SchoolKeyring,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { spaceBatches } from '../school/space-read';
import { PUBLIC_KEY_BYTES, type IssueDesk } from './school-desk';

type KeyringWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** How many times a change is made again on top before it gives up. */
const TRIES = 4;

/** The school's keyring as this device now holds it, and whether its recovery's maker is gone. */
export interface Followed {
  readonly desk: IssueDesk;
  readonly orphaned: boolean;
}

/**
 * The keyrings this store kept for the school, in the order it kept them,
 * each once; one the stream never took may stand before the ones adopted in
 * its place, so a recovery reads the stream's order, never this one.
 */
export function keptRings(entries: readonly Entry[], school: string): readonly SchoolKeyring[] {
  const rings: SchoolKeyring[] = [];
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'school.held') continue;
    const held = readSchoolHeld(event.held, PUBLIC_KEY_BYTES);
    if (held?.school === school && !rings.some((one) => one.tag === held.ring.tag)) rings.push(held.ring);
  }
  return rings;
}

async function readStream(world: KeyringWorld, desk: IssueDesk, kit: WorldKit, send: Send) {
  const school = desk.held.school;
  const stream = await kitStep(() => keyringStream(school, kit.mac));
  const batches = (await spaceBatches(world.world, school, send)).get(stream) ?? [];
  const next = batches.reduce((most, one) => Math.max(most, one.number + 1), 0);
  const rings = await kitStep(() => readKeyrings(school, batches, PUBLIC_KEY_BYTES, kit.cipher, kit.mac));
  return { stream, next, rings };
}

/** Puts keyrings on the school's stream from `first`, all or none; false when another change took that number. */
async function put(
  world: KeyringWorld,
  school: string,
  rings: readonly SchoolKeyring[],
  first: number,
  kit: WorldKit,
  send: Send,
) {
  if (rings.length === 0) return true;
  const batches: string[] = [];
  let stream = '';
  for (const ring of rings) {
    const sealed = await kitStep(() => sealKeyring(ring, first + batches.length, kit.cipher, kit.mac));
    stream = sealed.stream;
    batches.push(...sealed.batches.map((one) => toBase64Url(one.bytes)));
  }
  const body = { stream, first, batches };
  const answer = await send({ method: 'POST', path: `/worlds/${world.world}/spaces/${school}/batches`, body });
  if (answer.status !== 201 && answer.status !== 409) throw unexpected(answer);
  return answer.status === 201;
}

/** Keeps keyrings this device now holds in the world's store, in order, and answers the desk on the last. */
async function keep(world: KeyringWorld, desk: IssueDesk, rings: readonly OpenedKeyring[]): Promise<IssueDesk> {
  for (const one of rings) {
    await world.book.record(world.date, { kind: 'school.held', held: { ...desk.held, ring: one.ring } });
  }
  const last = rings.at(-1);
  if (last === undefined) return desk;
  if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES)?.ring.tag !== last.ring.tag) {
    throw failed('The world’s store did not keep the keyring', 'E_WORLD');
  }
  return { ...desk, held: { ...desk.held, ring: last.ring }, opened: last };
}

/** Where a device stands after following: the keyring it holds, and the stream's next number as it read it. */
interface Standing {
  readonly desk: IssueDesk;
  readonly next: number;
}

/**
 * Follows the school's stream once; null when it put there what this device
 * kept and the stream lacked, or that lost, so the stream is read again.
 */
async function followOnce(world: KeyringWorld, desk: IssueDesk, kit: WorldKit, send: Send): Promise<Standing | null> {
  const { next, rings } = await readStream(world, desk, kit, send);
  const kept = keptRings(world.book.entries, desk.held.school);
  const tags = new Set(rings.map((one) => one.tag));
  let at = kept.length - 1;
  while (at >= 0 && !tags.has(kept[at].tag)) at -= 1;
  if (at < 0) {
    await put(world, desk.held.school, kept, next, kit, send);
    return null;
  }
  const base = await kitStep(() => openKeyring(kept[at], desk.held.device, desk.crypto));
  if (typeof base === 'string') throw failed(`The school key does not open here: ${base}`, 'E_SCHOOL_KEY');
  const followed = await kitStep(() => followKeyrings(base, rings, desk.held.device, desk.crypto));
  if (followed === 'removed') throw failed('A holder removed this device from the school key', 'E_KEY_REMOVED');
  const after = kept.slice(at + 1);
  if (followed.adopted.length > 0 || after.length === 0) {
    return { desk: await keep(world, { ...desk, opened: base }, followed.adopted), next };
  }
  await put(world, desk.held.school, after, next, kit, send);
  return null;
}

async function follow(world: KeyringWorld, desk: IssueDesk, kit: WorldKit, send: Send): Promise<Standing> {
  for (let tries = 0; tries < TRIES; tries += 1) {
    const done = await followOnce(world, desk, kit, send);
    if (done !== null) return done;
  }
  throw failed('The school’s stream kept changing', 'E_KEYRING_CHANGED');
}

/** Follows the school's stream and answers the keyring this device now holds. */
export async function followSchool(world: KeyringWorld, desk: IssueDesk, kit: WorldKit, send: Send): Promise<Followed> {
  const done = (await follow(world, desk, kit, send)).desk;
  return { desk: done, orphaned: await kitStep(() => recoveryOrphaned(done.opened.ring, desk.crypto)) };
}

/**
 * Proposes the changes `change` makes on the keyring this device holds, at
 * the number the stream gave when it was followed, so a change that lands in
 * between takes it first and this one is made again on top; null from
 * `change` means what the director chose no longer applies, and none means
 * there is nothing to change.
 */
export async function proposeChanges(
  world: KeyringWorld,
  desk: IssueDesk,
  kit: WorldKit,
  send: Send,
  change: (opened: OpenedKeyring) => Promise<readonly OpenedKeyring[] | null>,
): Promise<{ readonly desk: IssueDesk; readonly changes: readonly OpenedKeyring[] }> {
  let current = desk;
  for (let tries = 0; tries < TRIES; tries += 1) {
    const standing = await follow(world, current, kit, send);
    current = standing.desk;
    const changes = await kitStep(() => change(current.opened));
    if (changes === null) throw failed('What was chosen no longer applies', 'E_KEYRING_CHANGED');
    if (changes.length === 0) return { desk: current, changes };
    const rings = changes.map((one) => one.ring);
    if (await put(world, current.held.school, rings, standing.next, kit, send)) {
      return { desk: await keep(world, current, changes), changes };
    }
  }
  throw failed('The school’s stream kept changing', 'E_KEYRING_CHANGED');
}
