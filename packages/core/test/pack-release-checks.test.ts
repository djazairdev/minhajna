// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Release review identifies missing source details and invalid migrations
// without changing the editor's drafts. All packs and sources are made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPackReleaseReview, parsePlanPack, type PlanPack } from '../src/index.ts';
import { languagePack, mathPack } from './fixtures.ts';

const first: PlanPack = {
  ...mathPack,
  release: '2026.1',
  items: [
    { id: 'one', kind: 'lesson', title: 'First sample lesson', budget: 1, sourcePage: 1 },
    { id: 'two', kind: 'lesson', title: 'Second sample lesson', budget: 1, sourcePage: 2 },
  ],
  merges: [],
};

describe('pack release review checks', () => {
  it('accepts a cited first release and reports all items without a usable page', () => {
    assert.deepEqual(checkPackReleaseReview(first, [], null), {
      source: [],
      comparison: { status: 'first-release' },
      weeks: { status: 'not-applicable' },
    });
    const draft = {
      ...first,
      items: [
        { ...first.items[0]!, sourcePage: undefined },
        { ...first.items[1]!, sourcePage: Number.MAX_SAFE_INTEGER + 1 },
      ],
    };
    assert.ok(parsePlanPack(draft).ok);
    assert.deepEqual(checkPackReleaseReview(draft, [], null).source, [
      { kind: 'missing-source-page', items: ['one'] },
      { kind: 'invalid-source-page', items: ['two'] },
    ]);
  });

  it('reports the underlying field errors when provenance, status or licence is missing', () => {
    const review = checkPackReleaseReview(
      { ...first, provenance: { issuer: 'Made-up publisher' }, status: undefined, licence: undefined },
      [],
      null,
    );
    assert.deepEqual(review.comparison, { status: 'not-checked', reason: 'invalid-pack' });
    assert.deepEqual(review.weeks, { status: 'not-checked', reason: 'invalid-pack' });
    assert.deepEqual(review.source, [
      {
        kind: 'invalid-pack',
        problems: [
          { path: 'status', problem: 'required' },
          { path: 'licence', problem: 'required' },
          { path: 'provenance.edition', problem: 'required' },
        ],
      },
    ]);
  });

  it('accepts a title correction under the same ID and ignores another pack in the history', () => {
    const draft = {
      ...first,
      release: '2026.2',
      items: [{ ...first.items[0]!, title: 'Corrected sample title' }, first.items[1]!],
    };
    const unrelated = { ...first, id: 'dz.cem.1am.math.unrelated', release: '2026.1' };
    const { comparison } = checkPackReleaseReview(draft, [unrelated, first], null);
    assert.deepEqual(comparison, {
      status: 'compared',
      previous: first,
      migrations: [],
      changes: [{ kind: 'title', from: first.items[0], to: draft.items[0] }],
    });
  });

  it('requires an entry for a removed ID and accepts a split from the previous release', () => {
    const split = {
      ...first,
      release: '2026.2',
      items: [{ ...first.items[0]!, id: 'one-a' }, { ...first.items[0]!, id: 'one-b' }, first.items[1]!],
    };
    assert.deepEqual(checkPackReleaseReview(split, [first], null).comparison, {
      status: 'invalid-migration',
      problem: 'broken',
      release: '2026.2',
    });
    const entries = [{ kind: 'split', from: 'one', to: ['one-a', 'one-b'] }];
    assert.deepEqual(
      checkPackReleaseReview({ ...split, migration: { from: '2026.1', entries } }, [first], null).comparison,
      {
        status: 'compared',
        previous: first,
        migrations: entries,
        changes: [{ kind: 'split', from: first.items[0], to: split.items.slice(0, 2) }],
      },
    );
  });

  it('reports a missing predecessor instead of treating the draft as a first release', () => {
    const draft = { ...first, release: '2026.2', migration: { from: '2026.1', entries: [] } };
    assert.deepEqual(checkPackReleaseReview(draft, [], null).comparison, {
      status: 'invalid-migration',
      problem: 'missing',
      release: '2026.1',
    });
  });

  it('catches retired IDs and refuses migrations that skip a known preceding release', () => {
    const previous: PlanPack = {
      ...first,
      release: '2026.2',
      items: [first.items[1]!],
      migration: { from: '2026.1', entries: [{ kind: 'remove', item: 'one' }] },
    };
    const reused = { ...first, release: '2026.3' };
    const skipped = {
      ...previous,
      release: '2026.3',
      migration: { from: '2026.1', entries: [{ kind: 'remove', item: 'one' }] },
    };
    const finding = { status: 'invalid-migration', problem: 'broken', release: '2026.3' };
    assert.deepEqual(checkPackReleaseReview(reused, [previous, first], null).comparison, finding);
    assert.deepEqual(checkPackReleaseReview(skipped, [previous, first], null).comparison, finding);
  });

  it('distinguishes an unavailable history from a known first release', () => {
    assert.deepEqual(checkPackReleaseReview(first, null, null).comparison, {
      status: 'not-checked',
      reason: 'missing-history',
    });
  });

  it('checks source weeks only once an explicit valid horizon is supplied', () => {
    const week = {
      ...languagePack,
      items: [{ id: 'one', kind: 'lesson', title: 'Made-up lesson', week: 1, sourcePage: 1 }],
      activities: undefined,
      merges: [],
    };
    assert.deepEqual(checkPackReleaseReview(week, [], null).weeks, {
      status: 'not-checked',
      reason: 'missing-horizon',
    });
    assert.deepEqual(checkPackReleaseReview(week, [], 0).weeks, {
      status: 'not-checked',
      reason: 'invalid-horizon',
    });
    assert.deepEqual(checkPackReleaseReview(week, [], 2).weeks, {
      status: 'checked',
      findings: [{ kind: 'missing-weeks', week: 2, through: 2, items: [] }],
    });
  });
});
