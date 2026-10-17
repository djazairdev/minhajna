// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backlogOf, confirmSessions, current, todayView } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

describe('Sessions awaiting confirmation', () => {
  it('is empty on the first day of the year', async () => {
    assert.deepEqual(backlogOf(contextOf(await openBook(cemEvents())), d('2026-09-20')), {
      week: null,
      days: [],
      awaiting: 0,
    });
  });

  it('shows the earliest week, by day, with the proposals that would be confirmed', async () => {
    const backlog = backlogOf(contextOf(await openBook(cemEvents())), d('2026-10-05'));
    assert.equal(backlog.week, '2026-09-20');
    assert.deepEqual(
      backlog.days.map((one) => [one.day, one.sessions.length]),
      [
        ['2026-09-20', 1],
        ['2026-09-21', 1],
        ['2026-09-22', 1],
        ['2026-09-23', 1],
        ['2026-09-24', 1],
      ],
    );
    assert.ok(backlog.awaiting > 5);
    const [sunday] = backlog.days[0]?.sessions ?? [];
    assert.equal(sunday?.status, 'awaiting');
    assert.equal(sunday?.proposal?.item.id, 'd1');
  });

  it('records exactly what it showed, and keeps a session left out for later', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const shown = backlogOf(context, d('2026-10-05')).days.flatMap((one) => one.sessions);
    const left = shown[1];
    const confirmed = shown.filter((_, index) => index !== 1);
    assert.ok(left);
    await book.recordAll(
      d('2026-10-05'),
      confirmSessions(
        context,
        confirmed.map((item) => ({ session: item.session })),
      ),
    );
    const after = contextOf(book);
    for (const item of confirmed) {
      const record = current(after.state.sessions.get(item.session.key));
      const p = item.proposal;
      assert.ok(p);
      assert.deepEqual(record?.coverage, [{ op: 'taught', item: p.item.id, from: p.from, to: p.to }]);
    }
    const next = backlogOf(after, d('2026-10-05'));
    assert.equal(next.week, '2026-09-20');
    assert.deepEqual(
      next.days.flatMap((one) => one.sessions.map((item) => item.session.key)),
      [left.session.key],
    );
  });

  it('moves to the next week once the earliest one is confirmed', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const before = backlogOf(context, d('2026-10-05'));
    await book.recordAll(
      d('2026-10-05'),
      confirmSessions(
        context,
        before.days.flatMap((one) => one.sessions.map((item) => ({ session: item.session }))),
      ),
    );
    const after = backlogOf(contextOf(book), d('2026-10-05'));
    assert.equal(after.week, '2026-09-27');
    assert.equal(after.awaiting, before.awaiting - 5);
    assert.equal(todayView(contextOf(book), d('2026-10-05')).awaitingEarlier, after.awaiting);
  });

  it('never reaches the day itself', async () => {
    const backlog = backlogOf(contextOf(await openBook(cemEvents())), d('2026-09-23'));
    assert.deepEqual(
      backlog.days.map((one) => one.day),
      ['2026-09-20', '2026-09-21', '2026-09-22'],
    );
    assert.equal(backlog.awaiting, 3);
  });
});
