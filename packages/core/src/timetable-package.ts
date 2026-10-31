// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each teacher's part of the school's timetable (#577, #578, PRD §7.4, §7.5,
// answers 605 and 606): a signed record on that teacher's own channel in the
// school's space. A part names its world, its school by the space and the
// school's name, the assignment and issue of the code it is sent on, the
// teacher as the timetable names them, its version, the master timetable's,
// which only grows, the first day it applies, and whether it applies on that
// day only; then the teacher's sessions (timetable-sessions.ts), and the
// school's bell times when it has them. It holds staff data only, never a
// pupil's, its names without format marks or other hidden characters, and is no
// longer than its channel carries. The signature is the platform's ECDSA P-256,
// as a signed week's, over the part's canonical JSON behind a line naming the
// format, the world and the certificate's subject, key and serial
// (timetable-record.ts). A part is sealed with the channel's key, after
// whatever the channel holds, so it is read by the school's key holders, the
// teacher, and whoever else saw the joining code. Reading keeps the channel's
// parts whose certificate is the world CA's, whose signature checks, whose IDs
// are its sessions', which names the code's world, school, assignment and
// issue, which the device that joined on the channel did not sign, and whose
// version is higher than every earlier part its key signed there, so an old
// part sent again changes nothing; anything else is left out. The standing part
// is the latest of them not for one day, not the highest version, so the
// director's next sending always replaces what came before. In the demo the CA
// certifies any device a request names (answer 564), so anyone holding the
// channel's key can have a key certified and write a part that holds until the
// next sending; the state's CA will bind the key to the school.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { isDay, type Day } from './day.ts';
import type { JoinCode } from './school-join.ts';
import { ID, SCHOOL } from './school-key-shape.ts';
import { asciiJson, openRecords, sealRecord } from './sealed-stream.ts';
import type { BellTimes } from './timetable-fet.ts';
import {
  DAY_MINUTES,
  named,
  placeOfCode,
  record,
  signedLine,
  signedRecord,
  whole,
  type TimetableCa,
} from './timetable-record.ts';
import { isPartSession, sessionId, type PartSession } from './timetable-sessions.ts';
import { isWorldId } from './world-code.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a part's record and signed text carry. */
export const TIMETABLE_PART_FORMAT = 'minhajna/timetable-part/1';
/** The most batches a record may take on a teacher's channel. */
export const PART_BATCHES = 24;
const MOST_SESSIONS = 120;
const MOST_BELLS = 16;
/** The most a part's text may take as its record carries it, escaped, leaving room for the certificate. */
export const PART_ASCII_MOST = 80_000;

/** A teacher's part of the school's timetable. */
export interface TimetablePart {
  readonly world: string;
  readonly school: string;
  readonly schoolName: string;
  readonly assignment: string;
  readonly issue: number;
  readonly teacher: string;
  readonly version: number;
  readonly from: Day;
  /** Whether the part applies on its first day only, the standing part applying again after it. */
  readonly once: boolean;
  readonly sessions: readonly PartSession[];
  readonly bells: BellTimes;
}

/** A part as its channel carries it: the signed text, its signature and the certificate of the key that signed. */
export interface SignedPart {
  readonly part: TimetablePart;
  readonly text: string;
  readonly signature: string;
  readonly certificate: Certificate;
}

/** Whether a value is a teacher's part, its fields only, each of its shape. */
export function isTimetablePart(value: unknown): value is TimetablePart {
  if (!record(value)) return false;
  const { world, school, schoolName, assignment, issue, teacher, version, from, once, sessions, bells, ...rest } =
    value;
  if (Object.keys(rest).length > 0 || !isWorldId(world) || typeof school !== 'string' || !SCHOOL.test(school))
    return false;
  if (!named(schoolName) || typeof assignment !== 'string' || !ID.test(assignment) || !named(teacher)) return false;
  if (!whole(issue, 1, 999_999_999) || !whole(version, 1, 999_999_999) || typeof from !== 'string' || !isDay(from)) {
    return false;
  }
  if (typeof once !== 'boolean') return false;
  if (!Array.isArray(sessions) || sessions.length > MOST_SESSIONS || !sessions.every(isPartSession)) return false;
  if (new Set(sessions.map((one: PartSession) => one.id)).size !== sessions.length) return false;
  if (!Array.isArray(bells) || bells.length > MOST_BELLS) return false;
  const bell = (one: unknown) =>
    Array.isArray(one) &&
    one.length === 2 &&
    whole(one[0], 0, DAY_MINUTES) &&
    whole(one[1], 0, DAY_MINUTES) &&
    one[0] < one[1];
  return bells.every(bell) && asciiJson(canonicalJson(value)).length <= PART_ASCII_MOST;
}

/** A part signed on the director's device with the key its certificate names. */
export async function signPart(part: TimetablePart, certificate: Certificate, signer: KeySigner): Promise<SignedPart> {
  if (!isTimetablePart(part)) throw new RangeError('Not a teacher’s part');
  if (certificate.publicKey !== signer.publicKey) throw new RangeError('The certificate is for another key');
  if (certificate.world !== part.world) throw new RangeError('The certificate is of another world');
  const text = canonicalJson(part);
  return {
    part,
    text,
    signature: await signer.sign(signedLine(TIMETABLE_PART_FORMAT, certificate, text)),
    certificate,
  };
}

/** Whether a record names a code's own channel: its world, school, assignment and issue. */
export const onChannel = (
  value: { readonly world: string; readonly school: string; readonly assignment: string; readonly issue: number },
  code: JoinCode,
) =>
  value.world === code.world &&
  value.school === code.school &&
  value.assignment === code.assignment &&
  value.issue === code.issue;

/** A signed part's batches on its code's channel, numbered from `first`, the stream's next number. */
export async function sealPart(
  code: JoinCode,
  signed: SignedPart,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { part, text, signature, certificate } = signed;
  if (!onChannel(part, code)) throw new RangeError('A part goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const value = { format: TIMETABLE_PART_FORMAT, text, signature, certificate };
  return { stream: place.stream, batches: await sealRecord(place, value, first, PART_BATCHES, cipher) };
}

async function checked(
  value: unknown,
  code: JoinCode,
  ca: TimetableCa,
  joined: string | null,
  mac: WorldMac,
): Promise<SignedPart | null> {
  const read = await signedRecord(value, TIMETABLE_PART_FORMAT, isTimetablePart, code.world, ca);
  if (read === null || !onChannel(read.value, code) || read.certificate.subject === joined) return null;
  for (const one of read.value.sessions) {
    if ((await sessionId(read.value.school, { ...one, row: 0, teacher: '' }, mac)) !== one.id) return null;
  }
  return { part: read.value, text: read.text, signature: read.signature, certificate: read.certificate };
}

/**
 * Every part on a code's channel that checks, in the channel's order, each of
 * a version higher than every earlier part its key signed there, so an old
 * part sent again is left out. `joined` is the device that joined on the
 * channel, whose own parts are left out, or null when none has.
 */
export async function channelParts(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: string | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<SignedPart[]> {
  const found: SignedPart[] = [];
  const highest = new Map<string, number>();
  for (const value of await openRecords(await placeOfCode(code, mac), batches, PART_BATCHES, cipher)) {
    const one = await checked(value, code, ca, joined, mac);
    const key = one?.certificate.publicKey ?? '';
    if (one === null || one.part.version <= (highest.get(key) ?? 0)) continue;
    highest.set(key, one.part.version);
    found.push(one);
  }
  return found;
}

/**
 * The standing part a code's channel holds for its teacher: the latest that
 * checks and is not for one day, even before its first day, or null; the part
 * for a given day is `partOn`'s.
 */
export async function readPart(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: string | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<SignedPart | null> {
  const parts = await channelParts(code, batches, ca, joined, cipher, mac);
  return parts.reverse().find((one) => !one.part.once) ?? null;
}
