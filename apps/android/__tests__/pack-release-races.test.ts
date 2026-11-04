// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #612's append conflicts on a made-up relay: a competing edit of this
// release is refused, another release can append first, and an accepted
// upload whose answer is lost is recognised without a duplicate version.

import { packReleaseKey } from '@minhajna/core';
import { damageLastStream, packService, source } from '../jest/pack-release';
import type { Send } from '../src/demo/world-session';
import { readPackReleases } from '../src/editor/pack-release-session';
import { leaveWorldNetwork } from '../src/network/world-network';

afterEach(() => leaveWorldNetwork());

test('a competing edit cannot be overwritten after the relay reports a conflict', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  let raced = false;
  const send: Send = async (request) => {
    if (!raced && request.method === 'POST' && request.path.endsWith('/batches')) {
      raced = true;
      await f.change(draft, { stage: 'draft', pack: { ...source, status: 'latest-found' } });
    }
    return f.server.send(request);
  };
  await expect(f.change(draft, { stage: 'under-review' }, 'curator', send)).rejects.toThrow('E_PACK_CHANGED');
  const read = await readPackReleases(f.editor, f.server.send);
  expect(read.get(packReleaseKey(source.id, source.release))).toMatchObject({
    stage: 'draft',
    revision: 2,
    pack: { status: 'latest-found' },
  });
});

test('another pack can append first without losing this release’s change', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  let raced = false;
  const send: Send = async (request) => {
    if (!raced && request.method === 'POST' && request.path.endsWith('/batches')) {
      raced = true;
      await f.change(null, { stage: 'draft', pack: { ...source, release: '2026.2' } });
    }
    return f.server.send(request);
  };
  const review = await f.change(draft, { stage: 'under-review' }, 'curator', send);
  expect(review).toMatchObject({ revision: 2, stage: 'under-review' });
  expect((await readPackReleases(f.editor, f.server.send)).size).toBe(2);
});

test('an accepted write reported as a conflict is found once on retry', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  let answered = false;
  const send: Send = async (request) => {
    const answer = await f.server.send(request);
    if (!answered && request.method === 'POST' && request.path.endsWith('/batches')) {
      answered = true;
      return { status: 409, body: { error: 'taken' }, retryAfter: null };
    }
    return answer;
  };
  const review = await f.change(draft, { stage: 'under-review' }, 'curator', send);
  expect(review.revision).toBe(2);
  const uploads = f.server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches'));
  expect(uploads).toHaveLength(2);
});

test('a damaged stream cannot be treated as an editable earlier version', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  await damageLastStream(f);
  const before = f.server.seen.filter((one) => one.method === 'POST').length;
  expect((await readPackReleases(f.editor, f.server.send)).get(packReleaseKey(source.id, source.release))).toEqual(
    draft,
  );
  await expect(f.change(draft, { stage: 'under-review' })).rejects.toMatchObject({ code: 'E_PACK_HISTORY' });
  expect(f.server.seen.filter((one) => one.method === 'POST')).toHaveLength(before);
});

test('damage arriving between reads keeps its history error code', async () => {
  const f = await packService();
  const draft = await f.change(null, { stage: 'draft', pack: source });
  const send: Send = async (request) => {
    if (request.method === 'PUT' && request.path.endsWith('/national')) await damageLastStream(f);
    return f.server.send(request);
  };
  await expect(f.change(draft, { stage: 'under-review' }, 'curator', send)).rejects.toMatchObject({
    code: 'E_PACK_HISTORY',
  });
});
