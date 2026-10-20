// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class's own changes to its plan (#225): a layer of operations over the
// pack, applied again over any release, each one taken back with an undo,
// and never touching what was recorded.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  budgetInSessions,
  findPackItem,
  changesFor,
  confirmSessions,
  courseSetup,
  current,
  layered,
  partId,
  addedId,
  planView,
  queueItems,
  recordChange,
  stageNames,
  type Context,
  type PlanDecision,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook } from './fixtures.ts';
import { attempt, change, day, made, type Draft } from './plan-change-fixtures.ts';

const ids = (context: Context, queue: 'main' | 'td' = 'main') =>
  queueItems(courseSetup(context, 'c-math').pack!, queue).map((item) => item.id);

describe("A class's own changes to its plan", () => {
  it('re-budgets an item in sessions, kept in the pack unit', async () => {
    const book = await openBook(cemEvents());
    const context = await change(book, { ...made, id: 'b1', kind: 'budget', item: 'l3', sessions: 3 });
    const { pack, sessionMinutes } = courseSetup(context, 'c-math');
    const l3 = pack!.items.find((item) => item.id === 'l3')!;
    assert.equal(budgetInSessions(pack!, l3, sessionMinutes), 3);
    assert.equal(l3.budget, (3 * sessionMinutes) / 60);
  });

  it('splits an item in its place, sharing its sessions and stages, and names both parts', async () => {
    const book = await openBook(cemEvents());
    const context = await change(book, {
      ...made,
      id: 's1',
      kind: 'split',
      item: 'l1',
      titles: ['Reading', 'Writing'],
    });
    const pack = courseSetup(context, 'c-math').pack!;
    assert.deepEqual(ids(context).slice(0, 4), ['d1', partId('l1', 's1', 1), partId('l1', 's1', 2), 'l2']);
    const [one, two] = [partId('l1', 's1', 1), partId('l1', 's1', 2)].map((id) =>
      pack.items.find((item) => item.id === id)!,
    );
    assert.equal(one!.title, 'Reading');
    assert.equal(one!.unit, 'u1');
    assert.deepEqual(stageNames(pack, one!), ['Warm-up', 'Construction']);
    assert.deepEqual(stageNames(pack, two!), ['Practice', 'Assessment']);
    assert.equal(budgetInSessions(pack, one!, 60) + budgetInSessions(pack, two!, 60), 2);
    assert.equal(findPackItem(pack, partId('l1', 's1', 2))?.title, 'Writing');
  });

  it('adds a lesson before an item, in its unit, and moves an item within its own queue only', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'a1', kind: 'add', title: 'Made-up review', sessions: 2, before: 'l3' },
      { ...made, id: 'm1', kind: 'move', item: 'l5', before: 'l2' },
    );
    const main = ids(context);
    assert.deepEqual(main.slice(main.indexOf('l1'), main.indexOf('l1') + 5), ['l1', 'l5', 'l2', addedId('a1'), 'l3']);
    const pack = courseSetup(context, 'c-math').pack!;
    assert.equal(pack.items.find((item) => item.id === 'l5')?.unit, 'u1');
    assert.equal(pack.items.find((item) => item.id === addedId('a1'))?.kind, 'lesson');
    for (const draft of [
      { ...made, id: 'm2', kind: 'move', item: 't1', before: 'l1' },
      { ...made, id: 'b2', kind: 'budget', item: 'l1', sessions: 0 },
      { ...made, id: 'k1', kind: 'skip', item: 'u1' },
      { ...made, id: 'm1', kind: 'skip', item: 'l1' },
      { ...made, id: 'a2', kind: 'add', title: 'Made-up', sessions: 1, before: 'gone' },
      { ...made, id: 'a3', kind: 'add', title: 'x'.repeat(161), sessions: 1, before: null },
      { ...made, id: 'a4', kind: 'add', title: 'Two\nlines', sessions: 1, before: null },
      { ...made, id: 'a5', kind: 'add', title: 'Made-up\u202eweiver', sessions: 1, before: null },
      { ...made, id: 'j1', kind: 'join', items: ['l1', 'l3'] },
      { ...made, id: 'j2', kind: 'join', items: ['l4', 't1'] },
    ] satisfies Draft[]) {
      assert.throws(attempt(context, draft), RangeError, draft.id);
    }
    assert.throws(() => recordChange(context, { ...made, id: 'k2', kind: 'skip', item: 'l1', seq: 1 }), RangeError);
  });

  it('skips any item, essential or not, and joins two items side by side into one session', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'k1', kind: 'skip', item: 'd1' },
      { ...made, id: 'j1', kind: 'join', items: ['l3', 'l2'] },
    );
    const view = planView(context, 'c-math', day)!;
    assert.equal(view.main.find((row) => row.item.id === 'd1')?.status, 'skipped');
    const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-09-30'));
    await book.recordAll(
      d('2026-09-30'),
      confirmSessions(
        context,
        sessions.map((session) => ({ session })),
      ),
    );
    const items = [...book.state.sessions.values()].map((versions) =>
      current(versions)!.coverage.map((cover) => cover.item),
    );
    assert.ok(!items.flat().includes('d1'));
    assert.ok(items.some((one) => one.includes('l2') && one.includes('l3')));
  });

  it('takes a change back with an undo, keeping both in the history', async () => {
    const book = await openBook(cemEvents());
    await change(book, { ...made, id: 'm1', kind: 'move', item: 'l4', before: 'l1' });
    const context = await change(book, { ...made, id: 'u1', kind: 'undo', change: 'm1' });
    assert.deepEqual(ids(context), ids(contextOf(await openBook(cemEvents()))));
    assert.equal(book.state.decisions.size, 2);
    assert.deepEqual(changesFor(book.state.decisions, 'c-math'), []);
    assert.throws(attempt(context, { ...made, id: 'u2', kind: 'undo', change: 'm1' }), RangeError);
  });

  it('keeps sessions taught under an undone split, and proposes the original item again', async () => {
    const book = await openBook(cemEvents());
    await change(book, { ...made, id: 's1', kind: 'split', item: 'd1', titles: ['First part', 'Second part'] });
    const context = contextOf(book);
    const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-09-20'));
    await book.recordAll(
      day,
      confirmSessions(
        context,
        sessions.map((session) => ({ session })),
      ),
    );
    const recorded = [...book.state.sessions.values()].map((versions) => current(versions)!);
    assert.deepEqual(
      recorded[0]!.coverage.map((cover) => cover.item),
      [partId('d1', 's1', 1)],
    );
    const after = await change(book, { ...made, id: 'u1', kind: 'undo', change: 's1' });
    assert.deepEqual(
      [...book.state.sessions.values()].map((versions) => current(versions)!),
      recorded,
    );
    assert.equal(planView(after, 'c-math', d('2026-09-21'))!.main.find((row) => row.position)?.item.id, 'd1');
    const pack = courseSetup(after, 'c-math').pack!;
    assert.ok(!pack.items.some((item) => item.id === partId('d1', 's1', 1)));
    assert.equal(findPackItem(pack, partId('d1', 's1', 1))?.title, 'First part');
  });

  it('applies the same changes over a new release, so a national fix still reaches the class', () => {
    const fixed = {
      ...mathPack,
      release: '2026.2',
      items: mathPack.items.map((item) =>
        item.id === 'l2' ? { ...item, title: 'Comparing and ordering numbers' } : item,
      ),
    };
    const decisions = new Map<string, PlanDecision>([
      ['m1', { ...made, seq: 1, id: 'm1', kind: 'move', item: 'l2', before: 'l1' }],
      ['m2', { ...made, seq: 2, id: 'm2', kind: 'move', item: 'gone', before: 'l1' }],
    ]);
    const pack = layered(fixed, decisions, 'c-math', 60);
    assert.deepEqual(
      queueItems(pack, 'main')
        .slice(1, 3)
        .map((item) => item.title),
      ['Comparing and ordering numbers', 'Reading and writing whole numbers'],
    );
    assert.equal(pack.items.length, fixed.items.length);
    assert.equal(layered(fixed, new Map(), 'c-math', 60), fixed);
  });
});
