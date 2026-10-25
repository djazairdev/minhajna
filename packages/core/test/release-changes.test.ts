// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Pack-release screen reads (#322, answer 487 (8)): what changed
// from the class's release, by kind and through every release between; how
// the class's own changes and each layer's are carried; and the records as
// they would be once moved, answers included. Made-up data.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addLayer,
  courseDecisions,
  layerKey,
  movedContext,
  movePlan,
  releaseChain,
  releaseChanges,
  switchLayer,
  type PlanLayer,
} from '../src/index.ts';
import { cemEvents, d, mathPack, openBook } from './fixtures.ts';
import { edit, mathFix, mathFixSource, releaseOf, withFix } from './migration-fixtures.ts';
import { change, made } from './plan-change-fixtures.ts';

const ids = (items: readonly { readonly id: string }[]) => items.map((item) => item.id);

describe('what changed in a newer release', () => {
  it('names each change by kind, through every release between', () => {
    const third = releaseOf({
      release: '2027.1',
      items: edit(mathFixSource.items, { l3: ['l3'] }).map((item) =>
        item.id === 'l4' ? { ...item, pages: '12' } : item,
      ),
      migration: { from: '2026.2', entries: [] },
    });
    const chain = releaseChain([mathPack, mathFix, third], third, '2026.1');
    assert.ok(chain.ok);
    const changes = releaseChanges(mathPack, third, chain.steps);
    assert.deepEqual(
      changes.map((one) => {
        switch (one.kind) {
          case 'page':
            return [one.kind, one.item.id, one.from ?? null, one.to ?? null];
          case 'title':
            return [one.kind, one.from.id, one.to.id];
          case 'split':
            return [one.kind, one.from.id, ids(one.to)];
          case 'merge':
            return [one.kind, ids(one.from), one.to.id];
          default:
            return [one.kind, one.item.id];
        }
      }),
      [
        ['page', 'l4', null, '12'],
        ['title', 'l1', 'l1b'],
        ['title', 'l3', 'l3'],
        ['split', 'l2', ['l2a', 'l2b']],
        ['merge', ['l5', 'l6'], 'l56'],
        ['removed', 'l7'],
      ],
    );
  });

  it('shows a part merged with another item as a split and a merge', () => {
    const later = releaseOf({
      release: '2027.1',
      items: edit(mathFixSource.items, { l2b: ['l2b3'], l3: [] }),
      migration: { from: '2026.2', entries: [{ kind: 'merge', from: ['l2b', 'l3'], to: 'l2b3' }] },
    });
    const chain = releaseChain([mathPack, mathFix, later], later, '2026.1');
    assert.ok(chain.ok);
    const kinds = releaseChanges(mathPack, later, chain.steps).filter((one) => one.kind !== 'title');
    assert.deepEqual(
      kinds.flatMap((one) =>
        one.kind === 'split'
          ? [[one.kind, one.from.id, ids(one.to)]]
          : one.kind === 'merge'
            ? [[one.kind, ids(one.from), one.to.id]]
            : [],
      ),
      [
        ['split', 'l2', ['l2a', 'l2b3']],
        ['merge', ['l2', 'l3'], 'l2b3'],
        ['merge', ['l5', 'l6'], 'l56'],
      ],
    );
  });
});

describe('a move as the screen shows it', () => {
  it('tells how each list is carried, and shows the class moved with its answers', async () => {
    const book = await openBook(cemEvents());
    const school: PlanLayer = {
      level: 'school',
      id: 'example-school',
      pack: mathPack.id,
      title: 'Made-up school layer',
      by: 'Made-up author',
      made: d('2026-09-20'),
      operations: [{ kind: 'skip', item: 'l3' }],
    };
    await book.record(d('2026-09-20'), addLayer(book.state, { layer: school }));
    await book.record(d('2026-09-20'), switchLayer(book.state, 'c-math', 'school', layerKey(school)));
    await change(
      book,
      { ...made, id: 'b2', kind: 'budget', item: 'l2', sessions: 2 },
      { ...made, id: 'k1', kind: 'skip', item: 'l1' },
    );
    const context = withFix(book);
    const plan = movePlan(context, 'c-math', '2026.2');
    assert.ok(plan.ok);
    assert.deepEqual(
      plan.lists.map((one) => [one.layer?.title ?? null, one.changes, one.carried]),
      [
        [null, 2, 'asked'],
        ['Made-up school layer', 1, 'as-is'],
      ],
    );
    const after = movedContext(context, 'c-math', plan, ['l2b'], d('2026-09-25'));
    assert.equal(after.state.courses.get('c-math')?.pack?.release, '2026.2');
    assert.equal(context.state.courses.get('c-math')?.pack?.release, '2026.1');
    const own = [...courseDecisions(after, 'c-math').values()].filter((one) => one.courseId === 'c-math');
    assert.deepEqual(
      own.map((one) => [one.kind, 'item' in one ? one.item : null]),
      [
        ['skip', 'l1b'],
        ['budget', 'l2b'],
      ],
    );
  });
});
