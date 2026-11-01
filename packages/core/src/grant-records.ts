// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a device holding the school key keeps when it makes an inspector's grant
// (#593, answer 621). Each signed week the grant names is archived in the
// school's space under that week's own key (grants.ts), on a stream named from
// it, so only the school's holders and the grant's inspector find or open it:
// every version of the week the device read, as read, oldest first, all signed
// by one device, and the director's visas on them, each once, a snapshot as the
// week stood the day the grant was made. It is read back only whole: every
// version of that course's week, certified by the world's CA, each version
// once, all signed by one device, and every visa certified, once and on one of
// those versions; anything else, and the archive is not read, the first that
// reads winning. The school's record of each grant, with the request it answers
// and the inspector's label, goes on a stream named from the key for grant
// records in its epoch, which only the holders derive; each grant counts once.
// The grant itself reaches the inspector's device through the directorate's
// space, sealed for that device and bound to the request, on a stream named
// from its public key, which only the inspector's device opens. The request's
// ID stays in clear so the directorate sees the school's answer, but anyone who
// saw the request's ID, the server too, can post a relay for it, so a relay is
// the school's claim, not proof, as a grant is to the inspector (grants.ts).

import type { SealedBatch } from './batches.ts';
import { checkSignedWeek, type SignedWeek } from './certify.ts';
import type { Day } from './day.ts';
import { isGrant, type Grant } from './grants.ts';
import { ascii, fromHex, ID, type Holder, type KeyCrypto } from './school-key-shape.ts';
import { purposeKey, type OpenedKeyring } from './school-key.ts';
import { asciiJson, openRecords, parsedAscii, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { clean, named, NAME_MOST, record, signedRecord } from './timetable-record.ts';
import type { SignedTimetable, TimetableCa } from './timetable-record.ts';
import { readWeekRecord, WEEK_BATCHES, type WeekVersion } from './week-record.ts';
import { isWeekVisa, WEEK_VISA_FORMAT, type WeekVisa } from './week-visa.ts';
import { fromBase64Url, toBase64Url, type WorldCipher, type WorldMac } from './world-keys.ts';

export const GRANTED_WEEK = 'minhajna/granted-week/1';
export const GRANT_MADE = 'minhajna/grant-made/1';
export const GRANT_RELAY = 'minhajna/grant-relay/1';
/** The most batches an archived week may take: several versions and their visas. */
export const GRANTED_WEEK_BATCHES = 4 * WEEK_BATCHES;
/** The most batches the school's record of a grant, or its relay, may take. */
export const GRANT_RECORD_BATCHES = 64;

/** A signed week as it is archived for a grant, its versions and visas as signed. */
export interface GrantedWeek {
  readonly format: typeof GRANTED_WEEK;
  readonly course: string;
  readonly week: Day;
  readonly versions: readonly SignedWeek[];
  readonly visas: readonly SignedWeek[];
}

/** An archived week read back: its versions oldest first, and the visas on them. */
export interface OpenedWeek {
  readonly versions: readonly WeekVersion[];
  readonly visas: readonly SignedTimetable<WeekVisa>[];
}

/** The school's record of a grant it made. */
export interface GrantMade {
  readonly format: typeof GRANT_MADE;
  /** The request it answers. */
  readonly request: string;
  readonly label: string;
  readonly grant: Grant;
}

/** A grant on its way to the inspector's device, sealed for it, in base64url. */
export interface GrantRelay {
  readonly format: typeof GRANT_RELAY;
  readonly request: string;
  readonly sealed: string;
}

const signedOf = ({ text, signature, certificate }: SignedWeek): SignedWeek => ({ text, signature, certificate });

/** Where a granted week is archived, from the key its grant shares. */
export const grantedWeekPlace = (key: Uint8Array, mac: WorldMac): Promise<Place> => placeOf(key, 'granted-week', mac);

/** A course's week as it is archived: every version read, oldest first, and the visas on its versions. */
export function grantedWeek(
  latest: WeekVersion & { readonly earlier: readonly WeekVersion[] },
  visas: readonly SignedTimetable<WeekVisa>[],
): GrantedWeek {
  const { course, week } = latest.week;
  const versions = [...latest.earlier, latest];
  const signers = new Set(versions.map((one) => one.signed.certificate.subject));
  if (versions.some((one) => one.week.course !== course || one.week.week !== week) || signers.size !== 1) {
    throw new RangeError('An archived week holds one course’s week, signed by one device');
  }
  const numbers = new Set(versions.map((one) => one.week.version));
  const seen = new Set<string>();
  const on = visas.filter((one) => {
    const fits = one.value.course === course && one.value.week === week && numbers.has(one.value.version);
    if (!fits || seen.has(one.signature)) return false;
    seen.add(one.signature);
    return true;
  });
  return {
    format: GRANTED_WEEK,
    course,
    week,
    versions: versions.map((one) => signedOf(one.signed)),
    visas: on.map(signedOf),
  };
}

/** An archived week's batches, numbered from `first`. */
export const sealGrantedWeek = (place: Place, archived: GrantedWeek, first: number, cipher: WorldCipher) =>
  sealRecord(place, archived, first, GRANTED_WEEK_BATCHES, cipher);

/** The archived week of a course, as its world's CA certified it, or null when none reads. */
export async function openGrantedWeek(
  place: Place,
  batches: readonly SealedBatch[],
  course: string,
  week: Day,
  world: string,
  ca: TimetableCa,
  cipher: WorldCipher,
): Promise<OpenedWeek | null> {
  for (const value of await openRecords(place, batches, GRANTED_WEEK_BATCHES, cipher)) {
    if (!record(value) || value['format'] !== GRANTED_WEEK || Object.keys(value).length !== 5) continue;
    if (value['course'] !== course || value['week'] !== week) continue;
    const { versions, visas } = value;
    if (!Array.isArray(versions) || !Array.isArray(visas)) continue;
    const found = new Map<number, WeekVersion>();
    for (const one of versions as unknown[]) {
      const signed = await checkSignedWeek(one, world, ca.key, ca.checker);
      const read = typeof signed === 'string' ? null : readWeekRecord(signed.text);
      if (typeof signed === 'string' || read?.course !== course || read.week !== week || found.has(read.version)) {
        found.clear();
        break;
      }
      found.set(read.version, { week: read, signed: signedOf(signed) });
    }
    const kept = [...found.values()].sort((a, b) => a.week.version - b.week.version);
    const signers = new Set(kept.map((one) => one.signed.certificate.subject));
    if (kept.length === 0 || kept.length !== versions.length || signers.size !== 1) continue;
    const numbers = new Set(kept.map((one) => one.week.version));
    const read: SignedTimetable<WeekVisa>[] = [];
    const seen = new Set<string>();
    for (const one of visas as unknown[]) {
      const visa = record(one)
        ? await signedRecord({ ...one, format: WEEK_VISA_FORMAT }, WEEK_VISA_FORMAT, isWeekVisa, world, ca)
        : null;
      if (visa?.value.course !== course || visa.value.week !== week || !numbers.has(visa.value.version)) break;
      if (seen.has(visa.signature)) break;
      seen.add(visa.signature);
      read.push(visa);
    }
    if (read.length !== visas.length) continue;
    return { versions: kept, visas: read };
  }
  return null;
}

/** Where the school keeps its records of the grants it made, in one epoch. */
export const grantRecordPlace = async (opened: OpenedKeyring, epoch: number, crypto: KeyCrypto, mac: WorldMac) =>
  placeOf(await purposeKey(opened, epoch, 'grant-record', crypto), 'grants', mac);

const label = (value: unknown): value is string => named(value, false, NAME_MOST) && clean(value) === value;

/** The school's record of a grant, or null when it does not read. */
export function readGrantMade(value: unknown, publicKeyBytes: number): GrantMade | null {
  if (!record(value)) return null;
  const { format, request, label: named, grant, ...rest } = value;
  if (Object.keys(rest).length > 0 || format !== GRANT_MADE || typeof request !== 'string' || !ID.test(request)) {
    return null;
  }
  return label(named) && isGrant(grant, publicKeyBytes) ? { format, request, label: named, grant } : null;
}

/** The school's record of a grant it made. */
export function grantMade(request: string, name: string, grant: Grant, publicKeyBytes: number): GrantMade {
  const made: GrantMade = { format: GRANT_MADE, request, label: name, grant };
  if (readGrantMade(made, publicKeyBytes) === null) throw new RangeError('Not a grant record');
  return made;
}

/** The grants a school made, each once, in the order they were recorded. */
export function grantsMade(records: readonly unknown[], school: string, publicKeyBytes: number): GrantMade[] {
  const found = new Map<string, GrantMade>();
  for (const one of records) {
    const read = readGrantMade(one, publicKeyBytes);
    if (read?.grant.school === school && !found.has(read.grant.id)) found.set(read.grant.id, read);
  }
  return [...found.values()];
}

/** Where a directorate's space keeps the grants on their way to one inspector's device. */
export const relayPlace = (inspector: Holder, mac: WorldMac): Promise<Place> =>
  placeOf(fromHex(inspector.publicKey), 'grant-relay', mac);

const relayInfo = (request: string) => `${GRANT_RELAY}\n${request}`;

/** A grant sealed for its inspector's device, bound to the request it answers. */
export async function relayGrant(request: string, grant: Grant, crypto: Pick<KeyCrypto, 'seal'>): Promise<GrantRelay> {
  if (!ID.test(request)) throw new RangeError('A grant answers a request');
  const sealed = await crypto.seal(ascii(asciiJson(grant)), fromHex(grant.inspector.publicKey), relayInfo(request));
  return { format: GRANT_RELAY, request, sealed: toBase64Url(sealed) };
}

function readRelay(value: unknown): GrantRelay | null {
  if (!record(value) || Object.keys(value).length !== 3 || value['format'] !== GRANT_RELAY) return null;
  const { request, sealed } = value;
  return typeof request === 'string' && ID.test(request) && typeof sealed === 'string'
    ? { format: GRANT_RELAY, request, sealed }
    : null;
}

/** The requests a relay claims the school answered, as the directorate sees them in its space: a claim, not proof. */
export const relayedRequests = (records: readonly unknown[]): ReadonlySet<string> =>
  new Set(records.flatMap((one) => readRelay(one)?.request ?? []));

/** The grants relayed to this inspector's device, each once, with the request each answers. */
export async function openRelayed(
  records: readonly unknown[],
  inspector: Holder,
  crypto: Pick<KeyCrypto, 'open' | 'publicKeyBytes'>,
): Promise<{ readonly request: string; readonly grant: Grant }[]> {
  const found = new Map<string, { readonly request: string; readonly grant: Grant }>();
  for (const one of records) {
    const relay = readRelay(one);
    const bytes = relay === null ? null : fromBase64Url(relay.sealed);
    const plain = relay === null || bytes === null ? null : await crypto.open(bytes, relayInfo(relay.request));
    const grant = plain === null ? null : parsedAscii(plain);
    if (relay === null || !isGrant(grant, crypto.publicKeyBytes) || found.has(grant.id)) continue;
    if (grant.inspector.id === inspector.id && grant.inspector.publicKey === inspector.publicKey) {
      found.set(grant.id, { request: relay.request, grant });
    }
  }
  return [...found.values()];
}
