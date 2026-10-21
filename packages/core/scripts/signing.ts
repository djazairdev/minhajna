// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The founder's signing tools (#223, answers 303 to 305): a P-256 key pair
// made offline, its private half kept encrypted under a passphrase outside
// the repository, and a calendar update or a plan pack signed with it
// (answers 326 to 328), only with a key the app trusts for that kind. A
// signed file is written only once the core's own reader opens it with the
// keys the app ships and reads what it holds against the bundled data, so
// what the tool writes is what the phone accepts; a file with any field the
// reader would drop or read otherwise is refused, so nothing is signed that
// means more than the phone sees.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALENDAR_UPDATE_FORMAT,
  canonicalJson,
  compareReleases,
  openSigned,
  PACK_BYTES,
  parseCalendarUpdate,
  parseCountryProfile,
  parsePackUpdate,
  parsePlanPack,
  parseSchoolCalendar,
  parseTrustedKeys,
  SIGNED_BYTES,
  SIGNED_FORMAT,
  SIGNED_KINDS,
  utf8Length,
  type CalendarUpdate,
  type CountryProfile,
  type LocalizedText,
  type PackUpdate,
  type ParseProblem,
  type PlanPack,
  type SchoolCalendar,
  type SignedKind,
  type TrustedKey,
} from '../src/index.ts';
import { isFields } from '../src/read.ts';
import { isP256, nodeVerifier } from './node-verify.ts';

/** The most one QR code holds, in bytes: version 40 at the lowest error correction. */
export const QR_BYTES = 2953;

/**
 * The shortest passphrase the private half is kept under: five random words
 * or more, since the PEM's key derivation is cheap.
 */
export const PASSPHRASE_LENGTH = 20;

/** The repository's own folder, which the private half must never be written into. */
export const REPOSITORY = fileURLToPath(new URL('../../../', import.meta.url));

/** The reference files the app bundles, as apps/android/src/reference.ts reads them. */
const BUNDLED = {
  profile: 'dz/profile.json',
  calendar: 'dz/calendar-2026-2027.json',
  keys: 'dz/keys.json',
  packs: 'dz/packs/',
};

function listed(problems: readonly ParseProblem[]): string {
  return problems.map((one) => `${one.path || '(file)'}: ${one.problem}`).join(', ');
}

function same(a: unknown, b: unknown): boolean {
  return a === undefined || b === undefined ? a === b : canonicalJson(a) === canonicalJson(b);
}

/** Where `input` differs from what the reader made of it: a top-level field, or an entry by its place. */
function differences(input: unknown, read: Record<string, unknown>): string[] {
  const fields: Record<string, unknown> = isFields(input) ? { removed: [], ...input } : {};
  const entries = Array.isArray(fields['entries']) ? (fields['entries'] as unknown[]) : [];
  const readEntries = read['entries'] as unknown[];
  return [
    ...[...new Set([...Object.keys(fields), ...Object.keys(read)])]
      .filter((name) => name !== 'entries' && !same(fields[name], read[name]))
      .sort(),
    ...entries.flatMap((entry, index) => (same(entry, readEntries[index]) ? [] : [`entries/${index}`])),
  ];
}

/**
 * Whether `folder` is inside a Git working copy, this repository or another
 * clone: its real path, as the disk spells it, or a folder above it, holds a
 * `.git`. A folder that does not exist throws.
 */
export function insideRepository(folder: string): boolean {
  if (!existsSync(folder)) throw new Error(`The folder ${folder} does not exist.`);
  for (let path = realpathSync.native(folder); ; path = dirname(path)) {
    if (existsSync(join(path, '.git'))) return true;
    if (dirname(path) === path) return false;
  }
}

export interface NewKey {
  /** The entry for data/dz/keys.json. */
  readonly entry: TrustedKey;
  /** The private half, PKCS #8, encrypted under the passphrase. */
  readonly privatePem: string;
}

/** A new P-256 key pair for the kinds it `signs`, its entry checked by the app's own key-list reader. */
export function makeKey(
  id: string,
  holder: LocalizedText,
  passphrase: string,
  signs: readonly SignedKind[] = SIGNED_KINDS,
): NewKey {
  if (passphrase.length < PASSPHRASE_LENGTH)
    throw new Error(`The passphrase needs at least ${PASSPHRASE_LENGTH} characters.`);
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const entry = {
    id,
    holder,
    spki: der.toString('base64'),
    fingerprint: createHash('sha256').update(der).digest('hex'),
    signs: [...signs],
  };
  const read = parseTrustedKeys({ format: 1, keys: [entry] });
  if (!read.ok) throw new Error(`The key's entry does not read: ${listed(read.problems)}`);
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase });
  return { entry, privatePem: privatePem.toString() };
}

/** Opens the private half with its passphrase; a wrong passphrase or another kind of key throws. */
export function openPrivateKey(pem: string, passphrase: string): KeyObject {
  let key: KeyObject;
  try {
    key = createPrivateKey({ key: pem, format: 'pem', passphrase });
  } catch {
    throw new Error('The key does not open: a wrong passphrase, or not a private key file.');
  }
  if (!isP256(key)) throw new Error('This is not a P-256 key, the only kind the phone checks with.');
  return key;
}

/** What the app reads an update against: the country, its bundled calendar and packs, and the keys it trusts. */
export interface Bundled {
  readonly profile: CountryProfile;
  readonly calendar: SchoolCalendar;
  readonly packs: readonly PlanPack[];
  readonly keys: readonly TrustedKey[];
}

/** Reads the bundled reference files with the core's readers, as the app does. */
export function readBundled(data = new URL('../../../data/', import.meta.url)): Bundled {
  const file = (name: string) => JSON.parse(readFileSync(new URL(name, data), 'utf8')) as unknown;
  const profile = parseCountryProfile(file(BUNDLED.profile));
  if (!profile.ok) throw new Error(`${BUNDLED.profile} does not read: ${listed(profile.problems)}`);
  const calendar = parseSchoolCalendar(file(BUNDLED.calendar), profile.value);
  if (!calendar.ok) throw new Error(`${BUNDLED.calendar} does not read: ${listed(calendar.problems)}`);
  const keys = parseTrustedKeys(file(BUNDLED.keys));
  if (!keys.ok) throw new Error(`${BUNDLED.keys} does not read: ${listed(keys.problems)}`);
  const packs = readdirSync(new URL(BUNDLED.packs, data))
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const pack = parsePlanPack(file(`${BUNDLED.packs}${name}`));
      if (!pack.ok) throw new Error(`${BUNDLED.packs}${name} does not read: ${listed(pack.problems)}`);
      return pack.value;
    });
  return { profile: profile.value, calendar: calendar.value, packs, keys: keys.value };
}

export interface Signed {
  /** The signed file's text. */
  readonly file: string;
  readonly bytes: number;
  readonly update: CalendarUpdate;
  /** Whether the file fits one QR code. */
  readonly qr: boolean;
}

export interface SignedPack {
  /** The signed file's text. */
  readonly file: string;
  readonly bytes: number;
  readonly update: PackUpdate;
}

/** Whether the reader kept every field of `input` as written; a field it fills in by default is not one of them. */
function kept(input: unknown, read: unknown): boolean {
  if (Array.isArray(input))
    return Array.isArray(read) && input.length === read.length && input.every((one, index) => kept(one, read[index]));
  if (isFields(input))
    return (
      isFields(read) &&
      Object.entries(input).every(([name, value]) => Object.hasOwn(read, name) && kept(value, read[name]))
    );
  return input === read;
}

/** Signs `input` with the private half of trusted key `id`, which must sign `kind`, and opens it as the app would. */
async function seal(input: unknown, key: KeyObject, id: string, keys: readonly TrustedKey[], kind: SignedKind) {
  const trusted = keys.find((one) => one.id === id);
  if (trusted === undefined) throw new Error(`data/${BUNDLED.keys} lists no key ${id}; add its entry first.`);
  if (!trusted.signs.includes(kind)) throw new Error(`data/${BUNDLED.keys} does not let ${id} sign ${kind}.`);
  const spki = createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64');
  if (spki !== trusted.spki) throw new Error(`This private key is not the one data/${BUNDLED.keys} lists as ${id}.`);
  const payload = JSON.stringify(input);
  const signature = sign('sha256', Buffer.from(payload, 'utf8'), key).toString('base64');
  const file = JSON.stringify({ format: SIGNED_FORMAT, version: { major: 1, minor: 0 }, key: id, payload, signature });
  const bytes = utf8Length(file);
  const limit = kind === 'packs' ? PACK_BYTES : SIGNED_BYTES;
  if (bytes === null || bytes > limit)
    throw new Error(`The signed file weighs ${bytes ?? '?'} bytes; the app reads at most ${limit}.`);
  const opened = await openSigned(file, keys, nodeVerifier, limit);
  if (!opened.ok) throw new Error(`The signed file does not open: ${opened.problem}`);
  return { file, bytes, payload: opened.payload };
}

/** Signs a calendar update with the private half of the trusted key `id`, and opens the result as the app would. */
export async function signUpdate(input: unknown, key: KeyObject, id: string, bundled: Bundled): Promise<Signed> {
  const { profile, calendar, keys } = bundled;
  const read = parseCalendarUpdate(input, profile, calendar.year);
  if (!read.ok) throw new Error(`The update does not read: ${listed(read.problems)}`);
  const unread = differences(input, { format: CALENDAR_UPDATE_FORMAT, version: { major: 1, minor: 0 }, ...read.value });
  if (unread.length > 0)
    throw new Error(`Format 1.0 does not read these as written, such as a misspelled field: ${unread.join(', ')}`);
  if (compareReleases(read.value.release, calendar.release) <= 0)
    throw new Error(`Release ${read.value.release} is not after the bundled calendar's ${calendar.release}.`);
  const { file, bytes, payload } = await seal(input, key, id, keys, 'calendar');
  const again = parseCalendarUpdate(payload, profile, calendar.year);
  if (!again.ok) throw new Error(`The signed update does not read: ${listed(again.problems)}`);
  return { file, bytes, update: again.value, qr: bytes <= QR_BYTES };
}

/** Signs a plan pack's release with the private half of the trusted key `id`, and opens the result as the app would. */
export async function signPack(input: unknown, key: KeyObject, id: string, bundled: Bundled): Promise<SignedPack> {
  const { profile, packs, keys } = bundled;
  const read = parsePackUpdate(input, profile);
  if (!read.ok) throw new Error(`The pack does not read: ${listed(read.problems)}`);
  const { pack } = read.value;
  const fields = isFields(input) ? input : {};
  const unread = [
    ...Object.keys(fields).filter((name) => !['format', 'version', 'country', 'published', 'pack'].includes(name)),
    ...(same(fields['version'], { major: 1, minor: 0 }) ? [] : ['version']),
    ...(['country', 'published'] as const).filter((name) => fields[name] !== read.value[name]),
    ...(kept(fields['pack'], pack) ? [] : ['pack']),
  ].sort();
  if (unread.length > 0)
    throw new Error(`Format 1.0 does not read these as written, such as a misspelled field: ${unread.join(', ')}`);
  const bundledRelease = packs.find((one) => one.id === pack.id && compareReleases(one.release, pack.release) >= 0);
  if (bundledRelease !== undefined)
    throw new Error(`Release ${pack.release} of ${pack.id} is not after the bundled ${bundledRelease.release}.`);
  const { file, bytes, payload } = await seal(input, key, id, keys, 'packs');
  const again = parsePackUpdate(payload, profile);
  if (!again.ok) throw new Error(`The signed pack does not read: ${listed(again.problems)}`);
  return { file, bytes, update: again.value };
}
