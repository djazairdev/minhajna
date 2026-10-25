// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Migration entries (#322, answer 487): a release reads how its item IDs came
// from an earlier one, refusing an old ID it still has, a new ID it lacks, an
// ID in two entries and a release that is not earlier; the releases from a
// class's release to a newer one chain through each release's `from`, or the
// release before it, and name the one the phone lacks; and the entries compose,
// so an old ID is followed to where it is now. Made-up packs only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { followId, parsePlanPack, releaseChain, type PlanPack, type ReleaseChain } from '../src/index.ts';
import { mathPack, mathPackSource } from './fixtures.ts';

type Source = typeof mathPackSource;
type RawItem = Source['items'][number];

function edit(items: readonly RawItem[], changes: Record<string, readonly string[]>): RawItem[] {
  return items.flatMap((item) => {
    const into = changes[item.id];
    if (into === undefined) return [item];
    return into.map((id) => ({ ...item, id, title: `${item.title} ${id}` }));
  });
}

const second = {
  ...mathPackSource,
  release: '2026.2',
  merges: [],
  items: edit(mathPackSource.items, { l1: ['l1b'], l2: ['l2a', 'l2b'], l5: ['l56'], l6: [], l7: [] }),
  migration: {
    from: '2026.1',
    entries: [
      { kind: 'rename', from: 'l1', to: 'l1b' },
      { kind: 'split', from: 'l2', to: ['l2a', 'l2b'] },
      { kind: 'merge', from: ['l5', 'l6'], to: 'l56' },
      { kind: 'remove', item: 'l7' },
    ],
  },
};

function read(source: unknown): PlanPack {
  const result = parsePlanPack(source);
  assert.ok(result.ok, JSON.stringify(result.ok ? [] : result.problems));
  return result.value;
}

function problems(migration: unknown): unknown {
  const result = parsePlanPack({ ...second, migration });
  return result.ok ? [] : result.problems;
}

describe('migration entries', () => {
  it('reads a release with its entries', () => {
    assert.deepEqual(read(second).migration, second.migration);
    assert.equal(mathPack.migration, undefined);
  });

  it('refuses entries that do not fit the release', () => {
    const entries = second.migration.entries;
    assert.deepEqual(problems({ from: '2026.2', entries }), [{ path: 'migration.from', problem: 'invalid' }]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'rename', from: 'l3', to: 'l1b' }] }), [
      { path: 'migration.entries[0]', problem: 'invalid' },
    ]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'rename', from: 'l1', to: 'l9' }] }), [
      { path: 'migration.entries[0]', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(problems({ from: '2026.1', entries: [...entries, { kind: 'rename', from: 'l7', to: 'l1b' }] }), [
      { path: 'migration.entries[4]', problem: 'duplicate' },
    ]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'split', from: 'l2', to: ['l2a'] }] }), [
      { path: 'migration.entries[0].to', problem: 'invalid' },
    ]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'copy', from: 'l2', to: 'l2a' }] }), [
      { path: 'migration.entries[0].kind', problem: 'invalid' },
    ]);
    assert.deepEqual(problems({ from: '2026.1' }), [{ path: 'migration.entries', problem: 'required' }]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'rename', to: 'l1b' }] }), [
      { path: 'migration.entries[0].from', problem: 'required' },
    ]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'split', from: 'l2', to: ['u1x', 'l2a'] }] }), [
      { path: 'migration.entries[0]', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(problems({ from: '2026.1', entries: [{ kind: 'split', from: 'l2', to: ['u2', 'l2a'] }] }), [
      { path: 'migration.entries[0]', problem: 'invalid' },
    ]);
  });

  it('chains releases through their entries, or the release before them', () => {
    const fix = read(second);
    const third = read({ ...second, release: '2027.1', migration: undefined });
    const releases = (chain: ReleaseChain) =>
      chain.ok ? chain.steps.map((step) => `${step.before.release}>${step.after.release}`) : chain;
    assert.deepEqual(releases(releaseChain([third, mathPack, fix], third, '2026.1')), [
      '2026.1>2026.2',
      '2026.2>2027.1',
    ]);
    assert.deepEqual(releases(releaseChain([third, mathPack, fix], third)), ['2026.1>2026.2', '2026.2>2027.1']);
    assert.deepEqual(releases(releaseChain([fix, mathPack], fix, '2026.2')), {
      ok: false,
      problem: 'not-newer',
      release: '2026.2',
    });
    const later = read({ ...second, release: '2027.1', migration: { from: '2026.2', entries: [] } });
    assert.deepEqual(releaseChain([later, mathPack], later, '2026.1'), {
      ok: false,
      problem: 'missing',
      release: '2026.2',
    });
    const skipping = read({ ...second, release: '2027.1' });
    assert.deepEqual(releaseChain([skipping, fix, mathPack], skipping, '2026.2'), {
      ok: false,
      problem: 'broken',
      release: '2027.1',
    });
  });

  it('offers no move over a release whose entries do not fit the one before it', () => {
    const fix = read(second);
    const unsaid = read({
      ...mathPackSource,
      release: '2026.2',
      merges: [],
      items: edit(mathPackSource.items, { l3: [] }),
    });
    assert.deepEqual(releaseChain([unsaid, mathPack], unsaid, '2026.1'), {
      ok: false,
      problem: 'broken',
      release: '2026.2',
    });
    const reused = read({
      ...second,
      release: '2027.1',
      items: edit(second.items, { l2b: [] }),
      migration: { from: '2026.2', entries: [{ kind: 'rename', from: 'l2b', to: 'l3' }] },
    });
    assert.equal(releaseChain([reused, fix, mathPack], reused, '2026.1').ok, false);
    assert.deepEqual(releaseChain([unsaid, mathPack], unsaid), { ok: true, steps: [] });
    const back = read({
      ...second,
      release: '2027.1',
      migration: undefined,
      items: [...second.items, { ...mathPackSource.items.find((item) => item.id === 'l3')!, id: 'l7', title: 'x' }],
    });
    assert.deepEqual(releaseChain([back, fix, mathPack], back, '2026.1'), {
      ok: false,
      problem: 'broken',
      release: '2027.1',
    });
    const fromFix = releaseChain([back, fix, mathPack], back);
    assert.ok(fromFix.ok);
    assert.deepEqual(fromFix.steps, []);
    assert.deepEqual(releaseChain([back, mathPack], back, '2026.2'), {
      ok: false,
      problem: 'missing',
      release: '2026.2',
    });
  });

  it('follows an old ID one release at a time, so an ID renamed twice stays one item', () => {
    const fix = read(second);
    const third = read({
      ...second,
      release: '2027.1',
      items: edit(second.items, { l2a: ['l2c'], l1b: ['l1c'] }),
      migration: {
        from: '2026.2',
        entries: [
          { kind: 'rename', from: 'l2a', to: 'l2c' },
          { kind: 'rename', from: 'l1b', to: 'l1c' },
        ],
      },
    });
    const chain = releaseChain([mathPack, fix, third], third, '2026.1');
    assert.ok(chain.ok);
    assert.deepEqual(followId(chain.steps, 'l1'), ['l1c']);
    assert.deepEqual(followId(chain.steps, 'l1b'), ['l1c']);
    assert.deepEqual(followId(chain.steps, 'l2'), ['l2c', 'l2b']);
    assert.deepEqual(followId(chain.steps, 'l6'), ['l56']);
    assert.deepEqual(followId(chain.steps, 'l7'), []);
    assert.deepEqual(followId(chain.steps, 'l3'), ['l3']);
  });
});
