// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What sending a teacher their part of the timetable needs on the director's
// device in a demo world (#577, #578, answers 605 and 606), apart from drafting
// and publishing a version (version-session.ts). The school's staff list is
// keyed by the timetable's name key, under either spelling of each name, and a
// timetable's teachers are matched to it, both spellings of one teacher
// counting as one; a name two of the staff list share matches no one, so no
// part goes to the wrong teacher. The device's signing key is made the first
// time it sends in a world, certified by the world's CA for the device's own
// ID, and kept in memory only, for the last world it sent in, so a reload makes
// a new one. A part goes on its code's channel at the next number, its version
// the master version, refused when this key already put one there at that
// version or a later one, so a version's number always comes from the world's
// store; the channel is read again after another write came first. A version
// applies from the next Sunday by default (partFrom).

import {
  addDays,
  certificateRequest,
  channelParts,
  channelStream,
  checkCertificate,
  readJoined,
  sealPart,
  signPart,
  teachersOf,
  timetableNameKey,
  toBase64Url,
  weekday,
  type Certificate,
  type Day,
  type DemoSchool,
  type ImportedSession,
  type Joined,
  type KeySigner,
  type SealedBatch,
  type TimetablePart,
} from '@minhajna/core';
import { joinCode, type IssueDesk } from '../director/issue-session';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { spaceBatches } from '../school/space-read';

/** How many times a part is put on its channel before giving up. */
const TRIES = 3;

/** A code's channel as read before a write. */
type ChannelRead = { readonly batches: readonly SealedBatch[]; readonly joined: Joined | null };
type Code = Awaited<ReturnType<typeof joinCode>>;

/** A signing key with its certificate. */
type Signing = { readonly signer: KeySigner; readonly certificate: Certificate };

/** This device's certified signing key, by world and device, in memory only. */
const signing = new Map<string, Promise<Signing>>();

async function certify(world: string, device: string, ca: string, kit: WorldKit, send: Send): Promise<Signing> {
  const pair = await kitStep(() => kit.newPair());
  const signer = { publicKey: pair.spki, sign: (one: string) => kit.sign(pair.pkcs8, one), verify: kit.verify };
  const request = await kitStep(() => certificateRequest(world, device, signer));
  const answer = await send({ method: 'POST', path: `/worlds/${world}/certificates`, body: request });
  const certificate = answer.body as Certificate;
  const holds = answer.status === 201 && (await checkCertificate(certificate, world, ca, kit));
  if (!holds || certificate.subject !== device || certificate.publicKey !== pair.spki) throw unexpected(answer);
  return { signer, certificate };
}

export type { Signing };

/** This device's signing key for a world, certified by its CA the first time and kept in memory only. */
export function signingKey(world: string, desk: IssueDesk, ca: string, kit: WorldKit, send: Send): Promise<Signing> {
  const at = `${world}:${desk.held.device}`;
  for (const one of signing.keys()) if (one !== at) signing.delete(one);
  const kept = signing.get(at) ?? certify(world, desk.held.device, ca, kit, send);
  signing.set(at, kept);
  kept.catch(() => signing.delete(at));
  return kept;
}

/** This device's signing key for a world when it is kept, without certifying one, or null. */
export const keptSigning = (world: string, desk: IssueDesk): Promise<Signing> | null =>
  signing.get(`${world}:${desk.held.device}`) ?? null;

/** The day a part sent on `date` applies from: the next Sunday. */
export const partFrom = (date: Day): Day => addDays(date, 7 - weekday(date));

/** A school's staff list by name key, under either spelling, each key with every teacher it names. */
export function staffByName(
  teachers: Pick<DemoSchool, 'teachers'>['teachers'],
): ReadonlyMap<string, ReadonlySet<string>> {
  const staff = new Map<string, Set<string>>();
  for (const one of teachers) {
    for (const key of [one.name, one.latinName].map(timetableNameKey).filter((name) => name !== '')) {
      staff.set(key, (staff.get(key) ?? new Set()).add(one.id));
    }
  }
  return staff;
}

/**
 * A timetable's sessions by the staff member they name, under the first
 * spelling read; names no one of the staff list has, and names two share,
 * apart.
 */
export function byStaff(sessions: readonly ImportedSession[], staff: ReadonlyMap<string, ReadonlySet<string>>) {
  const matched = new Map<string, { teacher: string; sessions: ImportedSession[] }>();
  const notStaff: string[] = [];
  const twoNames: string[] = [];
  for (const [teacher, theirs] of teachersOf(sessions)) {
    const ids = staff.get(timetableNameKey(teacher)) ?? new Set<string>();
    const [id] = ids;
    if (ids.size > 1) twoNames.push(teacher);
    if (id === undefined) notStaff.push(teacher);
    if (id === undefined || ids.size > 1) continue;
    const kept = matched.get(id) ?? { teacher, sessions: [] };
    kept.sessions.push(...theirs);
    matched.set(id, kept);
  }
  return { matched, notStaff, twoNames };
}

/**
 * Puts a record on its code's channel at the stream's next number, reading the
 * channel again when another write came first: `seal` makes its batches from
 * the channel as read, numbered from `first`, or refuses; none puts nothing.
 */
export async function putOnChannel(
  code: Code,
  ca: string,
  kit: WorldKit,
  send: Send,
  seal: (read: ChannelRead, first: number) => Promise<readonly SealedBatch[]>,
): Promise<void> {
  const stream = await kitStep(() => channelStream(code, kit.mac));
  for (let tries = 0; tries < TRIES; tries += 1) {
    const batches = (await spaceBatches(code.world, code.school, send)).get(stream) ?? [];
    const joined = await kitStep(() => readJoined(code, batches, { key: ca, checker: kit }, kit.cipher, kit.mac));
    const first = batches.reduce((next, one) => Math.max(next, one.number + 1), 0);
    const sealed = await seal({ batches, joined }, first);
    if (sealed.length === 0) return;
    const body = { stream, first, batches: sealed.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `/worlds/${code.world}/spaces/${code.school}/batches`, body });
    if (answer.status === 201) return;
    if (answer.status !== 409) throw unexpected(answer);
  }
  throw failed('Another write kept coming first on the channel', 'E_WORLD_BUSY');
}

/**
 * Puts a part on its code's channel, signed with this device's key at the
 * master version, refused when this key already put one there at that version
 * or a later one.
 */
export const putPart = (code: Code, part: TimetablePart, key: Signing, ca: string, kit: WorldKit, send: Send) =>
  putOnChannel(code, ca, kit, send, async ({ batches, joined }, first) => {
    const checker = { key: ca, checker: kit };
    const parts = await kitStep(() =>
      channelParts(code, batches, checker, joined?.device ?? null, kit.cipher, kit.mac),
    );
    const ours = parts.filter((one) => one.certificate.publicKey === key.certificate.publicKey);
    if (ours.some((one) => one.part.version >= part.version)) {
      throw failed('This key already put a part at this version or a later one', 'E_WORLD');
    }
    const signed = await kitStep(() => signPart(part, key.certificate, key.signer));
    return (await kitStep(() => sealPart(code, signed, first, kit.cipher, kit.mac))).batches;
  });
