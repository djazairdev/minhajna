// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's session on the director's device in a demo world (#570, answers 596
// and 597). The first time the page opens, the device makes its agreement pair
// with the world kit, draws the school's space ID, starts the school's keyring
// with itself as the first holder, and keeps all of it in the world's own store
// before anything goes to the relay; of two openings at once the second waits
// for the first. Every opening then opens the keyring on this device, creates
// the school's space on the relay, so a teacher's join finds it, and follows
// the school's keyring stream (keyring-session.ts), which refuses a device a
// holder removed; after a removal, every code not yet scanned under an older
// epoch is issued again, and the page says how many, to print or show them
// again. A held key that no longer reads or opens here says so and starts
// nothing new, since a second keyring would void every code given. Each
// teacher's assignment is worked out from the space; issuing a code or a
// security key, one change at a time in a world and after following the stream,
// records its issue, the keyring's latest epoch and, for a key, a number never
// given before; a code's text, never a key's, is worked out again whenever it
// is shown. The days teachers joined are read from the space in one pass: for
// each current issue, the day of the certificate on the first joined record of
// its channel. Errors carry world-session.ts's codes, E_SCHOOL_KEY for a key
// that no longer reads or opens, E_KEY_REMOVED and E_KEYRING_CHANGED from
// following the stream, E_SCHOOL_WAITING on a device waiting to hold the key
// another device holds (answer 600), which starts nothing, E_NO_SCHOOL_KEY when
// the key is not to be started here (answer 601: D-Issue leaves that choice to
// D-Keys), and E_WORLD when the store kept something else or nothing.

import {
  assignmentId,
  channelStream,
  eventOf,
  joinCodeText,
  joinedKey,
  keptIssues,
  keptWaiting,
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
  type SchoolIssued,
} from '@minhajna/core';
import { newDevicePair, worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { followSchool } from './keyring-session';
import { inTurn } from './keys-session';
import { PUBLIC_KEY_BYTES, type IssueDesk } from './school-desk';

export { PUBLIC_KEY_BYTES, type IssueDesk } from './school-desk';

type IssueWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The openings on their way, by world, so a second waits for the first. */
const going = new Map<string, Promise<HeldDesk>>();

/** The desk as the page opens it, with how many codes were just issued again under the latest epoch. */
export interface HeldDesk extends IssueDesk {
  readonly reissued: number;
}

/** Holds the school's key on this device, starting it first when `start`, and answers the desk to issue from. */
export async function holdSchool(
  world: IssueWorld,
  kit: WorldKit,
  send: Send = worldRequest,
  start = true,
): Promise<HeldDesk> {
  const asked = `${world.world}:${start}`;
  const before = going.get(asked);
  if (before !== undefined) return before;
  const holding = inTurn(world.world, () => holdOnce(world, kit, send, start));
  going.set(asked, holding);
  try {
    return await holding;
  } finally {
    going.delete(asked);
  }
}

async function holdOnce(world: IssueWorld, kit: WorldKit, send: Send, start: boolean): Promise<HeldDesk> {
  if (!world.book.entries.some((entry) => eventOf(entry)?.kind === 'school.held')) {
    if (keptWaiting(world.book.entries, PUBLIC_KEY_BYTES) !== null) {
      throw failed('This device waits to hold the key another device holds', 'E_SCHOOL_WAITING');
    }
    if (!start) throw failed('This device holds no school key yet', 'E_NO_SCHOOL_KEY');
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
  const desk = (await followSchool(world, { held, opened, crypto }, kit, send)).desk;
  return { ...desk, reissued: await issueStaleAgain(world, desk, kit, send) };
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

/**
 * Issues the next code, or a security key, for an assignment, one change at a
 * time in a world, after following the school's stream, so it is made under
 * the latest epoch, and codes made under an older one issued again first;
 * the issue as the store keeps it, the desk followed, and how many codes
 * were issued again.
 */
export function issueFor(
  world: IssueWorld,
  desk: IssueDesk,
  assignment: string,
  access: 'phone' | 'key',
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<{ readonly kept: KeptIssue; readonly desk: IssueDesk; readonly reissued: number }> {
  return inTurn(world.world, async () => {
    const followed = (await followSchool(world, desk, kit, send)).desk;
    const reissued = await issueStaleAgain(world, followed, kit, send);
    return { kept: await issueOnce(world, followed, assignment, access, kit), desk: followed, reissued };
  });
}

/**
 * Issues again every code not yet scanned that was made under an epoch older
 * than the latest, since a device removed since, or an old recovery's parts
 * that were renewed, hold that epoch's key and could work out its channel's
 * (school-join.ts), and answers how many; a security key is left as it is,
 * since its number is on the key itself.
 */
async function issueStaleAgain(world: IssueWorld, desk: IssueDesk, kit: WorldKit, send: Send): Promise<number> {
  const latest = latestEpoch(desk.opened);
  const issues = keptIssues(world.book.entries, desk.held.school).values();
  const stale = [...issues].filter((one) => one.access === 'phone' && one.epoch < latest);
  if (stale.length === 0) return 0;
  const days = await joinedDays(world.world, desk, stale, kit, send);
  const again = stale.filter((one) => !days.has(joinedKey(one.assignment, one.issue)));
  for (const one of again) await issueOnce(world, desk, one.assignment, 'phone', kit);
  return again.length;
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

/** The text of a security key issue's joining code, which only the key's session carries (#572, answer 602). */
export async function keyCodeText(world: string, desk: IssueDesk, issue: SchoolIssued): Promise<string> {
  if (issue.access !== 'key') throw new RangeError('A code issue’s text is shown, not kept in a key');
  return joinCodeText(await joinCode(world, desk, issue));
}

/** An issue's joining code, whose channel a teacher's join, by phone or by key (#572), writes to. */
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
