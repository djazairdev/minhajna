// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate's request for an inspector's grant (#593, M-Grant, answer 621),
// which a device holding the school key turns into a grant (answer 562). The
// request names the inspector's device, a label for the inspector, the subject
// by its country code, up to sixteen classes by name, each once as the
// timetable's name key reads it, the signed weeks' range, the day the grant
// ends, on or after the range's last day, and the world's date it was asked on.
// It names no teacher and carries no fingerprint, which reaches the school only
// in the inspectorate's official message (answer 563), and it is not signed,
// since the stand-in CA certifies any device without a role. It goes on a
// stream of the school's space named from the space's ID: one fresh content key
// seals the request, bound to the school and the request's ID, and that key is
// sealed for each holder of the school's latest keyring, so only a holder opens
// it, while anyone reading the stream sees by ID which requests' envelopes
// reached it; the directorate cannot check a keyring's tag, so a forged keyring
// would let whoever forged it read it, which is why it carries no name of a
// person and no secret. A holder opens what is sealed for its device, keeping a
// request only when it reads and names the school and the ID its envelope does,
// each request once. The classes then name the courses whose signed weeks the
// grant opens: each class's course is worked out from the school, its name and
// the subject (week-record.ts), and every signed week of it whose first day
// lies in the range is named once, under the epoch given, in the order of the
// classes and the weeks; the classes with none are said. The directorate keeps
// each request it made as a device event in the world's store.

import type { SealedBatch } from './batches.ts';
import { compareDays, isDay, type Day } from './day.ts';
import type { GrantRequested } from './device-events.ts';
import { eventOf } from './events.ts';
import type { GrantWeek } from './grants.ts';
import type { Entry } from './history.ts';
import type { RandomBytes } from './id.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ascii, fromHex, ID, isHolder, SCHOOL, type Holder, type KeyCrypto } from './school-key-shape.ts';
import { asciiJson, openRecords, parsedAscii, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { timetableNameKey } from './timetable-import.ts';
import { clean, named, NAME_MOST, record } from './timetable-record.ts';
import { courseId } from './week-record.ts';
import { isWorldId } from './world-code.ts';
import { fromBase64Url, toBase64Url, type WorldCipher, type WorldMac } from './world-keys.ts';

export type { GrantRequested } from './device-events.ts';

export const GRANT_REQUEST = 'minhajna/grant-request/1';
export const GRANT_ENVELOPE = 'minhajna/grant-envelope/1';
/** The most batches a request's envelope may take. */
export const GRANT_REQUEST_BATCHES = 8;
export const MOST_GRANT_CLASSES = 16;

export interface GrantRequest {
  readonly format: typeof GRANT_REQUEST;
  readonly id: string;
  readonly world: string;
  /** The school's space. */
  readonly school: string;
  readonly inspector: Holder;
  /** How the inspector is named on the request, such as their subject and district. */
  readonly label: string;
  /** The subject's country code. */
  readonly subject: string;
  readonly classes: readonly string[];
  readonly weeks: { readonly from: Day; readonly to: Day };
  readonly until: Day;
  /** The world's date the directorate asked on. */
  readonly asked: Day;
}

/** A request as it travels: its key sealed for each holder by device ID, and the request sealed, in base64url. */
export interface GrantEnvelope {
  readonly format: typeof GRANT_ENVELOPE;
  readonly school: string;
  readonly id: string;
  readonly sealed: Readonly<Record<string, string>>;
  readonly body: string;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const LABEL_MOST = 80;
/** A class's name as the timetable records it. */
const CLASS_MOST = NAME_MOST;

const day = (value: unknown): value is Day => typeof value === 'string' && isDay(value);
const name = (value: unknown, most: number): value is string => named(value, false, most) && clean(value) === value;

/** A request, or null when it does not read. */
export function readGrantRequest(value: unknown, publicKeyBytes: number): GrantRequest | null {
  if (!record(value)) return null;
  const { format, id, world, school, inspector, label, subject, classes, weeks, until, asked, ...rest } = value;
  if (Object.keys(rest).length > 0 || format !== GRANT_REQUEST || typeof id !== 'string' || !ID.test(id)) return null;
  if (!isWorldId(world) || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  if (!isHolder(inspector, publicKeyBytes) || !name(label, LABEL_MOST)) return null;
  if (typeof subject !== 'string' || !ENTRY_ID.test(subject) || !Array.isArray(classes)) return null;
  const listed = classes as unknown[];
  if (listed.length === 0 || listed.length > MOST_GRANT_CLASSES || !listed.every((one) => name(one, CLASS_MOST))) {
    return null;
  }
  if (new Set(listed.map((one) => timetableNameKey(one))).size !== listed.length) return null;
  if (!record(weeks) || Object.keys(weeks).length !== 2 || !day(weeks['from']) || !day(weeks['to'])) return null;
  const range = { from: weeks['from'], to: weeks['to'] };
  if (!day(until) || !day(asked) || compareDays(range.from, range.to) > 0) return null;
  if (compareDays(range.to, until) > 0 || compareDays(asked, until) > 0) return null;
  const holder = { id: inspector.id, publicKey: inspector.publicKey };
  return {
    format,
    id,
    world,
    school,
    inspector: holder,
    label,
    subject,
    classes: [...listed],
    weeks: range,
    until,
    asked,
  };
}

/** Where a school's space keeps the requests made to it. */
export const requestPlace = (school: string, mac: WorldMac): Promise<Place> =>
  placeOf(ascii(school), 'grant-request', mac);

const info = (school: string, id: string) => `${GRANT_REQUEST}\n${school}\n${id}`;

/** A request sealed for each holder of the school's latest keyring. */
export async function sealGrantRequest(
  request: GrantRequest,
  holders: readonly Holder[],
  crypto: Pick<KeyCrypto, 'seal' | 'publicKeyBytes'>,
  random: RandomBytes,
  cipher: WorldCipher,
): Promise<GrantEnvelope> {
  if (holders.length === 0) throw new RangeError('A request goes to the holders of the school key');
  if (readGrantRequest(request, crypto.publicKeyBytes) === null) throw new RangeError('Not a grant request that reads');
  const bound = info(request.school, request.id);
  const content = random(32);
  const body = toBase64Url(await cipher.seal(content, ascii(asciiJson(request)), ascii(bound)));
  const sealed: Record<string, string> = {};
  for (const holder of holders)
    sealed[holder.id] = toBase64Url(await crypto.seal(content, fromHex(holder.publicKey), bound));
  return { format: GRANT_ENVELOPE, school: request.school, id: request.id, sealed, body };
}

/** An envelope's batches on its school's request stream, numbered from `first`. */
export const sealGrantEnvelope = (place: Place, envelope: GrantEnvelope, first: number, cipher: WorldCipher) =>
  sealRecord(place, envelope, first, GRANT_REQUEST_BATCHES, cipher);

/** The records on a school's request stream, in their order, for the readers below. */
export const openGrantEnvelopes = (place: Place, batches: readonly SealedBatch[], cipher: WorldCipher) =>
  openRecords(place, batches, GRANT_REQUEST_BATCHES, cipher);

function readEnvelope(value: unknown): GrantEnvelope | null {
  if (!record(value)) return null;
  const { format, school, id, sealed, body, ...rest } = value;
  if (Object.keys(rest).length > 0 || format !== GRANT_ENVELOPE || typeof id !== 'string' || !ID.test(id)) return null;
  if (typeof school !== 'string' || !SCHOOL.test(school) || typeof body !== 'string' || !BASE64URL.test(body)) {
    return null;
  }
  if (!record(sealed) || !Object.entries(sealed).every(([key, one]) => ID.test(key) && typeof one === 'string')) {
    return null;
  }
  return { format, school, id, sealed: sealed as Record<string, string>, body };
}

/** The requests made to a school that its holder's device opens, each once, in the order they came. */
export async function openGrantRequests(
  records: readonly unknown[],
  school: string,
  device: string,
  crypto: Pick<KeyCrypto, 'open' | 'publicKeyBytes'>,
  cipher: WorldCipher,
): Promise<GrantRequest[]> {
  const found = new Map<string, GrantRequest>();
  for (const one of records) {
    const envelope = readEnvelope(one);
    const mine = envelope?.sealed[device];
    if (envelope === null || envelope.school !== school || found.has(envelope.id) || mine === undefined) continue;
    const [key, body] = [fromBase64Url(mine), fromBase64Url(envelope.body)];
    if (key === null || body === null) continue;
    const bound = info(school, envelope.id);
    const content = await crypto.open(key, bound);
    const plain = content === null ? null : await cipher.open(content, body, ascii(bound));
    const request = plain === null ? null : readGrantRequest(parsedAscii(plain), crypto.publicKeyBytes);
    if (request?.school === school && request.id === envelope.id) found.set(request.id, request);
  }
  return [...found.values()];
}

/** The requests whose envelopes reached a school's stream, by ID, as anyone who reads the stream sees them. */
export function envelopesFor(records: readonly unknown[], school: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const one of records) {
    const read = readEnvelope(one);
    if (read?.school === school) ids.add(read.id);
  }
  return ids;
}

/** A signed week a holder's device has read, by its course and first day. */
export interface SignedWeekSeen {
  readonly course: string;
  readonly week: Day;
}

/** The signed weeks a request names, under the epoch given, and the classes that name none. */
export async function grantWeeksOf(
  request: GrantRequest,
  signed: readonly SignedWeekSeen[],
  epoch: number,
  mac: WorldMac,
): Promise<{ readonly weeks: GrantWeek[]; readonly missing: string[] }> {
  const weeks: GrantWeek[] = [];
  const missing: string[] = [];
  const within = (week: Day) => compareDays(request.weeks.from, week) <= 0 && compareDays(week, request.weeks.to) <= 0;
  for (const name of request.classes) {
    const course = await courseId(request.school, name, request.subject, mac);
    const days = [...new Set(signed.filter((one) => one.course === course && within(one.week)).map((one) => one.week))];
    if (days.length === 0) missing.push(name);
    for (const week of days.sort(compareDays)) weeks.push({ course, week, epoch });
  }
  return { weeks, missing };
}

/** The requests this store's directorate made, each once, in the order made. */
export function requestsMade(entries: readonly Entry[], publicKeyBytes: number): GrantRequest[] {
  const made = new Map<string, GrantRequest>();
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'grant.requested' ? readGrantRequest(event.requested?.request, publicKeyBytes) : null;
    if (read !== null && !made.has(read.id)) made.set(read.id, read);
  }
  return [...made.values()];
}

/** What the directorate's store keeps of a request it made. */
export const grantRequested = (request: GrantRequest): GrantRequested => ({ request });
