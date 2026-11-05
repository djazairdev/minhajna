// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The headless release service for the editor/review boards (#612, #614). It
// uses the world's keys already held in memory by DemoRoot (#608), never a
// teacher's store. The national space carries signed changes in sealed,
// fixed-size batches. A stale revision is refused even after a concurrent
// append, and a whole change is checked and bounded before a write. Each change
// first takes its step on the server under the role's pack-editor account,
// whose signature every reader checks, so a role is no longer a claim (answer
// 767). The server sees the step, never the release. The world's day must still
// match the server's.

import {
  canonicalJson,
  checkPackPublicationSize,
  checkPackReleaseSize,
  PackReleaseError,
  isDay,
  openPackReleaseBatches,
  packDigest,
  packReleaseKey,
  packReleasePlace,
  packReleaseRecords,
  parsePackId,
  preparePackRelease,
  sealPackRelease,
  signPackRelease,
  type CountryProfile,
  type PackAuthority,
  type PackChange,
  type PackPublisher,
  type PackRelease,
} from '@minhajna/core';
import { NATIONAL_SPACE, type HeldWorld } from '../demo/world-calendar-read';
import type { OpenWorld, WorldRole } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldNetworkOpen, worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnce, readingMissing } from '../school/stream-put';

export interface PackEditor {
  readonly world: Pick<OpenWorld, 'world' | 'kind' | 'date'> | null;
  readonly held: HeldWorld | null;
  readonly profile: CountryProfile;
  readonly kit: Pick<WorldKit, 'mac' | 'cipher' | 'verify' | 'sign'>;
  /** The pack-editor accounts' tokens this device holds, by role. */
  readonly accounts?: Readonly<Partial<Record<PackPublisher, string>>>;
}
export interface PackReleaseTarget {
  readonly id: string;
  readonly release: string;
  readonly revision: number;
}

async function desk({ world, held, kit }: PackEditor, send: Send, acceptLaterDay = false) {
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
  if (typeof date !== 'string' || !isDay(date) || (acceptLaterDay ? date < world.date : date !== world.date))
    throw failed('Refresh the world’s date before editing', 'E_PACK_DATE');
  const authority: PackAuthority = {
    caKey: await caKey(world.world, send),
    sealing: held.sealing,
    mac: kit.mac,
    verify: kit.verify,
  };
  return {
    world: { ...world, date },
    keys: held.keys,
    authority,
    place: await kitStep(() => packReleasePlace(held.sealing, kit.mac)),
  };
}

type Desk = Awaited<ReturnType<typeof desk>>;
async function releaseBatches(held: Desk, send: Send) {
  const missing = readingMissing(held.world.world, send, () => ({
    status: 200,
    body: { batches: [], more: false },
    retryAfter: null,
  }));
  return (await spaceBatches(held.world.world, NATIONAL_SPACE, missing)).get(held.place.stream) ?? [];
}

async function readBatches(
  held: Desk,
  { profile, kit }: PackEditor,
  batches: Awaited<ReturnType<typeof releaseBatches>>,
  strict: boolean,
) {
  return packReleaseRecords(
    await openPackReleaseBatches(held.place, batches, kit.cipher, strict),
    held.keys,
    profile,
    held.world.date,
    held.authority,
    strict,
  );
}

async function releases(held: Desk, editor: PackEditor, send: Send, strict: boolean) {
  return readBatches(held, editor, await releaseBatches(held, send), strict);
}

export async function readPackReleases(editor: PackEditor, send: Send = worldRequest) {
  return releases(await desk(editor, send), editor, send, false);
}

/**
 * Reads the current world day and distinguishes writable history from salvaged
 * releases. A release signed on a day that moved during the read looks damaged,
 * so damage is believed only once the day is read again and has not moved.
 */
export async function readPackEditor(editor: PackEditor, send: Send = worldRequest) {
  const held = await desk(editor, send, true);
  const read = await readDesk(held, editor, send);
  if (!read.damaged) return read;
  const again = await desk(editor, send, true);
  return again.world.date === held.world.date ? read : readDesk(again, editor, send);
}

async function readDesk(held: Desk, editor: PackEditor, send: Send) {
  const batches = await releaseBatches(held, send);
  const { date } = held.world;
  try {
    return { date, records: await readBatches(held, editor, batches, true), damaged: false };
  } catch (error) {
    if (!(error instanceof PackReleaseError) || error.code !== 'E_PACK_HISTORY') throw error;
    return { date, records: await readBatches(held, editor, batches, false), damaged: true };
  }
}

/** The step a device read, as it shows it to the server: the release's own fields with the CA's signature. */
async function shownStep(held: Desk, release: PackRelease | null | undefined) {
  if (release === null || release === undefined || release.attested === null) return null;
  const { sealing, mac } = held.authority;
  return {
    release: release.pack.release,
    revision: release.revision,
    stage: release.stage,
    role: release.actor,
    status: release.pack.status,
    digest: await kitStep(() => packDigest(release, sealing, mac)),
    by: release.supersededBy,
    day: release.day,
    signature: release.attested,
  };
}

/** Takes the step on the server, whose signature makes the change one a reader takes. */
async function takeStep(
  held: Desk,
  prepared: PackRelease,
  all: ReadonlyMap<string, PackRelease>,
  token: string,
  send: Send,
): Promise<PackRelease> {
  const { pack, stage, revision, supersededBy, day } = prepared;
  const { sealing, mac } = held.authority;
  const answer = await send({
    method: 'POST',
    path: `/worlds/${held.world.world}/packs/steps`,
    starter: token,
    body: {
      id: pack.id,
      release: pack.release,
      expected: revision - 1,
      stage,
      status: pack.status,
      digest: await kitStep(() => packDigest(prepared, sealing, mac)),
      by: supersededBy,
      day,
      previous: await shownStep(held, all.get(packReleaseKey(pack.id, pack.release))),
      successor: supersededBy === null ? null : await shownStep(held, all.get(packReleaseKey(pack.id, supersededBy))),
    },
  });
  const said = answer.body as { signature?: unknown; problem?: unknown } | null;
  if (answer.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
  if (answer.status === 403) throw failed('The account may not take this step', 'E_PACK_ROLE');
  if (answer.status === 409) {
    if (said?.problem === 'date') throw failed('The world’s date moved', 'E_PACK_DATE');
    throw new PackReleaseError('E_PACK_CHANGED');
  }
  if (answer.status !== 201 || typeof said?.signature !== 'string') throw unexpected(answer);
  return { ...prepared, attested: said.signature };
}

export async function changePackRelease(
  editor: PackEditor,
  actor: WorldRole,
  target: PackReleaseTarget,
  change: PackChange,
  send: Send = worldRequest,
): Promise<PackRelease> {
  if (actor !== 'curator' && actor !== 'ministry') throw failed('Not a publishing demo role', 'E_PACK_ROLE');
  const token = editor.accounts?.[actor];
  if (token === undefined) throw failed('This device holds no account of this role', 'E_PACK_ROLE');
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
  const read = await releases(held, editor, send, true);
  const prepared = next(read);
  if (prepared.stage === 'draft' || prepared.stage === 'under-review')
    await checkPackPublicationSize(prepared, held.keys);
  const taken = await takeStep(held, prepared, read, token, send);
  const signed = await kitStep(() => signPackRelease(taken, held.keys, kit.sign));
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
          held.authority,
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
