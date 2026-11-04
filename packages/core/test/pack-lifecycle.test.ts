// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #612's state transitions and immutable source content. Every pack and
// role is made up; no test treats a demo role as a real authority.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { preparePackRelease, type Day, type PackChange, type PackPublisher } from '../src/index.ts';
import { day, fixture, source, world } from './pack-lifecycle-fixtures.ts';

describe('the pack release lifecycle', () => {
  it('keeps source status apart from lifecycle and returns an edited review to draft', async () => {
    const f = fixture();
    const draft = await f.change(null, { stage: 'draft', pack: source });
    const review = await f.change(draft, { stage: 'under-review' });
    const edited = await f.change(review, { stage: 'draft', pack: { ...source, status: 'latest-found' } });
    assert.equal(draft.revision, 1);
    assert.equal(review.stage, 'under-review');
    assert.equal(edited.stage, 'draft');
    assert.equal(edited.revision, 3);
    assert.equal(edited.pack.status, 'latest-found');
    assert.equal(review.pack.status, 'community');
    await assert.rejects(f.change(edited, { stage: 'published' }), /E_PACK_STAGE/);
  });

  it('publishes a curator’s classification unchanged and the Ministry demo role as Official', async () => {
    const f = fixture();
    const community = await f.published();
    const official = await f.published('2026.2', 'ministry');
    assert.equal(community.pack.status, 'community');
    assert.equal(official.pack.status, 'official');
    assert.equal(official.actor, 'ministry');
    assert.notEqual(official.file, null);
    assert.equal(source.status, 'community');
    await assert.rejects(f.change(null, { stage: 'draft', pack: { ...source, status: 'official' } }), /E_PACK_SOURCE/);
  });

  it('cannot edit a publication, bypass review or withdraw another publishing role’s release', async () => {
    const f = fixture();
    const draft = await f.change(null, { stage: 'draft', pack: source });
    await assert.rejects(f.change(draft, { stage: 'published' }), /E_PACK_STAGE/);
    const official = await f.published('2026.2', 'ministry');
    for (const change of [
      { stage: 'draft', pack: official.pack },
      { stage: 'under-review' },
      { stage: 'published' },
      { stage: 'withdrawn' },
    ] as const)
      await assert.rejects(f.change(official, change), RangeError);
    const withdrawn = await f.change(official, { stage: 'withdrawn' }, 'ministry');
    assert.equal(withdrawn.stage, 'withdrawn');
    assert.equal(withdrawn.file, official.file);
    assert.deepEqual(withdrawn.pack, official.pack);
    await assert.rejects(f.change(withdrawn, { stage: 'draft', pack: source }, 'ministry'), /E_PACK_STAGE/);
  });

  it('requires a newer published release of the same pack and publisher to supersede one', async () => {
    const f = fixture();
    const older = await f.published();
    const newer = await f.published('2026.10');
    for (const wrong of [
      null,
      older,
      { ...newer, stage: 'draft' as const },
      { ...newer, file: null },
      { ...newer, world: 'FGHJK' },
      { ...newer, actor: 'ministry' as const },
      { ...newer, pack: { ...newer.pack, id: 'dz.cem.2am.math.example' } },
      { ...newer, day: '2026-11-02' as Day },
    ])
      await assert.rejects(
        f.change(older, { stage: 'superseded', by: '2026.10' }, 'curator', wrong),
        /E_PACK_SUCCESSOR/,
      );
    const replaced = await f.change(older, { stage: 'superseded', by: '2026.10' }, 'curator', newer);
    assert.equal(replaced.supersededBy, '2026.10');
    assert.equal(replaced.file, older.file);
    assert.deepEqual(replaced.pack, older.pack);
  });

  it('refuses stale revisions, clock times, backwards dates, other worlds and unsupported roles', async () => {
    const f = fixture();
    const draft = await f.change(null, { stage: 'draft', pack: source });
    const scope = { world, day, actor: 'curator' as const, expected: 1 };
    for (const wrong of [
      { ...scope, expected: 0 },
      { ...scope, expected: -1 },
      { ...scope, expected: 1.5 },
      { ...scope, day: '2026-11-01T12:00:00Z' as Day },
      { ...scope, day: '2026-10-31' as Day },
      { ...scope, world: 'FGHJK' },
      { ...scope, actor: 'teacher' as PackPublisher },
    ])
      assert.throws(() => preparePackRelease(draft, { stage: 'under-review' }, wrong), RangeError);
    assert.throws(
      () => preparePackRelease(draft, { stage: 'unknown' } as unknown as PackChange, scope),
      /E_PACK_STAGE/,
    );
    assert.throws(
      () => preparePackRelease(draft, { stage: 'draft', pack: { ...source, release: '2026.2' } }, scope),
      /E_PACK_STAGE/,
    );
    assert.throws(
      () => preparePackRelease(null, { stage: 'draft', pack: { ...source, status: 'own' } }, { ...scope, expected: 0 }),
      /E_PACK_SOURCE/,
    );
  });
});
