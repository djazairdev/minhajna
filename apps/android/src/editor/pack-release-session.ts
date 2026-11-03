// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The headless release service for the editor/review boards (#612, #614).
// The maintainer chose the existing encrypted demo-world flow: no new
// server account or plaintext pack API. It uses the world's keys already
// held in memory by DemoRoot (#608), never a teacher's store. The national
// space carries signed changes in sealed, fixed-size batches. A stale
// revision is refused even after a concurrent append, and a whole change
// is checked and bounded before a write. Roles are demo choices, not
// verified identities. The world's day must still match the server's.

import {
  canonicalJson,
  checkPackPublicationSize,
  checkPackReleaseSize,
  PackReleaseError,
  isDay,
  openPackReleaseBatches,
  packReleaseKey,
  packReleasePlace,
  packReleaseRecords,
  parsePackId,
  preparePackRelease,
  sealPackRelease,
  signPackRelease,
  type CountryProfile,
  type PackChange,
  type PackRelease,
} from '@minhajna/core';
import { NATIONAL_SPACE, type HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld, WorldRole } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldNetworkOpen, worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { putOnce, readingMissing } from '../school/stream-put';

export interface PackEditor {
  readonly world: Pick<OpenWorld, 'world' | 'kind' | 'date'> | null;
  readonly held: HeldWorld | null;
  readonly profile: CountryProfile;
  readonly kit: Pick<WorldKit, 'mac' | 'cipher' | 'verify' | 'sign'>;
}
export interface PackReleaseTarget {
  readonly id: string;
  readonly release: string;
  readonly revision: number;
}

async function desk({ world, held, kit }: PackEditor, send: Send) {
  if (
    world === null ||
    held === null ||
    world.kind !== 'national' ||
    held.keys.kind !== 'national' ||
    held.world !== world.world ||
    held.keys.world !== world.world ||
    held.sealing.length !== 32 ||
    worldNetworkOpen() !== world.world
  )
    throw failed('A national demo world must be open', 'E_PACK_WORLD');
  const answer = await send({ method: 'GET', path: `/worlds/${world.world}/date` });
  if (answer.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
  if (answer.status !== 200) throw unexpected(answer);
  const date = (answer.body as { date?: unknown } | null)?.date;
  if (typeof date !== 'string' || !isDay(date) || date !== world.date)
    throw failed('Refresh the world’s date before editing', 'E_PACK_DATE');
  return { world, keys: held.keys, place: await kitStep(() => packReleasePlace(held.sealing, kit.mac)) };
}

type Desk = Awaited<ReturnType<typeof desk>>;
async function releases(held: Desk, { profile, kit }: PackEditor, send: Send, strict: boolean) {
  const missing = readingMissing(held.world.world, send, () => ({
    status: 200,
    body: { batches: [], more: false },
    retryAfter: null,
  }));
  const batches = (await spaceBatches(held.world.world, NATIONAL_SPACE, missing)).get(held.place.stream) ?? [];
  return packReleaseRecords(
    await openPackReleaseBatches(held.place, batches, kit.cipher, strict),
    held.keys,
    profile,
    held.world.date,
    kit.verify,
    strict,
  );
}

export async function readPackReleases(editor: PackEditor, send: Send = worldRequest) {
  return releases(await desk(editor, send), editor, send, false);
}

export async function changePackRelease(
  editor: PackEditor,
  actor: WorldRole,
  target: PackReleaseTarget,
  change: PackChange,
  send: Send = worldRequest,
): Promise<PackRelease> {
  if (actor !== 'curator' && actor !== 'ministry') throw failed('Not a publishing demo role', 'E_PACK_ROLE');
  if (parsePackId(target.id)?.country !== editor.profile.code) throw new PackReleaseError('E_PACK_SOURCE');
  if (change.stage === 'draft' && (change.pack.id !== target.id || change.pack.release !== target.release))
    throw new PackReleaseError('E_PACK_SOURCE');
  const held = await desk(editor, send);
  const { kit, profile } = editor;
  const id = packReleaseKey(target.id, target.release);
  const scope = { world: held.world.world, day: held.world.date, actor, expected: target.revision };
  const next = (all: ReadonlyMap<string, PackRelease>) =>
    preparePackRelease(
      all.get(id) ?? null,
      change,
      scope,
      change.stage === 'superseded' ? (all.get(packReleaseKey(target.id, change.by)) ?? null) : null,
    );
  const prepared = next(await releases(held, editor, send, true));
  if (prepared.stage === 'draft' || prepared.stage === 'under-review')
    await checkPackPublicationSize(prepared, held.keys);
  const signed = await kitStep(() => signPackRelease(prepared, held.keys, kit.sign));
  checkPackReleaseSize(signed.file);
  let latest: ReadonlyMap<string, PackRelease> = new Map();
  await putOnce(
    {
      world: held.world.world,
      space: NATIONAL_SPACE,
      kind: 'national',
      stream: held.place.stream,
      open: async (batches) => {
        latest = await packReleaseRecords(
          await openPackReleaseBatches(held.place, batches, kit.cipher),
          held.keys,
          profile,
          held.world.date,
          kit.verify,
          true,
        );
        return [...latest.values()];
      },
      there: () => {
        const now = latest.get(id);
        if (now !== undefined && canonicalJson(now) === canonicalJson(signed.release)) return true;
        if (canonicalJson(next(latest)) !== canonicalJson(prepared)) throw new PackReleaseError('E_PACK_CHANGED');
        return false;
      },
      seal: (first) => sealPackRelease(held.place, signed.file, first, kit.cipher),
    },
    send,
  );
  return signed.release;
}
