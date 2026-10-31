// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's session on the director's device in a demo world (#570, answers
// 596 and 597). The first time the page opens, the device makes its agreement
// pair with the world kit, draws the school's space ID, starts the school's
// keyring with itself as the first holder, and keeps all of it in the world's
// own store before anything goes to the relay; of two openings at once the
// second waits for the first. Every opening then opens the keyring on this
// device and creates the school's space on the relay, so a teacher's join
// finds it. A held key that no longer reads or opens here says so and starts
// nothing new, since a second keyring would void every code given. Each
// teacher's assignment is worked out from the space; issuing a code or a
// security key, one at a time in a world, records its issue, the keyring's
// latest epoch and, for a key, a number never given before; a code's text,
// never a key's, is worked out again whenever it is shown. The days teachers
// joined are read from the space in one pass: for each current issue, the day
// of the certificate on the first joined record of its channel. Errors carry
// world-session.ts's codes, E_SCHOOL_KEY for a key that no longer reads or
// opens, and E_WORLD when the store kept something else or nothing.

import {
  assignmentId,
  channelStream,
  eventOf,
  joinCodeText,
  joinedKey,
  keptIssues,
  keyNumbers,
  latestEpoch,
  latestHeld,
  makeJoinCode,
  newId,
  newKeyNumber,
  newSchoolSpace,
  nextIssue,
  openKeyring,
  readJoined,
  startKeyring,
  type Day,
  type DemoTeacher,
  type KeptIssue,
  type KeyCrypto,
  type OpenedKeyring,
  type SchoolHeld,
  type SchoolIssued,
} from '@minhajna/core';
import { newDevicePair, worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';

/** A P-256 point, uncompressed, as the world kit's agreement gives it. */
const PUBLIC_KEY_BYTES = 65;

type IssueWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The school key as this device holds it: the record kept, the keyring opened, and the device's crypto. */
export interface IssueDesk {
  readonly held: SchoolHeld;
  readonly opened: OpenedKeyring;
  readonly crypto: KeyCrypto;
}

/** The openings on their way, by world, so a second waits for the first. */
const going = new Map<string, Promise<IssueDesk>>();
/** The last issue on its way in each world, so the next waits for it. */
const issuing = new Map<string, Promise<unknown>>();

/** Holds the school's key on this device, starting it the first time, and answers the desk to issue from. */
export async function holdSchool(world: IssueWorld, kit: WorldKit, send: Send = worldRequest): Promise<IssueDesk> {
  const before = going.get(world.world);
  if (before !== undefined) return before;
  const holding = holdOnce(world, kit, send);
  going.set(world.world, holding);
  try {
    return await holding;
  } finally {
    going.delete(world.world);
  }
}

async function holdOnce(world: IssueWorld, kit: WorldKit, send: Send): Promise<IssueDesk> {
  if (!world.book.entries.some((entry) => eventOf(entry)?.kind === 'school.held')) {
    const pair = await kitStep(() => newDevicePair(kit));
    const holder = { id: newId(kit.random), publicKey: pair.publicKey };
    const school = newSchoolSpace(kit.random);
    const started = await kitStep(() => startKeyring(school, holder, worldKeyCrypto(kit, pair), kit.random));
    const held = { school, device: holder.id, publicKey: pair.publicKey, pkcs8: pair.pkcs8, ring: started.ring };
    await world.book.record(world.date, { kind: 'school.held', held });
  }
  const held = latestHeld(world.book.entries, PUBLIC_KEY_BYTES);
  if (held === null) throw failed('The world’s store holds no school key that reads', 'E_SCHOOL_KEY');
  const crypto = worldKeyCrypto(kit, { publicKey: held.publicKey, pkcs8: held.pkcs8 });
  const opened = await kitStep(() => openKeyring(held.ring, held.device, crypto));
  if (typeof opened === 'string') throw failed(`The school key does not open here: ${opened}`, 'E_SCHOOL_KEY');
  const space = await send({
    method: 'PUT',
    path: `/worlds/${world.world}/spaces/${held.school}`,
    body: { kind: 'school' },
  });
  if (space.status !== 200 && space.status !== 201) throw unexpected(space);
  return { held, opened, crypto };
}

/** Each teacher's assignment in the school's space, by the seeded teacher's ID. */
export async function assignmentsOf(
  desk: IssueDesk,
  teachers: readonly DemoTeacher[],
  kit: WorldKit,
): Promise<ReadonlyMap<string, string>> {
  const school = desk.held.school;
  const pairs = await kitStep(() =>
    Promise.all(teachers.map(async (one) => [one.id, await assignmentId(school, one.id, kit.mac)] as const)),
  );
  return new Map(pairs);
}

/** Issues the next code, or a security key, for an assignment, after any issue on its way, as the store keeps it. */
export function issueFor(
  world: IssueWorld,
  desk: IssueDesk,
  assignment: string,
  access: 'phone' | 'key',
  kit: WorldKit,
): Promise<KeptIssue> {
  const next = (issuing.get(world.world) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => issueOnce(world, desk, assignment, access, kit));
  issuing.set(world.world, next);
  return next.finally(() => {
    if (issuing.get(world.world) === next) issuing.delete(world.world);
  });
}

async function issueOnce(
  world: IssueWorld,
  desk: IssueDesk,
  assignment: string,
  access: 'phone' | 'key',
  kit: WorldKit,
): Promise<KeptIssue> {
  const { school } = desk.held;
  const issue = nextIssue(keptIssues(world.book.entries, school), assignment);
  const keyNumber = access === 'key' ? newKeyNumber(kit.random, keyNumbers(world.book.entries, school)) : null;
  const issued = { school, assignment, issue, epoch: latestEpoch(desk.opened), access, keyNumber };
  await world.book.record(world.date, { kind: 'school.issued', issued });
  const kept = keptIssues(world.book.entries, school).get(assignment);
  if (kept?.issue !== issue || kept.access !== access || kept.keyNumber !== keyNumber) {
    throw failed('The world’s store did not keep the code', 'E_WORLD');
  }
  return kept;
}

/** The text of a code issue's joining code, worked out again from the keyring; a security key has none. */
export async function codeText(world: string, desk: IssueDesk, issue: SchoolIssued): Promise<string> {
  if (issue.access !== 'phone') throw new RangeError('A security key has no joining code to show');
  return joinCodeText(await joinCode(world, desk, issue));
}

/** An issue's joining code, whose channel a teacher's join, by phone or later by key (#572), writes to. */
function joinCode(world: string, desk: IssueDesk, issue: SchoolIssued) {
  const { assignment, epoch } = issue;
  return kitStep(() => makeJoinCode(desk.opened, world, assignment, issue.issue, desk.crypto, epoch));
}

/** The day each of these issues was joined on, by `joinedKey`, read from the school's space in one pass. */
export async function joinedDays(
  world: string,
  desk: IssueDesk,
  issues: Iterable<SchoolIssued>,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ReadonlyMap<string, Day>> {
  const ca = await caKey(world, send);
  const batches = await spaceBatches(world, desk.held.school, send);
  const days = new Map<string, Day>();
  for (const issue of issues) {
    const code = await joinCode(world, desk, issue);
    const channel = batches.get(await kitStep(() => channelStream(code, kit.mac)));
    if (channel === undefined) continue;
    const joined = await kitStep(() => readJoined(code, channel, { key: ca, checker: kit }, kit.cipher, kit.mac));
    if (joined !== null) days.set(joinedKey(issue.assignment, issue.issue), joined.certificate.issued);
  }
  return days;
}
