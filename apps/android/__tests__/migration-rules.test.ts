// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Migrate's rules (#615, answer 769), over made-up packs: which release the
// entries start from, what still needs one, and an entry that can't fit.

import type { PackItem, PlanPack } from '@minhajna/core';
import { source } from '../jest/editor-source';
import {
  addEntry,
  entryOf,
  migrationMap,
  migrationView,
  previousRelease,
  removeEntry,
} from '../src/editor/migration-rules';

const item = (id: string, kind = 'lesson'): PackItem =>
  ({ id, kind, title: `Made-up ${id}`, budget: 1, sourcePage: 2 }) as PackItem;
const pack = (release: string, ids: readonly string[], extra: Partial<PlanPack> = {}): PlanPack => ({
  ...source,
  release,
  items: ids.map((id) => item(id)),
  ...extra,
});
const before = pack('2026.1', ['a', 'b', 'c']);
const KINDS = { rename: 'Made-up rename', split: 'Made-up split', merge: 'Made-up merge', remove: 'Made-up remove' };

test('the entries start from the release they name, else the latest before the draft', () => {
  const later = pack('2026.3', ['a']);
  const middle = pack('2026.2', ['a']);
  expect(previousRelease(later, [])).toBeNull();
  expect(previousRelease(later, [before, middle])?.release).toBe('2026.2');
  const named = { ...later, migration: { from: '2026.1', entries: [] } };
  expect(previousRelease(named, [before, middle])?.release).toBe('2026.1');
  expect(previousRelease(middle, [later])).toBeNull();
});

test('an earlier item missing without an entry is open, and a new one is allowed', () => {
  const draft = pack('2026.2', ['a', 'b', 'd', 'e']);
  const view = migrationView(draft, before);
  expect(view.open.map((one) => one.id)).toEqual(['c']);
  expect(view.added.map((one) => one.id)).toEqual(['d', 'e']);
  expect(view.misfits).toEqual(['c']);
});

test('adding a split accounts for its items, and removing it brings them back', () => {
  const draft = pack('2026.2', ['a', 'b', 'd', 'e']);
  const next = addEntry(draft, before, { kind: 'split', from: 'c', to: ['d', 'e'] })!;
  expect(next.migration).toEqual({ from: '2026.1', entries: [{ kind: 'split', from: 'c', to: ['d', 'e'] }] });
  const view = migrationView(next, before);
  expect(view.open).toEqual([]);
  expect(view.added).toEqual([]);
  expect(view.misfits).toEqual([]);
  const back = removeEntry(next, before, 0)!;
  expect(migrationView(back, before).open.map((one) => one.id)).toEqual(['c']);
});

test('an entry that can not fit is refused', () => {
  const draft = pack('2026.2', ['a', 'b', 'd']);
  expect(addEntry(draft, before, { kind: 'rename', from: 'a', to: 'd' })).toBeNull();
  expect(addEntry(draft, before, { kind: 'rename', from: 'zz', to: 'd' })).toBeNull();
  expect(addEntry(draft, before, { kind: 'rename', from: 'c', to: 'zz' })).toBeNull();
  const unit = { ...draft, items: [item('a'), item('b'), item('d', 'td')] };
  expect(addEntry(unit, before, { kind: 'rename', from: 'c', to: 'd' })).toBeNull();
});

test('an entry a later edit broke can still be taken away, though it blocks a new one', () => {
  const draft = addEntry(pack('2026.2', ['a', 'b', 'x']), before, { kind: 'rename', from: 'c', to: 'x' })!;
  const broken = { ...draft, items: [item('a'), item('b'), item('x', 'td')] };
  expect(migrationView(broken, before).misfits).toEqual(['c']);
  expect(removeEntry(broken, before, 0)?.migration?.entries).toEqual([]);
});

test('choosing IDs makes an entry only once its kind has what it needs', () => {
  expect(entryOf('rename', ['a'], [])).toBeNull();
  expect(entryOf('rename', ['a'], ['b'])).toEqual({ kind: 'rename', from: 'a', to: 'b' });
  expect(entryOf('rename', ['a', 'c'], ['b'])).toBeNull();
  expect(entryOf('split', ['a'], ['b'])).toBeNull();
  expect(entryOf('split', ['a'], ['b', 'c'])).toEqual({ kind: 'split', from: 'a', to: ['b', 'c'] });
  expect(entryOf('merge', ['a'], ['b'])).toBeNull();
  expect(entryOf('merge', ['a', 'c'], ['b'])).toEqual({ kind: 'merge', from: ['a', 'c'], to: 'b' });
  expect(entryOf('remove', ['a'], [])).toEqual({ kind: 'remove', item: 'a' });
  expect(entryOf('remove', [], [])).toBeNull();
});

test('the map sets the releases side by side, mirrored, kept items hidden when only changes are asked for', () => {
  const draft = addEntry(pack('2026.2', ['a', 'b', 'd', 'e']), before, { kind: 'split', from: 'c', to: ['d', 'e'] })!;
  const view = migrationView(draft, before);
  const all = migrationMap('Made-up', KINDS, draft, view, true, false);
  expect(all.nodes).toHaveLength(7);
  expect(all.links).toHaveLength(4);
  expect(all.nodes.find((one) => one.id === 'old:a')!.x).toBeGreaterThan(
    all.nodes.find((one) => one.id === 'new:a')!.x,
  );
  const ltr = migrationMap('Made-up', KINDS, draft, view, false, false);
  expect(ltr.nodes.find((one) => one.id === 'old:a')!.x).toBeLessThan(ltr.nodes.find((one) => one.id === 'new:a')!.x);
  const changes = migrationMap('Made-up', KINDS, draft, view, true, true);
  expect(changes.nodes.map((one) => one.id)).toEqual(['old:c', 'new:d', 'new:e']);
  expect(changes.links).toHaveLength(2);
  expect(changes.links[0].label).toBe('Made-up split');
});
