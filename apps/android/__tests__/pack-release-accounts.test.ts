// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A release's steps go through the pack-editor accounts on the server (#612,
// R-4.3-09, answer 767): the Ministry's account publishes Official and no other
// can, a record no account took is refused whoever signed it with the world's
// key, and the server sees a step, never the release. Everything is made up.

import {
  packReleaseKey,
  packReleasePlace,
  preparePackRelease,
  sealPackRelease,
  signPackRelease,
  toBase64Url,
} from '@minhajna/core';
import { packService, source } from '../jest/pack-release';
import { nodeKit } from '../jest/world-server';
import { changePackRelease, readPackEditor, readPackReleases } from '../src/editor/pack-release-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import type { Send } from '../src/demo/world-session';

afterEach(() => leaveWorldNetwork());

const key = packReleaseKey(source.id, source.release);
const stepsOf = (f: Awaited<ReturnType<typeof packService>>) => f.server.packs.store.latestSteps(f.world.world);
const uploads = (f: Awaited<ReturnType<typeof packService>>) =>
  f.server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;

test('the Ministry’s account publishes a curator’s review as Official, and the server says so', async () => {
  const f = await packService();
  const published = await f.published('2026.1', 'ministry');
  expect(published.pack.status).toBe('official');
  expect(published.actor).toBe('ministry');
  const read = await readPackReleases(f.editor, f.server.send);
  expect(read.get(packReleaseKey(source.id, '2026.1'))).toEqual(published);
  const [step] = await stepsOf(f);
  expect(step).toMatchObject({ role: 'ministry', status: 'official', stage: 'published', revision: 5 });
});

test('a device claiming the Ministry with a curator’s token writes nothing', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  const review = await f.approved(await f.change(draft, { stage: 'under-review' }));
  const before = uploads(f);
  const editor = { ...f.editor, accounts: { ministry: f.editor.accounts.curator } };
  await expect(
    changePackRelease(editor, 'ministry', f.target(review), { stage: 'published' }, f.server.send),
  ).rejects.toMatchObject({ code: 'E_PACK_ROLE' });
  expect(uploads(f)).toBe(before);
  expect((await readPackReleases(f.editor, f.server.send)).get(key)?.stage).toBe('under-review');
});

test('with no account of the role, nothing is asked of the server', async () => {
  const f = await packService();
  const before = f.server.seen.length;
  await expect(
    changePackRelease(
      { ...f.editor, accounts: {} },
      'curator',
      f.target(null),
      { stage: 'draft', pack: source },
      f.server.send,
    ),
  ).rejects.toMatchObject({ code: 'E_PACK_ROLE' });
  expect(f.server.seen.slice(before)).toEqual([]);
});

test('a record signed with the world’s key but no account’s step is refused on reading', async () => {
  const f = await packService();
  const scope = { world: f.world.world, day: f.world.date, actor: 'ministry' as const, expected: 0 };
  const forged = preparePackRelease(null, { stage: 'draft', pack: { ...source, status: 'official' } }, scope);
  const { file } = await signPackRelease(forged, f.made.keys, nodeKit.sign);
  const place = await packReleasePlace(f.made.sealing, nodeKit.mac);
  const sealed = await sealPackRelease(place, file, 0, nodeKit.cipher);
  await f.server.send({ method: 'PUT', path: `/worlds/${f.world.world}/spaces/national`, body: { kind: 'national' } });
  await f.server.send({
    method: 'POST',
    path: `/worlds/${f.world.world}/spaces/national/batches`,
    body: { stream: place.stream, first: 0, batches: sealed.map((one) => toBase64Url(one.bytes)) },
  });
  expect((await readPackReleases(f.editor, f.server.send)).size).toBe(0);
  const desk = await readPackEditor(f.editor, f.server.send);
  expect(desk.damaged).toBe(true);
  expect(desk.records.size).toBe(0);
});

test('the server sees the step’s names and a digest, never the release', async () => {
  const f = await packService();
  await f.change(null, { stage: 'draft', pack: source });
  const steps = f.server.seen.filter((one) => one.path.endsWith('/packs/steps'));
  expect(steps).toHaveLength(1);
  for (const said of [source.provenance.issuer, source.items[0].title]) expect(steps[0].body).not.toContain(said);
  expect(JSON.stringify(await stepsOf(f))).not.toContain(source.provenance.issuer);
});

test('a step left unused holds no other account back', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  const review = await f.approved(await f.change(draft, { stage: 'under-review' }));
  const failing: Send = (request) =>
    request.path.endsWith('/batches')
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : f.server.send(request);
  const edit = { stage: 'draft' as const, pack: { ...source, language: 'fr' } };
  await expect(changePackRelease(f.editor, 'curator', f.target(review), edit, failing)).rejects.toBeDefined();
  const published = await f.change(review, { stage: 'published' }, 'ministry');
  expect(published.pack.status).toBe('official');
  expect((await readPackReleases(f.editor, f.server.send)).get(key)).toEqual(published);
});

test('a moved date and a revision the server never took are told apart', async () => {
  const f = await packService();
  const answering =
    (problem: string): Send =>
    (request) =>
      request.path.endsWith('/packs/steps')
        ? Promise.resolve({ status: 409, body: { problem }, retryAfter: null })
        : f.server.send(request);
  const draft = { stage: 'draft' as const, pack: source };
  await expect(changePackRelease(f.editor, 'curator', f.target(null), draft, answering('date'))).rejects.toMatchObject({
    code: 'E_PACK_DATE',
  });
  await expect(
    changePackRelease(f.editor, 'curator', f.target(null), draft, answering('revision')),
  ).rejects.toMatchObject({ code: 'E_PACK_CHANGED' });
});

test('a step whose upload failed is taken again, and holds nothing back', async () => {
  const f = await packService();
  const failing: Send = (request) =>
    request.path.endsWith('/batches')
      ? Promise.resolve({ status: 500, body: null, retryAfter: null })
      : f.server.send(request);
  const draft = { stage: 'draft' as const, pack: source };
  await expect(changePackRelease(f.editor, 'curator', f.target(null), draft, failing)).rejects.toBeDefined();
  expect((await stepsOf(f))[0].revision).toBe(1);
  const saved = await changePackRelease(f.editor, 'curator', f.target(null), draft, f.server.send);
  expect(saved.revision).toBe(1);
  expect((await readPackReleases(f.editor, f.server.send)).get(key)).toEqual(saved);
});
