// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The private halves of a seeded national world (#548, choice D2, answer 625):
// for each seeded school, by its seeded ID, its space and the device that holds
// its key, with that device's agreement key; and for each of its teachers, by
// seeded ID, the device that joined and its signing key, each private half as
// PKCS #8 DER in base64. They travel as one record on a stream of the world's
// national space whose name and sealing key come from the world's sealing key,
// which the device derives from the code's secret, so whoever holds the code
// holds them and the server holds none. The first record that reads, for this
// world, counts; one that names a school, a space, a device or a teacher twice
// does not read.

import type { SealedBatch } from './batches.ts';
import { ID, SCHOOL } from './school-key-shape.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { isWorldId } from './world-code.ts';
import { PKCS8_TEXT, type WorldCipher, type WorldMac } from './world-keys.ts';

export const SEEDED_KEYS_FORMAT = 'minhajna/seeded-keys/1';
/** The most batches the record may take: about 384 KB, over twice the 36 a seeded world of 492 teachers takes. */
export const SEEDED_KEYS_BATCHES = 96;

const SEED = /^[a-z]+-[1-9][0-9]{0,5}$/u;

export interface SeededTeacherKey {
  readonly seed: string;
  readonly device: string;
  /** The signing key's private half. */
  readonly signing: string;
}

export interface SeededSchoolKey {
  readonly seed: string;
  readonly space: string;
  /** The device that holds the school key. */
  readonly device: string;
  /** That device's agreement key's private half. */
  readonly agreement: string;
  readonly teachers: readonly SeededTeacherKey[];
}

export interface SeededKeys {
  readonly format: typeof SEEDED_KEYS_FORMAT;
  readonly world: string;
  readonly schools: readonly SeededSchoolKey[];
}

/** Where a world's national space keeps its seeded keys. */
export const seededKeysPlace = (sealing: Uint8Array, mac: WorldMac): Promise<Place> =>
  placeOf(sealing, 'seeded-keys', mac);

/** Whether a value is an object with exactly these fields. */
function fields(value: unknown, names: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === names.length && names.every((name) => keys.includes(name));
}

const isText = (value: unknown, pattern: RegExp): value is string => typeof value === 'string' && pattern.test(value);

function readTeacher(value: unknown): SeededTeacherKey | null {
  if (!fields(value, ['seed', 'device', 'signing'])) return null;
  const { seed, device, signing } = value;
  return isText(seed, SEED) && isText(device, ID) && isText(signing, PKCS8_TEXT) ? { seed, device, signing } : null;
}

function readSchool(value: unknown): SeededSchoolKey | null {
  if (!fields(value, ['seed', 'space', 'device', 'agreement', 'teachers'])) return null;
  const { seed, space, device, agreement, teachers } = value;
  if (!isText(seed, SEED) || !isText(space, SCHOOL) || !isText(device, ID) || !isText(agreement, PKCS8_TEXT)) {
    return null;
  }
  if (!Array.isArray(teachers)) return null;
  const read = teachers.map(readTeacher);
  if (read.some((one) => one === null)) return null;
  return { seed, space, device, agreement, teachers: read as SeededTeacherKey[] };
}

/** Whether no two values are the same. */
const distinct = (values: readonly string[]) => new Set(values).size === values.length;

/** A world's seeded keys as a record holds them, or null when it is not exactly one for this world. */
export function readSeededKeys(value: unknown, world: string): SeededKeys | null {
  if (!fields(value, ['format', 'world', 'schools']) || value['format'] !== SEEDED_KEYS_FORMAT) return null;
  if (!isWorldId(world) || value['world'] !== world || !Array.isArray(value['schools'])) return null;
  const schools = value['schools'].map(readSchool);
  if (schools.some((one) => one === null)) return null;
  const read = schools as SeededSchoolKey[];
  const teachers = read.flatMap((school) => school.teachers);
  const devices = [...read.map((school) => school.device), ...teachers.map((teacher) => teacher.device)];
  const unique =
    distinct(read.map((school) => school.seed)) &&
    distinct(read.map((school) => school.space)) &&
    distinct(teachers.map((teacher) => teacher.seed)) &&
    distinct(devices);
  return unique ? { format: SEEDED_KEYS_FORMAT, world, schools: read } : null;
}

/** The record's batches at its place, numbered from `first`. */
export async function sealSeededKeys(
  place: Place,
  keys: SeededKeys,
  first: number,
  cipher: WorldCipher,
): Promise<SealedBatch[]> {
  if (readSeededKeys(keys, keys.world) === null) throw new RangeError('Not the seeded keys of a world');
  return sealRecord(place, keys, first, SEEDED_KEYS_BATCHES, cipher);
}

/** The first record at the place that reads as this world's seeded keys, or null when none does. */
export async function openSeededKeys(
  place: Place,
  batches: readonly SealedBatch[],
  world: string,
  cipher: WorldCipher,
): Promise<SeededKeys | null> {
  for (const record of await openRecords(place, batches, SEEDED_KEYS_BATCHES, cipher)) {
    const read = readSeededKeys(record, world);
    if (read !== null) return read;
  }
  return null;
}
