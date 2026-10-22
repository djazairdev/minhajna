// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A hybrid plan's weekly targets (#231, Plan-lycee, answer 387): each item
// counts toward the next week its pack marks; the last item marked with a
// week is due by the last school day of the class's teaching week of that
// number; each target says whether it is reached, and the main sessions
// left until it beside those its items still need. Other packs have none.
// Made-up packs only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awaitingBetween, confirmSessions, targetWeekOf, walkCourse, weekTargets } from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook } from './fixtures.ts';
import { hybridContext, hybridPack } from './hybrid-fixtures.ts';

describe('weekly targets', () => {
  it('gives each main item the week it counts toward', () => {
    const weeks = ['d1', 'l2', 'l3', 'i1', 'r1', 'l7', 't1'].map((id) => targetWeekOf(hybridPack, id));
    assert.deepEqual(weeks, [2, 2, 4, 4, 10, 10, null]);
    assert.equal(targetWeekOf(mathPack, 'l2'), null);
  });

  it('dates each target, and counts the sessions left beside those needed', async () => {
    const context = hybridContext(await openBook(cemEvents()));
    const targets = weekTargets(context, 'c-math', d('2026-09-20'));
    assert.deepEqual(
      targets.map((one) => [one.week, one.item.id, one.due, one.reached, one.left, one.needed]),
      [
        [2, 'l2', d('2026-10-01'), false, 8, 3],
        [4, 'i1', d('2026-10-15'), false, 16, 7],
        [10, 'l7', d('2026-12-03'), false, 38, 12],
      ],
    );
    assert.equal(weekTargets(context, 'c-math', d('2026-10-04'))[0]?.left, 0);
    assert.deepEqual(weekTargets(contextOf(await openBook(cemEvents())), 'c-math', d('2026-09-20')), []);
  });

  it('counts a partly taught item by its stages, and gives a week past the year no day', async () => {
    const book = await openBook(cemEvents());
    const context = hybridContext(book);
    const [lesson] = awaitingBetween(context, d('2026-09-20'), d('2026-10-01')).filter(
      (one) => walkCourse(context, 'c-math', d('2026-10-01')).proposals.get(one.key)?.item.id === 'l1',
    );
    await book.record(
      lesson!.day,
      confirmSessions(context, [{ session: lesson!, choice: { outcome: 'partial', reached: 1 } }])[0]!,
    );
    const [first] = weekTargets(hybridContext(book), 'c-math', d('2026-09-23'));
    assert.ok(first !== undefined && first.needed > 2 && first.needed < 3);

    const far = {
      ...hybridPack,
      items: hybridPack.items.map((item) => (item.id === 'l7' ? { ...item, week: 99 } : item)),
    };
    const last = weekTargets(hybridContext(book, far), 'c-math', d('2026-09-23')).at(-1);
    assert.deepEqual([last?.week, last?.due, last?.left], [99, null, 0]);
  });

  it('says a target is reached once its item is done', async () => {
    const book = await openBook(cemEvents());
    const context = hybridContext(book);
    const day = d('2026-09-27');
    const sessions = awaitingBetween(context, d('2026-09-20'), day);
    await book.recordAll(
      day,
      confirmSessions(
        context,
        sessions.map((session) => ({ session, choice: { outcome: 'done' } })),
      ),
    );
    const [first, second] = weekTargets(hybridContext(book), 'c-math', d('2026-09-28'));
    assert.equal(first?.reached, true);
    assert.equal(second?.reached, false);
    assert.ok(second !== undefined && second.needed < 7);
  });
});
