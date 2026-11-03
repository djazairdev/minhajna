// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Demo-only, signed pack lifecycle records (#612). Each change is signed
// for its world and sealed by the existing relay codec. A publication also
// carries an ordinary pack-update payload inside a world-marked signature:
// real mode and another world refuse it. Replaying checks every revision
// through the same transition rules and keeps immutable publication bytes.
// Demo roles are claims by code holders, never proof of state authority.
// One change fits the relay's atomic 128-batch upload; larger drafts fail
// before being sent. The later review board and teacher delivery use this
// service; no pupil record or teacher history is part of its input.

import { pieceRoom, SYNC_BATCH_BYTES, type SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { compareDays, isDay, type Day } from './day.ts';
import { parsePackId } from './pack-catalogue.ts';
import {
  packReleaseKey,
  PACK_STAGES,
  PackReleaseError,
  preparePackRelease,
  type PackChange,
  type PackRelease,
} from './pack-lifecycle.ts';
import { keySigns, PACK_UPDATE_FORMAT, parsePackUpdate } from './pack-update.ts';
import { parsePlanPack } from './pack.ts';
import { isFields } from './read.ts';
import type { CountryProfile } from './reference.ts';
import { asciiJson, openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { openSigned, PACK_BYTES, SIGNED_SIGNATURE_MAX, WORLD_KEY_PREFIX, type Verifier } from './signed-read.ts';
import { isWorldId } from './world-code.ts';
import { worldSignedFile, type WorldCipher, type WorldKeys, type WorldMac, type WorldSigner } from './world-keys.ts';

export const PACK_RELEASE_FORMAT = 'minhajna/pack-release/1';
export const PACK_RELEASE_BATCHES = 128;

export function checkPackReleaseSize(file: string): void {
  if (asciiJson(file).length > PACK_RELEASE_BATCHES * pieceRoom(SYNC_BATCH_BYTES))
    throw new PackReleaseError('E_PACK_SIZE');
}

export const packReleasePlace = (sealing: Uint8Array, mac: WorldMac): Promise<Place> =>
  placeOf(sealing, 'pack-release', mac);

export const sealPackRelease = (place: Place, file: string, first: number, cipher: WorldCipher) =>
  sealRecord(place, file, first, PACK_RELEASE_BATCHES, cipher);

/** Opens a complete history for edits, or intact records only for read-only lists. */
export const openPackReleaseBatches = (
  place: Place,
  batches: readonly SealedBatch[],
  cipher: WorldCipher,
  strict = true,
) =>
  openRecords(place, batches, PACK_RELEASE_BATCHES, cipher, strict).catch((error: unknown) => {
    if (error instanceof RangeError) throw new PackReleaseError('E_PACK_HISTORY');
    throw error;
  });

export async function signPackRelease(release: PackRelease, keys: WorldKeys, sign: WorldSigner) {
  if (keys.kind !== 'national' || !isWorldId(keys.world) || keys.world !== release.world)
    throw new PackReleaseError('E_PACK_WORLD');
  const key = keys.trusted.find((one) => one.id.startsWith(WORLD_KEY_PREFIX) && keySigns(one, 'packs'));
  if (key === undefined || keys.private[key.id] === undefined) throw new PackReleaseError('E_PACK_SIGNER');
  const signed = (value: unknown) => worldSignedFile(keys, key.id, canonicalJson(value), sign);
  const country = parsePackId(release.pack.id)?.country;
  if (country === undefined) throw new PackReleaseError('E_PACK_SOURCE');
  const file =
    release.stage === 'published' && release.file === null
      ? await signed({
          format: PACK_UPDATE_FORMAT,
          version: { major: 1, minor: 0 },
          country,
          published: release.day,
          pack: release.pack,
        })
      : release.file;
  const value = { ...release, file };
  return { release: value, file: await signed({ format: PACK_RELEASE_FORMAT, release: value }) };
}

/** Bounds the eventual double-signed publication before accepting a draft or review. */
export async function checkPackPublicationSize(release: PackRelease, keys: WorldKeys): Promise<void> {
  const signature: WorldSigner = () => Promise.resolve('A'.repeat(SIGNED_SIGNATURE_MAX));
  const review = { ...release, stage: 'under-review' as const, revision: Number.MAX_SAFE_INTEGER - 1 };
  for (const actor of new Set([release.actor, 'ministry'] as const)) {
    const published = preparePackRelease(
      review,
      { stage: 'published' },
      {
        world: release.world,
        day: release.day,
        actor,
        expected: review.revision,
      },
    );
    const { file } = await signPackRelease(published, keys, signature);
    checkPackReleaseSize(file);
  }
}

function releaseOf(value: unknown): PackRelease | null {
  if (
    !isFields(value) ||
    Object.keys(value).some(
      (key) => !['world', 'pack', 'stage', 'revision', 'actor', 'day', 'file', 'supersededBy'].includes(key),
    )
  )
    return null;
  const { world, stage, revision, actor, day, file, supersededBy } = value;
  if (
    typeof world !== 'string' ||
    !PACK_STAGES.includes(stage as PackRelease['stage']) ||
    !Number.isSafeInteger(revision) ||
    (revision as number) < 1 ||
    !['curator', 'ministry'].includes(actor as string) ||
    typeof day !== 'string' ||
    !isDay(day) ||
    (file !== null && typeof file !== 'string') ||
    (supersededBy !== null && typeof supersededBy !== 'string')
  )
    return null;
  const read = parsePlanPack(value.pack);
  if (!read.ok) return null;
  return {
    world,
    pack: read.value,
    stage: stage as PackRelease['stage'],
    revision: revision as number,
    actor: actor as PackRelease['actor'],
    day,
    file,
    supersededBy,
  };
}

export async function packReleaseRecords(
  records: readonly unknown[],
  keys: WorldKeys,
  profile: CountryProfile,
  day: Day,
  verify: Verifier,
  strict = false,
): Promise<ReadonlyMap<string, PackRelease>> {
  if (keys.kind !== 'national' || !isWorldId(keys.world) || !isDay(day)) throw new PackReleaseError('E_PACK_WORLD');
  const found = new Map<string, PackRelease>();
  const seen = new Set<string>();
  const invalid = () => {
    if (strict) throw new PackReleaseError('E_PACK_HISTORY');
  };
  for (const record of records) {
    if (typeof record !== 'string') {
      invalid();
      continue;
    }
    if (seen.has(record)) continue;
    seen.add(record);
    const opened = await openSigned(record, keys.trusted, verify, PACK_BYTES, keys.world);
    if (
      !opened.ok ||
      !keySigns(opened.key, 'packs') ||
      !isFields(opened.payload) ||
      opened.payload.format !== PACK_RELEASE_FORMAT ||
      Object.keys(opened.payload).some((key) => !['format', 'release'].includes(key))
    ) {
      invalid();
      continue;
    }
    const read = releaseOf(opened.payload.release);
    if (
      read === null ||
      read.world !== keys.world ||
      compareDays(read.day, day) > 0 ||
      parsePackId(read.pack.id)?.country !== profile.code
    ) {
      invalid();
      continue;
    }
    const id = packReleaseKey(read.pack.id, read.pack.release);
    const current = found.get(id) ?? null;
    if (current !== null && canonicalJson(current) === canonicalJson(read)) continue;
    const change: PackChange =
      read.stage === 'draft'
        ? { stage: 'draft', pack: read.pack }
        : read.stage === 'superseded'
          ? { stage: 'superseded', by: read.supersededBy ?? '' }
          : { stage: read.stage };
    try {
      const successor =
        read.supersededBy === null ? null : (found.get(packReleaseKey(read.pack.id, read.supersededBy)) ?? null);
      const expected = preparePackRelease(
        current,
        change,
        { world: read.world, day: read.day, actor: read.actor, expected: read.revision - 1 },
        successor,
      );
      if (read.stage === 'published') {
        if (read.file === null) {
          invalid();
          continue;
        }
        const publication = await openSigned(read.file, keys.trusted, verify, PACK_BYTES, keys.world);
        if (!publication.ok || !keySigns(publication.key, 'packs')) {
          invalid();
          continue;
        }
        const update = parsePackUpdate(publication.payload, profile);
        if (
          !update.ok ||
          update.value.published !== read.day ||
          canonicalJson(update.value.pack) !== canonicalJson(expected.pack)
        ) {
          invalid();
          continue;
        }
        if (canonicalJson({ ...expected, file: read.file }) !== canonicalJson(read)) {
          invalid();
          continue;
        }
      } else if (canonicalJson(expected) !== canonicalJson(read)) {
        invalid();
        continue;
      }
      found.set(id, read);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      invalid();
    }
  }
  return found;
}
