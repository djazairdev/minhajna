// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Carrying changes to a new release (#322, answer 487, R-4.2-17): a renamed
// item keeps them; a skip, a leave-out and a postponement of a split item go to
// every part, a move moves the parts together, and an item placed before it
// goes before the first part; a skip of every merged item goes to the merged
// item, and a join of two of them is already done; a budget on a split item, or
// a skip or postponement of one merged item, is asked; a change on a removed
// item or a part of it is left out, or carried without it, and something placed
// before it goes before the next item still there; an undo follows a change to
// each part, whatever comes first. The parts of the class's own split follow a
// rename, and every carried ID stays apart release after release. Made-up data.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { carryDecisions, recordedId, releaseChain, type Migration, type PlanDecision } from '../src/index.ts';
import { mathPack } from './fixtures.ts';
import { edit, mathFix, mathFixSource, releaseOf } from './migration-fixtures.ts';
import { made } from './plan-change-fixtures.ts';

const chain = releaseChain([mathPack, mathFix], mathFix, '2026.1');
assert.ok(chain.ok);
const migration: Migration = chain.steps;

const carried = (...list: PlanDecision[]) => carryDecisions(list, migration);
const ids = (list: readonly PlanDecision[]) => list.map((one) => [one.id, 'item' in one ? one.item : one.kind]);

describe('changes carried to a new release', () => {
  it('keeps changes on a renamed item and on items that did not change', () => {
    const { decisions, unclear } = carried(
      { ...made, seq: 1, id: 'b1', kind: 'budget', item: 'l1', sessions: 3 },
      { ...made, seq: 2, id: 'k1', kind: 'skip', item: 'l3' },
    );
    assert.deepEqual(ids(decisions), [
      ['b1', 'l1b'],
      ['k1', 'l3'],
    ]);
    assert.deepEqual(unclear, []);
  });

  it('takes a skip, a leave-out, a postponement and a move of a split item to every part', () => {
    const { decisions } = carried(
      { ...made, seq: 1, id: 'k1', kind: 'skip', item: 'l2' },
      { id: 'o1', courseId: 'c-math', kind: 'leave-out', item: 'l2' },
      { id: 'p1', courseId: 'c-math', kind: 'postpone', items: ['l2', 'l3'], term: 1 },
      { ...made, seq: 2, id: 'm1', kind: 'move', item: 'l2', before: 'l4' },
    );
    assert.deepEqual(ids(decisions), [
      ['k1', 'l2a'],
      ['k1~2026.2~2', 'l2b'],
      ['o1', 'l2a'],
      ['o1~2026.2~2', 'l2b'],
      ['p1', 'postpone'],
      ['m1', 'l2a'],
      ['m1~2026.2~2', 'l2b'],
    ]);
    assert.deepEqual((decisions[4] as { items: readonly string[] }).items, ['l2a', 'l2b', 'l3']);
    assert.deepEqual(
      decisions.slice(5).map((one) => (one.kind === 'move' ? one.before : null)),
      ['l4', 'l4'],
    );
  });

  it('places what came before a split item before its first part, and before a removed item after it', () => {
    const { decisions } = carried(
      { ...made, seq: 1, id: 'a1', kind: 'add', title: 'Extra', sessions: 1, before: 'l2' },
      { ...made, seq: 2, id: 'a2', kind: 'add', title: 'Late', sessions: 1, before: 'l7' },
      { ...made, seq: 3, id: 'a3', kind: 'add', title: 'Merged', sessions: 1, before: 'l6' },
    );
    assert.deepEqual(
      decisions.map((one) => (one.kind === 'add' ? one.before : null)),
      ['l2a', null, 'l56'],
    );
  });

  it('carries a skip of every merged item, and asks about a skip of only one', () => {
    const both = carried(
      { ...made, seq: 1, id: 'k5', kind: 'skip', item: 'l5' },
      { ...made, seq: 2, id: 'k6', kind: 'skip', item: 'l6' },
    );
    assert.deepEqual(ids(both.decisions), [['k5', 'l56']]);
    const one = carried({ ...made, seq: 1, id: 'k5', kind: 'skip', item: 'l5' });
    assert.deepEqual(one.decisions, []);
    assert.deepEqual(
      one.unclear.map((question) => [question.decision.id, question.release, question.entry.kind]),
      [['k5', '2026.2', 'merge']],
    );
  });

  it('asks about a budget, a split or a join on a split item, and drops a join of two merged items', () => {
    const { decisions, unclear } = carried(
      { ...made, seq: 1, id: 'b2', kind: 'budget', item: 'l2', sessions: 2 },
      { ...made, seq: 2, id: 's2', kind: 'split', item: 'l2', titles: ['A', 'B'] },
      { ...made, seq: 3, id: 'j1', kind: 'join', items: ['l2', 'l3'] },
      { ...made, seq: 4, id: 'j2', kind: 'join', items: ['l5', 'l6'] },
    );
    assert.deepEqual(decisions, []);
    assert.deepEqual(
      unclear.map((question) => question.decision.id),
      ['b2', 's2', 'j1'],
    );
  });

  it('leaves out a change on a removed item, and follows an undo to every part', () => {
    const { decisions, removed } = carried(
      { ...made, seq: 1, id: 'k7', kind: 'skip', item: 'l7' },
      { ...made, seq: 2, id: 'k2', kind: 'skip', item: 'l2' },
      { ...made, seq: 3, id: 'u2', kind: 'undo', change: 'k2' },
    );
    assert.deepEqual(
      removed.map((one) => one.id),
      ['k7'],
    );
    assert.deepEqual(
      decisions.map((one) => (one.kind === 'undo' ? [one.id, one.change] : [one.id])),
      [['k2'], ['k2~2026.2~2'], ['u2', 'k2'], ['u2~2026.2~2', 'k2~2026.2~2']],
    );
    assert.deepEqual(carryDecisions([{ ...made, seq: 1, id: 'k2', kind: 'skip', item: 'l2' }], []).decisions, [
      { ...made, seq: 1, id: 'k2', kind: 'skip', item: 'l2' },
    ]);
  });

  it('keeps every carried ID apart, release after release, each leading back to its change', () => {
    const third = releaseOf({
      release: '2027.1',
      items: edit(mathFixSource.items, { l2b: ['l2c', 'l2d'] }),
      migration: { from: '2026.2', entries: [{ kind: 'split', from: 'l2b', to: ['l2c', 'l2d'] }] },
    });
    const chain = releaseChain([mathPack, mathFix, third], third, '2026.1');
    assert.ok(chain.ok);
    const { decisions } = carryDecisions([{ ...made, seq: 1, id: 'k1', kind: 'skip', item: 'l2' }], chain.steps);
    assert.deepEqual(ids(decisions), [
      ['k1', 'l2a'],
      ['k1~2026.2~2', 'l2c'],
      ['k1~2026.2~2~2027.1~2', 'l2d'],
    ]);
    assert.deepEqual(new Set(decisions.map((one) => recordedId(one.id))), new Set(['k1']));
  });

  it("follows a rename with the parts of the class's own split, and asks about them on a split item", () => {
    const { decisions, unclear } = carried(
      { ...made, seq: 1, id: 's1', kind: 'split', item: 'l1', titles: ['A', 'B'] },
      { ...made, seq: 2, id: 'k1', kind: 'skip', item: 'l1~s1~2' },
      { ...made, seq: 3, id: 's2', kind: 'split', item: 'l3', titles: ['A', 'B'] },
      { ...made, seq: 4, id: 'm1', kind: 'move', item: 'l3~s2~1', before: 'l2' },
      { ...made, seq: 5, id: 'k2', kind: 'skip', item: 'l2~s9~1' },
    );
    assert.deepEqual(ids(decisions), [
      ['s1', 'l1b'],
      ['k1', 'l1b~s1~2'],
      ['s2', 'l3'],
      ['m1', 'l3~s2~1'],
    ]);
    assert.equal(decisions[3]?.kind === 'move' ? decisions[3].before : null, 'l2a');
    assert.deepEqual(
      unclear.map((question) => question.decision.id),
      ['k2'],
    );
  });

  it('asks about postponing one merged item, and leaves out a removed item, or a part of it', () => {
    const { decisions, unclear, removed } = carried(
      { id: 'p1', courseId: 'c-math', kind: 'postpone', items: ['l5'], term: 1 },
      { id: 'p2', courseId: 'c-math', kind: 'postpone', items: ['l7', 'l3'], term: 2 },
      { id: 'p3', courseId: 'c-math', kind: 'postpone', items: ['l7'], term: 2 },
      { ...made, seq: 1, id: 'k7', kind: 'skip', item: 'l7~s1~1' },
    );
    assert.deepEqual(
      unclear.map((question) => question.decision.id),
      ['p1'],
    );
    assert.deepEqual(
      removed.map((one) => one.id),
      ['p2', 'p3', 'k7'],
    );
    assert.deepEqual(
      decisions.map((one) => (one.kind === 'postpone' ? [one.id, one.items] : [])),
      [['p2', ['l3']]],
    );
  });

  it('carries an undo after its change, whichever comes first', () => {
    const { decisions } = carried(
      { ...made, seq: 2, id: 'u2', kind: 'undo', change: 'k2' },
      { ...made, seq: 1, id: 'k2', kind: 'skip', item: 'l2' },
    );
    assert.deepEqual(
      decisions.map((one) => (one.kind === 'undo' ? [one.id, one.change] : [one.id])),
      [['k2'], ['k2~2026.2~2'], ['u2', 'k2'], ['u2~2026.2~2', 'k2~2026.2~2']],
    );
  });
});
