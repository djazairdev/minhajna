// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class's own changes (#225) in their order: on another device, after a
// split taken back and made again, in a week-based pack, against merges the
// pack proposes, in the TD queue, and next to an exam-window answer.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  courseSetup,
  layered,
  partId,
  queueItems,
  recordsForRoute,
  type Context,
  type PlanDecision,
} from '../src/index.ts';
import { cemEvents, contextOf, d, languagePack, mathPack, openBook } from './fixtures.ts';
import { attempt, change, made } from './plan-change-fixtures.ts';

const ids = (context: Context, queue: 'main' | 'td' = 'main') =>
  queueItems(courseSetup(context, 'c-math').pack!, queue).map((item) => item.id);

describe("A class's own changes, in their order", () => {
  it('travel without their day, and another device applies them in the same order', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'z-split', kind: 'split', item: 'l4', titles: ['Made-up A', 'Made-up B'] },
      { ...made, id: 'a-move', kind: 'move', item: partId('l4', 'z-split', 2), before: 'l1' },
    );
    const records = recordsForRoute(book.state, 'handover');
    const sent = records.flatMap((event) => (event.kind === 'plan.decided' ? [event.decision] : []));
    assert.equal(sent.length, 2);
    assert.ok(sent.every((decision) => !('day' in decision)));
    const decisions = new Map<string, PlanDecision>(sent.map((decision) => [decision.id, decision]));
    const pack = courseSetup(context, 'c-math').pack!;
    assert.deepEqual(layered(mathPack, decisions, 'c-math', 60), pack);
    assert.equal(ids(context)[1], partId('l4', 'z-split', 2));
  });

  it('never credits a second split with sessions taught under the first one', async () => {
    const book = await openBook(cemEvents());
    await change(book, { ...made, id: 's1', kind: 'split', item: 'd1', titles: ['Made-up A', 'Made-up B'] });
    const context = contextOf(book);
    const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-09-20'));
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(
        context,
        sessions.map((session) => ({ session })),
      ),
    );
    await change(book, { ...made, id: 'u1', kind: 'undo', change: 's1' });
    const after = await change(book, {
      ...made,
      id: 's2',
      kind: 'split',
      item: 'd1',
      titles: ['Made-up C', 'Made-up D'],
    });
    assert.equal(ids(after)[0], partId('d1', 's2', 1));
    const view = courseSetup(after, 'c-math').pack!;
    assert.equal(view.retired?.length, 2);
    assert.ok(view.retired?.every((item) => item.id.includes('~s1~')));
  });

  it('gives an added or moved item the plan week of where it lands', () => {
    const decisions = new Map<string, PlanDecision>([
      ['a1', { ...made, seq: 1, id: 'a1', kind: 'add', title: 'Made-up', sessions: 1, before: null }],
    ]);
    const pack = layered(languagePack, decisions, 'c-math', 45);
    const main = queueItems(pack, 'main');
    assert.equal(main.at(-1)?.week, main.at(-2)?.week);
    const first = main[0]!;
    const moved = layered(
      languagePack,
      new Map<string, PlanDecision>([
        ['m1', { ...made, seq: 1, id: 'm1', kind: 'move', item: main.at(-1)!.id, before: first.id }],
      ]),
      'c-math',
      45,
    );
    assert.equal(queueItems(moved, 'main')[0]?.week, first.week);
  });

  it('keeps a merge the pack proposes only while its items stay side by side', async () => {
    assert.deepEqual(mathPack.merges, [['l2', 'l3']]);
    const book = await openBook(cemEvents());
    const context = await change(book, { ...made, id: 'm1', kind: 'move', item: 'l3', before: 'l1' });
    assert.deepEqual(courseSetup(context, 'c-math').pack!.merges, []);
    const reversed = {
      ...mathPack,
      merges: [
        ['l3', 'l2'],
        ['l1', 'l4'],
      ],
    };
    const budget = new Map<string, PlanDecision>([
      ['b1', { ...made, seq: 1, id: 'b1', kind: 'budget', item: 'l5', sessions: 3 }],
    ]);
    assert.deepEqual(layered(reversed, budget, 'c-math', 60).merges, reversed.merges);
  });

  it('moves TD items within their own queue, and an item to the end of its queue', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'm1', kind: 'move', item: 't2', before: 't1' },
      { ...made, id: 'm2', kind: 'move', item: 'l1', before: null },
    );
    assert.deepEqual(ids(context, 'td'), ['t2', 't1']);
    assert.equal(ids(context).at(-1), 'l1');
    assert.equal(ids(context).length, ids(contextOf(await openBook(cemEvents()))).length);
  });

  it('does not split an item an exam-window answer names', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-20'), {
      kind: 'plan.decided',
      decision: { id: 'p1', courseId: 'c-math', kind: 'postpone', items: ['l4'], term: 1 },
    });
    const context = contextOf(book);
    assert.throws(
      attempt(context, { ...made, id: 's1', kind: 'split', item: 'l4', titles: ['Made-up A', 'Made-up B'] }),
      RangeError,
    );
  });
});
