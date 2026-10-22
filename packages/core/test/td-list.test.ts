// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A TD session's list (#231, L-Today, answer 387): the next items of the
// pack's TD queue the group takes, each once, with the session that starts
// it; «بعد الفرض» on a row a test of the class comes before, never one of
// the other half's; and the main plan's next proposal, which TD never moves.
// A lesson has no list. Made-up classes only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awaitingBetween, tdList, tdLists, walkCourse, type RecordBook, type Session } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const from = d('2026-09-20');
const to = d('2026-10-20');

/** The first awaiting session of `group` with the session type `type`. */
function first(book: RecordBook, group: string, type: string): Session {
  return awaitingBetween(contextOf(book), from, to).find((one) => one.groupId === group && one.sessionType === type)!;
}

describe('the TD list', () => {
  it('lists the group’s next TD items with their sessions, and the main plan’s next proposal', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const td = first(book, 'g-1', 'td');
    const list = tdList(context, td)!;
    assert.deepEqual(
      list.rows.map((row) => [row.item.id, row.session.day, row.session.groupId, row.afterTest]),
      [
        ['t1', td.day, 'g-1', false],
        ['t2', d('2026-10-06'), 'g-1', false],
      ],
    );
    const proposals = walkCourse(context, 'c-math', to).proposals;
    const next = awaitingBetween(context, td.day, to).find(
      (one) => one.groupId === 'g-all' && one.day >= td.day && proposals.get(one.key)?.queue === 'main',
    )!;
    assert.equal(list.main?.item.id, proposals.get(next.key)?.item.id);
    assert.equal(tdList(context, td, 1)?.rows.length, 1);
  });

  it('marks a row a test of the class comes before', async () => {
    const book = await openBook(cemEvents());
    const td = first(book, 'g-1', 'td');
    const lesson = awaitingBetween(contextOf(book), d('2026-09-28'), d('2026-10-05')).find(
      (one) => one.groupId === 'g-all',
    )!;
    await book.record(from, {
      kind: 'test.set',
      test: { id: 'x1', courseId: 'c-math', day: lesson.day, slot: lesson.slot, groupId: 'g-all', title: 'Test 1' },
    });
    const rows = tdList(contextOf(book), td)!.rows;
    assert.deepEqual(
      rows.map((row) => [row.item.id, row.afterTest]),
      [
        ['t1', false],
        ['t2', true],
      ],
    );
  });

  it('leaves out the other half’s sessions and tests', async () => {
    const book = await openBook(cemEvents());
    const td = first(book, 'g-1', 'td');
    const other = first(book, 'g-2', 'td');
    await book.record(from, {
      kind: 'test.set',
      test: { id: 'x2', courseId: 'c-math', day: other.day, slot: other.slot, groupId: 'g-2', title: 'Test 2' },
    });
    const rows = tdList(contextOf(book), td)!.rows;
    assert.deepEqual(
      rows.map((row) => [row.session.groupId, row.afterTest]),
      [
        ['g-1', false],
        ['g-1', false],
      ],
    );
  });

  it('gives each TD session its own list at once, and no main line when no lesson comes near', async () => {
    const book = await openBook(
      cemEvents().map((event) =>
        event.kind === 'timetable.set'
          ? {
              ...event,
              version: { ...event.version, entries: event.version.entries.filter((one) => one.sessionType === 'td') },
            }
          : event,
      ),
    );
    const context = contextOf(book);
    const sessions = [first(book, 'g-1', 'td'), first(book, 'g-2', 'td')];
    const lists = tdLists(context, sessions);
    assert.equal(lists.size, 2);
    for (const session of sessions) {
      assert.deepEqual(lists.get(session.key), tdList(context, session));
      assert.equal(lists.get(session.key)?.main, null);
      assert.equal(lists.get(session.key)?.rows[0]?.session.key, session.key);
    }
  });

  it('has no list for a lesson', async () => {
    const book = await openBook(cemEvents());
    assert.equal(tdList(contextOf(book), first(book, 'g-all', 'lesson')), null);
  });
});
