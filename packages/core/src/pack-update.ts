// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signed plan packs (#223 part 2, PRD §4.2, §4.8, R-4.8-03 to R-4.8-05, answers
// 326 to 329): a release of a plan pack the app was not built with, signed by a
// key that may sign packs, in a file of up to 1 MB. Adding one puts it in the
// catalogue beside the bundled packs, so a class can pin it; a class pinned to
// another release stays on it until the teacher moves it (#322, release-
// move.ts). A release the app already has changes nothing, and one older than a
// release it has is not added, unless a class is pinned to that very release
// and misses it.

import { CALENDAR_UPDATE_FORMAT } from './calendar-update.ts';
import { canonicalJson } from './canonical.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { parsePlanPack, type PlanPack } from './pack.ts';
import { compareReleases, parsePackId } from './pack-catalogue.ts';
import { at, isFields, Reader, type ParseResult } from './read.ts';
import { packKey, type CountryProfile, type Reference } from './reference.ts';
import { openSigned, PACK_BYTES, readVersion, type SignedKind, type TrustedKey, type Verifier } from './signed-read.ts';

export const PACK_UPDATE_FORMAT = 'minhajna.plan-pack';

export interface PackUpdate {
  readonly country: string;
  /** The day the release was published. */
  readonly published: Day;
  readonly pack: PlanPack;
}

/** A signed pack as the teacher added it: who signed it, and the signed file, to pass on as it came. */
export interface AddedPack {
  readonly update: PackUpdate;
  readonly key: string;
  readonly file: string;
}

/** The kind of data a signed file's payload holds, by its format; null for a format the app does not know. */
export function signedKindOf(payload: unknown): SignedKind | null {
  const format = isFields(payload) ? payload['format'] : undefined;
  return format === CALENDAR_UPDATE_FORMAT ? 'calendar' : format === PACK_UPDATE_FORMAT ? 'packs' : null;
}

/** Whether a trusted key may sign this kind of data (answer 327). */
export function keySigns(key: TrustedKey, kind: SignedKind): boolean {
  return key.signs.includes(kind);
}

/** Reads a signed pack from a signed file's payload, for the country the app is built for. */
export function parsePackUpdate(input: unknown, profile: CountryProfile): ParseResult<PackUpdate> {
  const reader = new Reader();
  if (!isFields(input) || input['format'] !== PACK_UPDATE_FORMAT)
    return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (readVersion(input['version'])?.major !== 1)
    return { ok: false, problems: [{ path: 'version', problem: 'invalid' }] };
  if (input['country'] !== profile.code) reader.fail('country', 'unknown-reference');
  const published = reader.day(input, 'published', '');
  const read = parsePlanPack(input['pack']);
  if (!read.ok)
    read.problems.forEach(({ path, problem }) => reader.fail(path === '' ? 'pack' : at('pack', path), problem));
  else if (parsePackId(read.value.id)?.country !== profile.code) reader.fail('pack.id', 'unknown-reference');
  if (reader.problems.length > 0 || published === undefined || !read.ok)
    return { ok: false, problems: reader.problems };
  return { ok: true, value: { country: profile.code, published, pack: read.value } };
}

export type PackAddStatus = 'new' | 'held' | 'older';

/**
 * Whether a signed pack can still be added: 'held' for a release the app
 * already has, bundled or added; 'older' for one before a release of the
 * same pack it has, unless a class is pinned to it; 'new' otherwise.
 */
export function packAddStatus(context: Context, pack: PlanPack): PackAddStatus {
  if (context.ref.packs.has(packKey(pack.id, pack.release))) return 'held';
  const newer = [...context.ref.packs.values()].some(
    (one) => one.id === pack.id && compareReleases(one.release, pack.release) > 0,
  );
  const pinned = [...context.state.courses.values()].some(
    (course) => course.pack?.id === pack.id && course.pack.release === pack.release,
  );
  return newer && !pinned ? 'older' : 'new';
}

/** The record of adding a checked pack; refused unless the app can still add it. */
export function addPack(context: Context, update: PackUpdate, key: string, file: string): RecordEvent {
  if (packAddStatus(context, update.pack) !== 'new') throw new RangeError('Not a pack release the app can add');
  return { kind: 'pack.added', added: { update, key, file } };
}

/** The reference data with the added packs beside its own; a release it already has keeps its place. */
export function withAddedPacks(ref: Reference, added: readonly AddedPack[]): Reference {
  if (added.length === 0) return ref;
  const packs = new Map(ref.packs);
  for (const { update } of added) {
    const key = packKey(update.pack.id, update.pack.release);
    if (!packs.has(key)) packs.set(key, update.pack);
  }
  return { ...ref, packs };
}

/**
 * Whether an added pack is what its signed file says, signed by the key it names, which may sign packs: for a pack
 * that came from another device or a backup, which is checked again before it is taken in.
 */
export async function addedPackHolds(
  added: AddedPack,
  keys: readonly TrustedKey[],
  verify: Verifier,
  profile: CountryProfile,
): Promise<boolean> {
  const opened = await openSigned(added.file, keys, verify, PACK_BYTES);
  if (!opened.ok || opened.key.id !== added.key || !keySigns(opened.key, 'packs')) return false;
  const read = parsePackUpdate(opened.payload, profile);
  return read.ok && canonicalJson(read.value) === canonicalJson(added.update);
}
