// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Release review identifies missing source details and invalid migrations,
// and never reads as clean what it could not check. All packs and sources are
// made up.

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
const noDetails = { pack: [], items: [] };
const firstRelease = {
  status: 'checked',
  previous: null,
  migrations: [],
  changes: [],
  details: noDetails,
  findings: [],
};
const invalid = (problem: string, release: string, items: readonly string[] = []) => ({
  ...firstRelease,
  findings: [{ kind: 'invalid-migration', problem, release, items }],
});
const compare = (draft: unknown, history: readonly PlanPack[] | null) =>
  checkPackReleaseReview(draft, history, null).comparison;

describe('pack release review checks', () => {
  it('accepts a cited first release and reports all items without a usable page', () => {
    assert.deepEqual(checkPackReleaseReview(first, [], null), {
      source: { status: 'checked', findings: [] },
      comparison: firstRelease,
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
    assert.deepEqual(checkPackReleaseReview(draft, [], null).source, {
      status: 'checked',
      findings: [
        { kind: 'missing-source-page', items: ['one'] },
        { kind: 'invalid-source-page', items: ['two'] },
      ],
    });
  });

  it('reports the underlying field errors when provenance, status or licence is missing', () => {
    const review = checkPackReleaseReview(
      { ...first, provenance: { issuer: 'Made-up publisher' }, status: undefined, licence: undefined },
      [],
      null,
    );
    assert.deepEqual(review.comparison, { status: 'not-checked', reason: 'invalid-pack' });
    assert.deepEqual(review.weeks, { status: 'not-checked', reason: 'invalid-pack' });
    assert.deepEqual(review.source, {
      status: 'not-checked',
      reason: 'invalid-pack',
      problems: [
        { path: 'status', problem: 'required' },
        { path: 'licence', problem: 'required' },
        { path: 'provenance.edition', problem: 'required' },
      ],
    });
  });

  it('accepts a title correction under the same ID and ignores another pack in the history', () => {
    const draft = {
      ...first,
      release: '2026.2',
      items: [{ ...first.items[0]!, title: 'Corrected sample title' }, first.items[1]!],
    };
    const unrelated = { ...first, id: 'dz.cem.1am.math.unrelated', release: '2026.3' };
    assert.deepEqual(compare(draft, [unrelated, first]), {
      status: 'checked',
      previous: first,
      migrations: [],
      changes: [{ kind: 'title', from: first.items[0], to: draft.items[0] }],
      details: noDetails,
      findings: [],
    });
  });

  it('names what the teachers summary leaves out', () => {
    const draft = {
      ...first,
      release: '2026.2',
      licence: 'link-only' as const,
      items: [first.items[1]!, { ...first.items[0]!, budget: 9, sourcePage: 88, kind: 'td' as const }],
    };
    const comparison = compare(draft, [first]);
    assert.ok(comparison.status === 'checked');
    assert.deepEqual(comparison.changes, []);
    assert.deepEqual(comparison.details, {
      pack: ['licence', 'order'],
      items: [{ item: 'one', fields: ['kind', 'budget', 'sourcePage'] }],
    });
  });

  it('follows a renamed item into its details, and names the ID a missing entry leaves', () => {
    const renamed = {
      ...first,
      release: '2026.2',
      items: [{ ...first.items[0]!, id: 'one-b', week: 3 }, first.items[1]!],
      migration: { from: '2026.1', entries: [{ kind: 'rename', from: 'one', to: 'one-b' }] },
    };
    const comparison = compare(renamed, [first]);
    assert.ok(comparison.status === 'checked');
    assert.deepEqual(comparison.details.items, [{ item: 'one-b', fields: ['week'] }]);
    assert.deepEqual(compare({ ...renamed, migration: undefined }, [first]), invalid('broken', '2026.2', ['one']));
  });

  it('requires an entry for a removed ID and accepts a split from the previous release', () => {
    const split = {
      ...first,
      release: '2026.2',
      items: [{ ...first.items[0]!, id: 'one-a' }, { ...first.items[0]!, id: 'one-b' }, first.items[1]!],
    };
    assert.deepEqual(compare(split, [first]), invalid('broken', '2026.2', ['one']));
    const entries = [{ kind: 'split', from: 'one', to: ['one-a', 'one-b'] }];
    assert.deepEqual(compare({ ...split, migration: { from: '2026.1', entries } }, [first]), {
      status: 'checked',
      previous: first,
      migrations: entries,
      changes: [{ kind: 'split', from: first.items[0], to: split.items.slice(0, 2) }],
      details: noDetails,
      findings: [],
    });
  });

  it('reports a missing predecessor instead of treating the draft as a first release', () => {
    const draft = { ...first, release: '2026.2', migration: { from: '2026.1', entries: [] } };
    assert.deepEqual(compare(draft, []), invalid('missing', '2026.1'));
    assert.deepEqual(compare({ ...first, release: '2026.3' }, [draft]), invalid('missing', '2026.1'));
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
    assert.deepEqual(compare(reused, [previous, first]), invalid('broken', '2026.3', ['one']));
    assert.deepEqual(compare(skipped, [previous, first]), invalid('broken', '2026.3'));
  });

  it('catches an ID reused across a known release the history skipped', () => {
    const x = { id: 'x', kind: 'lesson', title: 'Sample X', budget: 1, sourcePage: 3 } as const;
    const withX = { ...first, release: '2026.2', items: [...first.items, x] };
    const skipper = { ...first, release: '2026.3', migration: { from: '2026.1', entries: [] } };
    const draft = { ...first, release: '2026.4', items: [...first.items, { ...x, title: 'Another sample' }] };
    assert.deepEqual(compare(draft, [first, withX, skipper]), invalid('broken', '2026.4', ['x']));
  });

  it('refuses a draft at or before a release the history holds', () => {
    const later = { ...first, release: '2026.3' };
    assert.deepEqual(compare(first, [first]), invalid('not-newer', '2026.1'));
    assert.deepEqual(compare(first, [later]), invalid('not-newer', '2026.3'));
    assert.deepEqual(compare({ ...first, release: '2026.2' }, [first, later]), invalid('not-newer', '2026.3'));
  });

  it('reports a release number skipped within a year, without stopping the comparison', () => {
    assert.deepEqual(compare({ ...first, release: '2026.3' }, [first]), {
      ...compare({ ...first, release: '2026.2' }, [first]),
      findings: [{ kind: 'invalid-migration', problem: 'missing', release: '2026.2', items: [] }],
    });
    const nextYear = compare({ ...first, release: '2027.3' }, [first]);
    assert.ok(nextYear.status === 'checked');
    assert.deepEqual(nextYear.findings, []);
    const gap = { ...first, release: '2026.3', migration: { from: '2026.1', entries: [] } };
    const dropped = { ...first, release: '2026.4', items: [first.items[1]!] };
    const stuck = compare(dropped, [first, gap]);
    assert.ok(stuck.status === 'checked');
    assert.deepEqual(stuck.findings, [
      { kind: 'invalid-migration', problem: 'missing', release: '2026.2', items: [] },
      { kind: 'invalid-migration', problem: 'broken', release: '2026.4', items: ['one'] },
    ]);
  });

  it('leaves weeks not applicable on a hybrid pack, whatever the horizon', () => {
    const hybrid = { ...first, anchor: { kind: 'hybrid', unit: 'hours' } };
    assert.deepEqual(checkPackReleaseReview(hybrid, [], 3).weeks, { status: 'not-applicable' });
  });

  it('distinguishes an unavailable history from a known first release', () => {
    assert.deepEqual(compare(first, null), { status: 'not-checked', reason: 'missing-history' });
  });

  it('checks source weeks only once an explicit valid horizon is supplied', () => {
    const week = {
      ...languagePack,
      items: [{ id: 'one', kind: 'lesson', title: 'Made-up lesson', week: 1, sourcePage: 1 }],
      activities: undefined,
      merges: [],
    };
    const invalidHorizon = { status: 'not-checked', reason: 'invalid-horizon' };
    assert.deepEqual(checkPackReleaseReview(week, [], null).weeks, {
      status: 'not-checked',
      reason: 'missing-horizon',
    });
    assert.deepEqual(checkPackReleaseReview(week, [], 0).weeks, invalidHorizon);
    assert.deepEqual(checkPackReleaseReview(week, [], 1.5).weeks, invalidHorizon);
    assert.deepEqual(checkPackReleaseReview(week, [], 2).weeks, {
      status: 'checked',
      findings: [{ kind: 'missing-weeks', week: 2, through: 2, items: [] }],
    });
  });
});
