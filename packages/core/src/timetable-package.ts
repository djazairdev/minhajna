// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each teacher's part of the school's timetable (#577, PRD §7.4, §7.5, answer
// 605): a signed record on that teacher's own channel in the school's space. A
// part names its world, its school by the space and the school's name, the
// assignment and issue of the code it is sent on, the teacher as the timetable
// names them, its version, one more than the highest its signing key put on the
// channel, so nothing another key puts there can block it, and the first day it
// applies; then the teacher's sessions, and the school's bell times when it has
// them. It holds staff data only, never a pupil's, its names without format
// marks or other hidden characters, and is no longer than its channel carries.
// A session's ID is worked out from the school's space and its class, group,
// subject, day, times and week, compared as the timetable compares names, so an
// unchanged session keeps its ID across versions, a moved one gets a new one,
// and a room change or a reassignment keeps it. The signature is the platform's
// ECDSA P-256, as a signed week's, over the part's canonical JSON behind a line
// naming the format, the world and the certificate's subject, key and serial. A
// part is sealed with the channel's key, after whatever the channel holds, so
// it is read by the school's key holders, the teacher, and whoever else saw the
// joining code. Reading keeps the latest of the channel's parts whose
// certificate is the world CA's, whose signature checks, whose IDs are its
// sessions', which names the code's world, school, assignment and issue, which
// the device that joined on the channel did not sign, and whose version is
// higher than every earlier part its key signed there, so an old part sent
// again changes nothing; anything else is left out. The latest wins, not the
// highest version, so the director's next sending always replaces what came
// before. In the demo the CA certifies any device a request names (answer 564),
// so anyone holding the channel's key can have a key certified and write a part
// that holds until the next sending; the state's CA will bind the key to the
// school.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { checkCertificate, isCertificate, type Certificate, type KeyChecker, type KeySigner } from './certify.ts';
import { isDay, type Day, type Weekday } from './day.ts';
import { toHex } from './id.ts';
import { channelSealing, channelStream, type JoinCode } from './school-join.ts';
import { ascii, ID, SCHOOL } from './school-key-shape.ts';
import { asciiJson, openRecords, sealRecord, type Place } from './sealed-stream.ts';
import type { BellTimes } from './timetable-fet.ts';
import { timetableNameKey, type ImportedSession, type TimetableWeek } from './timetable-import.ts';
import { isWorldId } from './world-code.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a part's record and signed text carry. */
export const TIMETABLE_PART_FORMAT = 'minhajna/timetable-part/1';
/** The most batches a part may take on its channel. */
export const PART_BATCHES = 24;
const MOST_SESSIONS = 120;
const MOST_BELLS = 16;
const NAME_MOST = 80;
/** The most a part's text may take as its record carries it, escaped, leaving room for the certificate. */
export const PART_ASCII_MOST = 80_000;
/** Characters a name may not hold: controls, format and direction marks, lone surrogates and line breaks. */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const DAY_MINUTES = 24 * 60;

/** A session of a teacher's part, with its stable ID. */
export interface PartSession {
  readonly id: string;
  readonly class: string;
  /** Empty for the whole class. */
  readonly group: string;
  readonly subject: string;
  readonly day: Weekday;
  /** Minutes from midnight. */
  readonly start: number;
  readonly end: number;
  /** Empty when the timetable gives none. */
  readonly room: string;
  readonly week: TimetableWeek;
}

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

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const named = (value: unknown, empty = false): value is string =>
  typeof value === 'string' && value.length <= NAME_MOST && (empty || value.trim() !== '') && !HIDDEN.test(value);
/** A name as a part carries it: format marks dropped, as the timetable's name key drops them, breaks as spaces. */
const clean = (name: string) =>
  name
    .replace(/[\p{Cf}\p{Cs}]/gu, '')
    .replace(/[\p{Zl}\p{Zp}\p{Cc}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
const whole = (value: unknown, least: number, most: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= least && (value as number) <= most;

function isSession(value: unknown): value is PartSession {
  if (!record(value)) return false;
  const { id, class: of, group, subject, day, start, end, room, week, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof id !== 'string' || !ID.test(id)) return false;
  if (!named(of) || !named(group, true) || !named(subject) || !named(room, true) || !whole(day, 0, 6)) return false;
  return (
    whole(start, 0, DAY_MINUTES) &&
    whole(end, 0, DAY_MINUTES) &&
    start < end &&
    ['both', 'A', 'B'].includes(week as string)
  );
}

/** Whether a value is a teacher's part, its fields only, each of its shape. */
export function isTimetablePart(value: unknown): value is TimetablePart {
  if (!record(value)) return false;
  const { world, school, schoolName, assignment, issue, teacher, version, from, sessions, bells, ...rest } = value;
  if (Object.keys(rest).length > 0 || !isWorldId(world) || typeof school !== 'string' || !SCHOOL.test(school))
    return false;
  if (!named(schoolName) || typeof assignment !== 'string' || !ID.test(assignment) || !named(teacher)) return false;
  if (!whole(issue, 1, 999_999_999) || !whole(version, 1, 999_999_999) || typeof from !== 'string' || !isDay(from)) {
    return false;
  }
  if (!Array.isArray(sessions) || sessions.length > MOST_SESSIONS || !sessions.every(isSession)) return false;
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

/** A session's ID in a school: worked out from the school's space and what makes it the same session. */
export async function sessionId(school: string, session: ImportedSession, mac: WorldMac): Promise<string> {
  const { day, start, end, week } = session;
  const parts = [session.class, session.group, session.subject].map(timetableNameKey);
  const made = await mac(
    ascii(school),
    ascii(asciiJson(['minhajna/timetable/session', ...parts, day, start, end, week])),
  );
  return toHex(made.subarray(0, 16));
}

/** The timetable's teachers, each under the first spelling of their name, with their sessions in the order read. */
export function teachersOf(sessions: readonly ImportedSession[]): ReadonlyMap<string, readonly ImportedSession[]> {
  const found = new Map<string, { name: string; sessions: ImportedSession[] }>();
  for (const one of sessions) {
    const at = timetableNameKey(one.teacher);
    const kept = found.get(at) ?? { name: clean(one.teacher), sessions: [] };
    kept.sessions.push(one);
    found.set(at, kept);
  }
  return new Map([...found.values()].map(({ name, sessions: theirs }) => [name, theirs]));
}

/**
 * A teacher's sessions as their part carries them, with their IDs and their names without hidden characters, by day,
 * then start, class, group and week as the timetable compares names, then ID. Sessions that differ only in their room
 * are one session, the first kept.
 */
export async function partSessions(
  school: string,
  sessions: readonly ImportedSession[],
  mac: WorldMac,
): Promise<PartSession[]> {
  const made: PartSession[] = [];
  for (const one of sessions) {
    const { group, subject, day, start, end, room, week } = one;
    const names = { class: clean(one.class), group: clean(group), subject: clean(subject), room: clean(room) };
    made.push({ id: await sessionId(school, { ...one, ...names }, mac), ...names, day, start, end, week });
  }
  const seen = new Set<string>();
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const by = (one: PartSession) => [one.class, one.group].map(timetableNameKey).concat(one.week, one.id);
  return made
    .filter((one) => !seen.has(one.id) && Boolean(seen.add(one.id)))
    .sort(
      (a, b) => a.day - b.day || a.start - b.start || by(a).reduce((was, one, at) => was || order(one, by(b)[at]!), 0),
    );
}

function partText(certificate: Certificate, text: string): string {
  const { world, subject, publicKey, serial } = certificate;
  return `${TIMETABLE_PART_FORMAT}\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
}

/** A part signed on the director's device with the key its certificate names. */
export async function signPart(part: TimetablePart, certificate: Certificate, signer: KeySigner): Promise<SignedPart> {
  if (!isTimetablePart(part)) throw new RangeError('Not a teacher’s part');
  if (certificate.publicKey !== signer.publicKey) throw new RangeError('The certificate is for another key');
  if (certificate.world !== part.world) throw new RangeError('The certificate is of another world');
  const text = canonicalJson(part);
  return { part, text, signature: await signer.sign(partText(certificate, text)), certificate };
}

async function placeOfCode(code: JoinCode, mac: WorldMac): Promise<Place> {
  return { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
}

/** A signed part's batches on its code's channel, numbered from `first`, the stream's next number. */
export async function sealPart(
  code: JoinCode,
  signed: SignedPart,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { part, text, signature, certificate } = signed;
  const ours = part.world === code.world && part.school === code.school && part.assignment === code.assignment;
  if (!ours || part.issue !== code.issue) throw new RangeError('A part goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const value = { format: TIMETABLE_PART_FORMAT, text, signature, certificate };
  return { stream: place.stream, batches: await sealRecord(place, value, first, PART_BATCHES, cipher) };
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function checked(
  value: unknown,
  code: JoinCode,
  ca: { readonly key: string; readonly checker: KeyChecker },
  joined: string | null,
  mac: WorldMac,
): Promise<SignedPart | null> {
  if (!record(value) || value.format !== TIMETABLE_PART_FORMAT) return null;
  const { text, signature, certificate } = value;
  if (typeof text !== 'string' || typeof signature !== 'string' || !isCertificate(certificate)) return null;
  const part = parsed(text);
  if (!isTimetablePart(part) || canonicalJson(part) !== text) return null;
  const ours = part.world === code.world && part.school === code.school && part.assignment === code.assignment;
  if (!ours || part.issue !== code.issue || certificate.subject === joined) return null;
  for (const one of part.sessions) {
    if ((await sessionId(part.school, { ...one, row: 0, teacher: '' }, mac)) !== one.id) return null;
  }
  if (!(await checkCertificate(certificate, code.world, ca.key, ca.checker))) return null;
  const signed = await ca.checker
    .verify(certificate.publicKey, partText(certificate, text), signature)
    .catch(() => false);
  return signed ? { part, text, signature, certificate } : null;
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
  ca: { readonly key: string; readonly checker: KeyChecker },
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

/** The part a code's channel holds for its teacher: the latest that checks, whatever its version, or null. */
export async function readPart(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: { readonly key: string; readonly checker: KeyChecker },
  joined: string | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<SignedPart | null> {
  return (await channelParts(code, batches, ca, joined, cipher, mac)).at(-1) ?? null;
}
