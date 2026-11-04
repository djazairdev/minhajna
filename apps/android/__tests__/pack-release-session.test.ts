// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #612 on the existing encrypted demo relay, without a real server or a
// teacher store. It persists the full lifecycle, keeps immutable signed
// publications, bounds a whole write before upload, and refuses real mode,
// another kind of world, other roles and a stale or missing world's date.

import {
  openSigned,
  PACK_BYTES,
  packReleaseKey,
  publishedPackSuccessor,
  sealWorldCalendar,
  toBase64Url,
  worldCalendarFile,
  worldCalendarPlace,
  type Day,
} from '@minhajna/core';
import { packService, reference, source } from '../jest/pack-release';
import { nodeKit } from '../jest/world-server';
import { changePackRelease, readPackReleases } from '../src/editor/pack-release-session';
import { leaveWorldNetwork } from '../src/network/world-network';

afterEach(() => leaveWorldNetwork());

test('the lifecycle survives a reload from the national space, with fixed-size ciphertext only', async () => {
  const f = await packService();
  const initial = await readPackReleases(f.editor, f.server.send);
  expect(initial.size).toBe(0);
  const official = await f.published('2026.1', 'ministry');
  const newer = await f.published('2026.2', 'ministry');
  const superseded = await f.change(official, { stage: 'superseded', by: '2026.2' }, 'ministry');
  const beforeWithdrawal = await readPackReleases(f.editor, f.server.send);
  expect(publishedPackSuccessor(superseded, beforeWithdrawal)).toEqual(newer);
  const withdrawn = await f.change(newer, { stage: 'withdrawn' }, 'ministry');
  const read = await readPackReleases(f.editor, f.server.send);
  expect([...read.values()].map((one) => one.stage)).toEqual(['superseded', 'withdrawn']);
  expect(read.get(packReleaseKey(source.id, '2026.1'))).toEqual(superseded);
  expect(read.get(packReleaseKey(source.id, '2026.2'))).toEqual(withdrawn);
  expect(publishedPackSuccessor(superseded, read)).toBeNull();
  expect(superseded.file).toBe(official.file);
  expect(withdrawn.file).toBe(newer.file);
  expect(official.pack.status).toBe('official');
  expect(source.status).toBe('community');
  const uploads = f.server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches'));
  expect(uploads).toHaveLength(8);
  for (const upload of uploads) {
    const body = JSON.parse(upload.body!) as { batches: string[] };
    expect(body.batches.every((batch) => Buffer.from(batch, 'base64url').length === 4124)).toBe(true);
    expect(upload.body).not.toContain(source.id);
    expect(upload.body).not.toContain('Made-up issuer');
    expect(upload.path).toContain('/spaces/national/batches');
  }
  expect((await openSigned(official.file!, f.made.keys.trusted, nodeKit.verify, PACK_BYTES)).ok).toBe(false);
});

test('a stale edit, direct publication, wrong actor and changed identity write no batches', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  const review = await f.change(draft, { stage: 'under-review' });
  const before = f.server.seen.filter((one) => one.method === 'POST').length;
  await expect(f.change(draft, { stage: 'draft', pack: source })).rejects.toThrow('E_PACK_CHANGED');
  await expect(f.change(draft, { stage: 'published' })).rejects.toThrow('E_PACK_CHANGED');
  await expect(
    changePackRelease(f.editor, 'teacher', f.target(review), { stage: 'published' }, f.server.send),
  ).rejects.toMatchObject({ code: 'E_PACK_ROLE' });
  await expect(
    changePackRelease(
      f.editor,
      'curator',
      f.target(review),
      { stage: 'draft', pack: { ...source, release: '2026.2' } },
      f.server.send,
    ),
  ).rejects.toThrow('E_PACK_SOURCE');
  expect(f.server.seen.filter((one) => one.method === 'POST')).toHaveLength(before);
});

test('an oversized source is refused before creating a space or uploading anything', async () => {
  const f = await packService();
  f.server.seen.length = 0;
  const large = { ...source, provenance: { ...source.provenance, issuer: 'م'.repeat(200000) } };
  await expect(f.change(null, { stage: 'draft', pack: large })).rejects.toThrow('E_PACK_SIZE');
  expect(f.server.seen.every((one) => one.method === 'GET')).toBe(true);
  expect((await readPackReleases(f.editor, f.server.send)).size).toBe(0);
});

test('a draft that fits on its own is refused if the signed publication would be too large', async () => {
  const f = await packService();
  f.server.seen.length = 0;
  const pack = { ...source, provenance: { ...source.provenance, issuer: 'x'.repeat(300_000) } };
  await expect(f.change(null, { stage: 'draft', pack })).rejects.toMatchObject({ code: 'E_PACK_SIZE' });
  expect(f.server.seen.every((one) => one.method === 'GET')).toBe(true);
});

test('a missing signing key is reported as a pack error', async () => {
  const f = await packService();
  const editor = { ...f.editor, held: { ...f.editor.held, keys: { ...f.made.keys, private: {} } } };
  await expect(
    changePackRelease(editor, 'curator', f.target(null), { stage: 'draft', pack: source }, f.server.send),
  ).rejects.toMatchObject({ code: 'E_PACK_SIGNER' });
});

test('real mode and a teachers’ world cannot open the pack editor', async () => {
  const send = jest.fn();
  await expect(
    readPackReleases({ world: null, held: null, profile: reference.profile, kit: nodeKit }, send),
  ).rejects.toMatchObject({
    code: 'E_PACK_WORLD',
  });
  const f = await packService('teachers');
  await expect(readPackReleases(f.editor, send)).rejects.toMatchObject({
    code: 'E_PACK_WORLD',
  });
  expect(send).not.toHaveBeenCalled();
});

test('a missing or moved world date is refused rather than replaced with a guessed day', async () => {
  const f = await packService();
  const old = { ...f.world, date: '2026-09-20' as Day };
  await expect(readPackReleases({ ...f.editor, world: old }, f.server.send)).rejects.toMatchObject({
    code: 'E_PACK_DATE',
  });
  f.server.worlds.delete(f.world.world);
  await expect(readPackReleases(f.editor, f.server.send)).rejects.toMatchObject({
    code: 'E_NO_SUCH_WORLD',
  });
});

test('calendar releases and pack changes coexist in the same national space', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  const place = await worldCalendarPlace(f.made.sealing, nodeKit.mac);
  const file = await worldCalendarFile(
    f.made.keys,
    'world-ministry',
    {
      country: reference.profile.code,
      year: reference.calendar.year.id,
      release: '2026.2',
      published: f.world.date,
      entries: [],
      removed: [],
    },
    nodeKit.sign,
  );
  const batches = await sealWorldCalendar(place, file, 0, nodeKit.cipher);
  const answer = await f.server.send({
    method: 'POST',
    path: `/worlds/${f.world.world}/spaces/national/batches`,
    body: { stream: place.stream, first: 0, batches: batches.map((one) => toBase64Url(one.bytes)) },
  });
  expect(answer.status).toBe(201);
  const review = await f.change(draft, { stage: 'under-review' });
  expect([...(await readPackReleases(f.editor, f.server.send)).values()]).toEqual([review]);
});
