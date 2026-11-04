// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a release review's comparison reports: the IDs a misfit entry gets
// wrong, a whole chain, and the fields left to its details. All packs are made
// up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPackReleaseReview, type PlanPack } from '../src/index.ts';
import { mathPack } from './fixtures.ts';

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
const invalid = (problem: string, release: string, items: readonly string[] = []) => ({
  status: 'checked',
  previous: null,
  migrations: [],
  changes: [],
  details: noDetails,
  findings: [{ kind: 'invalid-migration', problem, release, items }],
});
const finding = (problem: string, release: string, items: readonly string[] = []) => ({
  kind: 'invalid-migration',
  problem,
  release,
  items,
});
const compare = (draft: unknown, history: readonly PlanPack[] | null) =>
  checkPackReleaseReview(draft, history, null).comparison;

describe('a pack release comparison', () => {
  it('reports a missing release once, when a gap and a migration name the same one', () => {
    const draft = { ...first, release: '2026.3', migration: { from: '2026.2', entries: [] } };
    assert.deepEqual(compare(draft, [first]), invalid('missing', '2026.2'));
  });

  it('keeps a gap beside a chain that fails', () => {
    const gap = { kind: 'invalid-migration', problem: 'missing', release: '2026.2', items: [] };
    const x = { id: 'x', kind: 'lesson', title: 'Sample X', budget: 1, sourcePage: 3 } as const;
    const third = { ...first, release: '2026.3', items: [...first.items, x] };
    const remove = { from: '2026.3', entries: [{ kind: 'remove' as const, item: 'x' }] };
    const fourth = { ...first, release: '2026.4', migration: remove };
    const back = { ...third, release: '2026.5', migration: undefined };
    const reused = compare(back, [first, third, fourth]);
    assert.ok(reused.status === 'checked');
    assert.deepEqual(reused.findings, [
      gap,
      { kind: 'invalid-migration', problem: 'broken', release: '2026.5', items: ['x'] },
    ]);
    const ghost = { from: '2026.1', entries: [{ kind: 'remove' as const, item: 'ghost' }] };
    const misfit = { ...first, release: '2026.3', migration: ghost };
    const chain = compare({ ...first, release: '2026.4' }, [first, misfit]);
    assert.ok(chain.status === 'checked');
    assert.deepEqual(chain.findings, [
      gap,
      { kind: 'invalid-migration', problem: 'broken', release: '2026.3', items: ['ghost'] },
    ]);
  });

  it('keeps a gap beside an ID that the chain walks past', () => {
    const x = { id: 'x', kind: 'lesson', title: 'Sample X', budget: 1, sourcePage: 3 } as const;
    const withX = { ...first, release: '2026.2', items: [...first.items, x] };
    const skipper = { ...first, release: '2026.4', migration: { from: '2026.1', entries: [] } };
    const draft = { ...first, release: '2026.5', items: [...first.items, { ...x, title: 'Another sample' }] };
    const result = compare(draft, [first, withX, skipper]);
    assert.ok(result.status === 'checked');
    assert.deepEqual(result.findings, [finding('missing', '2026.3'), finding('broken', '2026.5', ['x'])]);
  });

  it('reports a missing release once when a published release names it', () => {
    const named = { ...first, release: '2026.3', migration: { from: '2026.2', entries: [] } };
    const result = compare({ ...first, release: '2026.4' }, [first, named]);
    assert.ok(result.status === 'checked');
    assert.deepEqual(result.findings, [finding('missing', '2026.2')]);
  });

  it('drops a removed member from a longer merge before comparing', () => {
    const three = { id: 'three', kind: 'lesson', title: 'Third', budget: 1, sourcePage: 3 } as const;
    const before = { ...first, items: [...first.items, three], merges: [['one', 'two', 'three']] };
    const after = {
      ...before,
      release: '2026.2',
      items: [first.items[1]!, three],
      merges: [['two', 'three']],
      migration: { from: '2026.1', entries: [{ kind: 'remove', item: 'one' }] },
    };
    const result = compare(after, [before]);
    assert.ok(result.status === 'checked');
    assert.deepEqual(result.details.pack, []);
  });

  it('follows a merge through a split to its first part', () => {
    const before = { ...first, merges: [['one', 'two']] };
    const split = { ...first.items[0]!, id: 'one-a', budget: 5 };
    const after = {
      ...before,
      release: '2026.2',
      items: [split, { ...first.items[0]!, id: 'one-b', budget: 2 }, first.items[1]!],
      merges: [['one-a', 'two']],
      migration: { from: '2026.1', entries: [{ kind: 'split', from: 'one', to: ['one-a', 'one-b'] }] },
    };
    const comparison = compare(after, [before]);
    assert.ok(comparison.status === 'checked');
    assert.deepEqual(comparison.details, noDetails);
    const removed = {
      ...before,
      release: '2026.2',
      items: [first.items[1]!],
      merges: [],
      migration: { from: '2026.1', entries: [{ kind: 'remove', item: 'one' }] },
    };
    const gone = compare(removed, [before]);
    assert.ok(gone.status === 'checked');
    assert.deepEqual(gone.details.pack, ['merges']);
  });

  it('names the IDs an entry that does not fit gets wrong', () => {
    const unknown = {
      ...first,
      release: '2026.2',
      migration: { from: '2026.1', entries: [{ kind: 'remove', item: 'zzz' }] },
    };
    assert.deepEqual(compare(unknown, [first]), invalid('broken', '2026.2', ['zzz']));
    const td = { ...first.items[1]!, id: 'two-td', kind: 'td' as const };
    const mixed = {
      ...first,
      release: '2026.2',
      items: [first.items[0]!, td],
      migration: { from: '2026.1', entries: [{ kind: 'rename', from: 'two', to: 'two-td' }] },
    };
    assert.deepEqual(compare(mixed, [first]), invalid('broken', '2026.2', ['two']));
  });

  it('leaves a unit and merges that only followed their IDs out of the details', () => {
    const unit = { id: 'u', kind: 'unit', title: 'Sample unit', sourcePage: 1 } as const;
    const before = {
      ...first,
      items: [unit, { ...first.items[0]!, unit: 'u' }, first.items[1]!],
      merges: [['one', 'two']],
    };
    const after = {
      ...before,
      release: '2026.2',
      items: [{ ...unit, id: 'v' }, { ...first.items[0]!, id: 'one-b', unit: 'v' }, first.items[1]!],
      merges: [['one-b', 'two']],
      migration: {
        from: '2026.1',
        entries: [
          { kind: 'rename', from: 'u', to: 'v' },
          { kind: 'rename', from: 'one', to: 'one-b' },
        ],
      },
    };
    const comparison = compare(after, [before]);
    assert.ok(comparison.status === 'checked');
    assert.deepEqual(comparison.findings, []);
    assert.deepEqual(comparison.details, noDetails);
    const moved = compare(
      { ...after, items: [after.items[0]!, { ...after.items[1]!, unit: undefined }, after.items[2]!] },
      [before],
    );
    assert.ok(moved.status === 'checked');
    assert.deepEqual(moved.details.items, [{ item: 'one-b', fields: ['unit'] }]);
  });

  it('walks a whole chain and follows a merge into its details', () => {
    const [one, two] = first.items as [PlanPack['items'][0], PlanPack['items'][0]];
    const second: PlanPack = { ...first, release: '2026.2', items: [one, two, { ...two, id: 'three' }] };
    const merged = {
      ...first,
      release: '2026.3',
      items: [
        { ...one, id: 'both' },
        { ...two, id: 'three', budget: 2 },
      ],
    };
    const draft = {
      ...merged,
      migration: { from: '2026.2', entries: [{ kind: 'merge', from: ['one', 'two'], to: 'both' }] },
    };
    const result = compare(draft, [first, second]);
    assert.ok(result.status === 'checked');
    assert.deepEqual(result.findings, []);
    assert.equal(result.previous?.release, '2026.2');
    assert.deepEqual(result.migrations, draft.migration.entries);
    assert.deepEqual(result.details.items, [{ item: 'three', fields: ['budget'] }]);
  });
});
