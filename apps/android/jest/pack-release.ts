// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A source-only pack service on the real relay's in-memory stand-in.
// Every plan, world and signing key is made up, with no teacher store.

import type { PackChange, PackRelease, PlanPack } from '@minhajna/core';
import { makePackAccount } from '../src/editor/pack-account';
import { changePackRelease } from '../src/editor/pack-release-session';
import { startWorld, type Send } from '../src/demo/world-session';
import { bundledReference, readReference } from '../src/reference';
import { DemoServer, nodeKit } from './world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The synthetic reference must read');
export const reference = read;
export const source: PlanPack = {
  ...read.packs[0],
  status: 'community',
  provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition' },
};

export async function packService(kind: 'national' | 'teachers' = 'national') {
  const server = new DemoServer();
  const made = await startWorld(kind, reference.calendar, nodeKit, server.send);
  const world = { code: made.code, date: made.date, kind, world: made.keys.world };
  const accounts =
    kind === 'national'
      ? {
          curator: await makePackAccount(world.world, made.starter, 'curator', server.send),
          ministry: await makePackAccount(world.world, made.starter, 'ministry', server.send),
        }
      : ({} as { curator?: string; ministry?: string });
  const editor = {
    world,
    held: { world: world.world, keys: made.keys, sealing: made.sealing },
    profile: reference.profile,
    kit: nodeKit,
    accounts,
  };
  const target = (current: PackRelease | null, pack = source) => ({
    id: pack.id,
    release: pack.release,
    revision: current?.revision ?? 0,
  });
  const change = (
    current: PackRelease | null,
    action: PackChange,
    actor: 'curator' | 'ministry' = 'curator',
    send: Send = server.send,
  ) =>
    changePackRelease(
      editor,
      actor,
      target(current, action.stage === 'draft' ? action.pack : current!.pack),
      action,
      send,
    );
  const word = (role: 'curator' | 'maintainer', name: string): PackChange => ({
    stage: 'under-review',
    review: { role, verdict: 'approved', name, note: '' },
  });
  const approved = async (review: PackRelease) =>
    change(await change(review, word('curator', 'Made-up Curator')), word('maintainer', 'Made-up Maintainer'));
  async function published(release = '2026.1', actor: 'curator' | 'ministry' = 'curator') {
    const draft = await change(null, { stage: 'draft', pack: { ...source, release } });
    const review = await change(draft, { stage: 'under-review' });
    return change(await approved(review), { stage: 'published' }, actor);
  }
  return { server, world, editor, made, target, change, published, approved };
}

/** Appends an undecodable batch to the last release stream on the synthetic relay. */
export async function damageLastStream(f: Awaited<ReturnType<typeof packService>>) {
  const upload = f.server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).at(-1)!;
  const body = JSON.parse(upload.body!) as { stream: string; first: number; batches: string[] };
  await f.server.send({
    method: 'POST',
    path: upload.path,
    body: {
      stream: body.stream,
      first: body.first + body.batches.length,
      batches: [Buffer.alloc(4124).toString('base64url')],
    },
  });
}
