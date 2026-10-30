// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Grants for inspectors (#553, PRD §5.10, §6.5): a device that holds the
// school key shares, with one inspector's device, the keys of the signed
// weeks a grant names, course by course, between its dates (answer 562). Each
// signed week is sealed in the school's archive under a key derived for it
// alone from the epoch's key for signed weeks, so a grant's keys open those
// weeks and nothing else: no other week, no pupil record and no session's
// confirmation status as it syncs. The inspector's public key reaches the
// school through the server, so the director's device grants only when the
// key's fingerprint matches the one the inspector's app shows, which reaches
// the director by a channel Minhajna's server does not carry, such as the
// inspectorate's official message, and which the director types or compares
// on screen, never filled in from the request (answer 563); device signing
// keys (#554) will vouch for it instead. Each key is sealed for the
// inspector's device bound to the grant, its dates, its maker and its week,
// so the server cannot move the dates of a grant the school made or give it
// to another device; until signing keys, the inspector's device cannot tell a
// school's grant from one the server made, so a reading is not evidence. The
// dates are kept by the inspector's app, which takes a key only between them
// by the world's date and deletes the grant after; the inspector's device
// holds the keys, so the dates are a rule of the app, not of the crypto. Each
// key it takes comes with an entry for the teacher's access log and a proof
// under the grant's own log key, which only its inspector's device holds
// besides the school, so the school's devices check each entry against their
// record of the grant and neither the server nor another inspector can forge
// one, though the server can drop it; the teacher's log shows each grant over
// their weeks from the school's space, and each use as the inspector's device
// reported it. What it has read cannot be unread, so a grant names only the
// weeks it needs.

import { compareDays, isDay, type Day } from './day.ts';
import { toHex } from './id.ts';
import { ascii, fromHex, ID, isHolder, sameMac, SCHOOL, type Holder, type KeyCrypto } from './school-key-shape.ts';
import { latestEpoch, purposeKey, type OpenedKeyring } from './school-key.ts';

/** One signed week a grant names: its course, the day it starts, and the epoch it was sealed under. */
export interface GrantWeek {
  readonly course: string;
  readonly week: Day;
  readonly epoch: number;
}

export interface GrantTerms {
  /** The grant's ID, a fresh `newId` for each grant, since its log key comes from it. */
  readonly id: string;
  readonly inspector: Holder;
  /** The fingerprint of the inspector's key, as the inspector's app showed it and the director confirmed it. */
  readonly fingerprint: string;
  /** The signed weeks, each with the epoch the archive sealed it under, as the archive records it. */
  readonly weeks: readonly GrantWeek[];
  readonly from: Day;
  readonly until: Day;
}

export interface Grant extends Omit<GrantTerms, 'weeks' | 'fingerprint'> {
  readonly school: string;
  /** The device that made the grant, which holds the school key. */
  readonly by: string;
  /** Each week's key, sealed for the inspector's device, in hex. */
  readonly weeks: readonly (GrantWeek & { readonly sealed: string })[];
  /** This grant's own key for access log entries, sealed for the inspector's device, under a school key epoch. */
  readonly log: { readonly epoch: number; readonly sealed: string };
}

/** A grant opened on the inspector's device; its keys come only through `useGrant`. */
export interface OpenedGrant {
  readonly grant: Grant;
}

/** What the teacher's access log records each time an inspector takes a week's key. */
export interface GrantUse {
  readonly grant: string;
  readonly inspector: string;
  readonly course: string;
  readonly week: Day;
  readonly epoch: number;
  readonly day: Day;
  /** A MAC of the entry under the grant's log key, which the school's devices check. */
  readonly proof: string;
}

const grantKeys = new WeakMap<
  OpenedGrant,
  { readonly log: Uint8Array; readonly weeks: ReadonlyMap<string, Uint8Array> }
>();

export type GrantProblem = 'not-yet' | 'ended' | 'forged';

const HEX = /^(?:[0-9a-f]{2})+$/u;

const weekName = (course: string, week: Day) => `${course}/${week}`;

/** The key a signed week of a course is sealed under in the school's archive. */
export async function signedWeekKey(
  opened: OpenedKeyring,
  epoch: number,
  course: string,
  week: Day,
  crypto: KeyCrypto,
): Promise<Uint8Array> {
  if (!ID.test(course) || !isDay(week)) throw new RangeError('A signed week is named by its course and first day');
  const weeks = await purposeKey(opened, epoch, 'signed-weeks', crypto);
  return crypto.mac(weeks, ascii(`minhajna/grant/week\n${course}\n${week}`));
}

function grantInfo(school: string, grant: Pick<Grant, 'id' | 'inspector' | 'from' | 'until' | 'by'>, what: string) {
  const { id, inspector, from, until, by } = grant;
  const head = `minhajna/grant/1\n${school}\n${id}\n${inspector.id}\n${inspector.publicKey}\n${by}\n${from}\n${until}`;
  return `${head}\n${what}`;
}

const weekInfo = (week: GrantWeek) => `${week.course}\n${week.week}\n${week.epoch}`;

/** A grant's own key for its access log entries, which every device that holds the school key works out. */
async function logKey(school: OpenedKeyring, epoch: number, grant: string, crypto: KeyCrypto): Promise<Uint8Array> {
  const key = await purposeKey(school, epoch, 'grant-log', crypto);
  return crypto.mac(key, ascii(`minhajna/grant/log\n${grant}`));
}

/** A fingerprint as typed: lower case, without spaces or dashes. */
const plain = (fingerprint: string) => fingerprint.toLowerCase().replace(/[\s-]/gu, '');

function hasOnly(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => keys.includes(field));
}

/** Whether a grant that came through the server has exactly the shape of one. */
export function isGrant(value: unknown, publicKeyBytes: number): value is Grant {
  if (!hasOnly(value, ['school', 'id', 'inspector', 'from', 'until', 'by', 'weeks', 'log'])) return false;
  const { school, id, inspector, from, until, by, weeks, log } = value;
  if (!hasOnly(log, ['epoch', 'sealed']) || typeof log['sealed'] !== 'string' || !HEX.test(log['sealed'])) return false;
  if (typeof log['epoch'] !== 'number' || !Number.isSafeInteger(log['epoch']) || log['epoch'] < 0) return false;
  if (typeof school !== 'string' || !SCHOOL.test(school) || typeof id !== 'string' || !ID.test(id)) return false;
  if (typeof by !== 'string' || !ID.test(by) || !isHolder(inspector, publicKeyBytes)) return false;
  if (typeof from !== 'string' || !isDay(from) || typeof until !== 'string' || !isDay(until)) return false;
  const shaped = (one: unknown) =>
    hasOnly(one, ['course', 'week', 'epoch', 'sealed']) &&
    typeof one['course'] === 'string' &&
    typeof one['week'] === 'string' &&
    typeof one['sealed'] === 'string' &&
    HEX.test(one['sealed']);
  return Array.isArray(weeks) && weeks.every(shaped) && goodWeeks(weeks as GrantWeek[], Infinity);
}

function goodWeeks(weeks: readonly GrantWeek[], epochs: number): boolean {
  const names = new Set(weeks.map((one) => weekName(one.course, one.week)));
  const fine = weeks.every(
    (one) => ID.test(one.course) && isDay(one.week) && Number.isSafeInteger(one.epoch) && one.epoch >= 0,
  );
  return fine && weeks.length > 0 && names.size === weeks.length && weeks.every((one) => one.epoch < epochs);
}

/** The fingerprint of an inspector's key that its app shows and the director confirms: 64 bits in four groups. */
export async function inspectorFingerprint(publicKey: string, crypto: KeyCrypto): Promise<string> {
  const mac = toHex(await crypto.mac(fromHex(publicKey), ascii('minhajna/grant/inspector')));
  return (mac.slice(0, 16).match(/.{4}/gu) ?? []).join('-');
}

/** A grant to one inspector's device, made on a device that holds the school key. */
export async function makeGrant(
  opened: OpenedKeyring,
  terms: GrantTerms,
  by: string,
  crypto: KeyCrypto,
): Promise<Grant> {
  const { id, inspector, weeks, from, until, fingerprint } = terms;
  if (!opened.ring.holders.some((one) => one.id === by)) throw new RangeError('Only a holder of the school key grants');
  if (!ID.test(id) || !isHolder(inspector, crypto.publicKeyBytes)) throw new RangeError('Not a grant to a device');
  if (!isDay(from) || !isDay(until) || compareDays(from, until) > 0)
    throw new RangeError('A grant runs between two days');
  if (!goodWeeks(weeks, opened.keys.length)) throw new RangeError('A grant names each signed week once');
  if (plain(fingerprint) !== plain(await inspectorFingerprint(inspector.publicKey, crypto))) {
    throw new RangeError('The inspector’s key does not match the fingerprint confirmed');
  }
  const head = { id, inspector: { id: inspector.id, publicKey: inspector.publicKey }, from, until, by };
  const school = opened.ring.school;
  const to = fromHex(inspector.publicKey);
  const epoch = latestEpoch(opened);
  const log = await logKey(opened, epoch, id, crypto);
  const logged = { epoch, sealed: toHex(await crypto.seal(log, to, grantInfo(school, head, `log\n${epoch}`))) };
  const sealed = [];
  for (const week of weeks) {
    const key = await signedWeekKey(opened, week.epoch, week.course, week.week, crypto);
    const info = grantInfo(school, head, weekInfo(week));
    const { course, epoch } = week;
    sealed.push({
      course,
      week: week.week,
      epoch,
      sealed: toHex(await crypto.seal(key, to, info)),
    });
  }
  return { school, ...head, weeks: sealed, log: logged };
}

/** Whether a grant has ended by the world's date, after which the inspector's device deletes it. */
export function grantEnded(grant: Pick<Grant, 'until'>, today: Day): boolean {
  return compareDays(today, grant.until) > 0;
}

function dated(grant: Pick<Grant, 'from' | 'until'>, today: Day): GrantProblem | null {
  if (compareDays(today, grant.from) < 0) return 'not-yet';
  return grantEnded(grant, today) ? 'ended' : null;
}

/** Opens a grant on the inspector's device, between its dates by the world's date. */
export async function openGrant(
  grant: unknown,
  today: Day,
  device: string,
  crypto: KeyCrypto,
): Promise<OpenedGrant | GrantProblem> {
  if (!isGrant(grant, crypto.publicKeyBytes) || grant.inspector.id !== device) return 'forged';
  const problem = dated(grant, today);
  if (problem !== null) return problem;
  const open = async (sealed: string, what: string) => {
    try {
      return await crypto.open(fromHex(sealed), grantInfo(grant.school, grant, what));
    } catch {
      return null;
    }
  };
  const log = await open(grant.log.sealed, `log\n${grant.log.epoch}`);
  if (log === null) return 'forged';
  const weeks = new Map<string, Uint8Array>();
  for (const week of grant.weeks) {
    const key = await open(week.sealed, weekInfo(week));
    if (key === null) return 'forged';
    weeks.set(weekName(week.course, week.week), key);
  }
  const result = { grant };
  grantKeys.set(result, { log, weeks });
  return result;
}

function useText(use: Omit<GrantUse, 'proof'>): string {
  const { grant, inspector, course, week, epoch, day } = use;
  return `minhajna/grant/use\n${grant}\n${inspector}\n${course}\n${week}\n${epoch}\n${day}`;
}

/**
 * A week's key on the inspector's device, with the entry for the teacher's
 * access log that goes with it, proved under the grant's log key; null when the
 * grant does not name the week or the world's date is outside the grant's.
 */
export async function useGrant(
  grant: OpenedGrant,
  course: string,
  week: Day,
  today: Day,
  crypto: KeyCrypto,
): Promise<{ readonly key: Uint8Array; readonly use: GrantUse } | null> {
  const keys = grantKeys.get(grant);
  const key = keys?.weeks.get(weekName(course, week));
  const named = grant.grant.weeks.find((one) => one.course === course && one.week === week);
  if (keys === undefined || key === undefined || named === undefined || dated(grant.grant, today) !== null) return null;
  const entry = {
    grant: grant.grant.id,
    inspector: grant.grant.inspector.id,
    course,
    week,
    epoch: named.epoch,
    day: today,
  };
  const proof = toHex(await crypto.mac(keys.log, ascii(useText(entry))));
  return { key, use: { ...entry, proof } };
}

/**
 * Whether an access log entry belongs to a grant, checked on a device that
 * holds the school key against the school's own record of that grant: made
 * with its log key, which only its inspector's device holds besides the
 * school, by its inspector, for a week it names, on a day between its dates.
 * The record must come from the school's space sealed under the school key,
 * never from the copy relayed to the inspector.
 */
export async function checkUse(school: OpenedKeyring, grant: Grant, use: GrantUse, crypto: KeyCrypto) {
  if (use.grant !== grant.id || use.inspector !== grant.inspector.id || !isDay(use.day)) return false;
  const { course, week, epoch } = use;
  const named = grant.weeks.some((one) => one.course === course && one.week === week && one.epoch === epoch);
  if (!named || dated(grant, use.day) !== null || grant.log.epoch >= school.keys.length) return false;
  const key = await logKey(school, grant.log.epoch, grant.id, crypto);
  return sameMac(use.proof, toHex(await crypto.mac(key, ascii(useText(use)))));
}
