// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The plan a recorded session is read against (#322, answer 487 (7)): one
// recorded before its class moved reads the titles of the release it was
// recorded on, with the class's changes, and still finds the newer
// release's items a later correction names; one recorded after the move, or
// not recorded, reads the class's plan now. Made-up data.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  courseSetup,
  current,
  findPackItem,
  recordPack,
  type RecordBook,
  type SessionRecord,
} from '../src/index.ts';
import { cemEvents, d, mathPack, openBook } from './fixtures.ts';
import { mathFix, withFix } from './migration-fixtures.ts';
import { change, made } from './plan-change-fixtures.ts';

async function confirmOn(book: RecordBook, day: string) {
  const context = withFix(book);
  const sessions = awaitingBetween(context, d(day), d(day));
  await book.recordAll(
    d(day),
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
}

const recordOn = (book: RecordBook, day: string): SessionRecord =>
  [...book.state.sessions.values()]
    .map((versions) => current(versions))
    .find((record) => record?.session.courseId === 'c-math' && record.session.day === d(day))!;

describe('the plan a recorded session is read against', () => {
  it('is the release it was recorded on, with the newer items kept, and the plan now after the move', async () => {
    const book = await openBook(cemEvents());
    await change(book, { ...made, id: 'b1', kind: 'budget', item: 'l1', sessions: 5 });
    await confirmOn(book, '2026-09-21');
    await book.record(d('2026-09-22'), {
      kind: 'course.moved',
      move: { courseId: 'c-math', from: '2026.1', to: '2026.2' },
    });
    await confirmOn(book, '2026-09-22');
    const context = withFix(book);
    const before = recordPack(context, recordOn(book, '2026-09-21'));
    const title = (id: string) => mathPack.items.find((item) => item.id === id)?.title;
    assert.equal(findPackItem(before, 'l1')?.title, title('l1'));
    assert.equal(findPackItem(before, 'l1')?.budget, 5);
    assert.equal(findPackItem(before, 'l2a')?.title, mathFix.items.find((item) => item.id === 'l2a')?.title);
    assert.equal(before?.release, '2026.1');
    const now = courseSetup(context, 'c-math').pack;
    assert.equal(recordPack(context, recordOn(book, '2026-09-22')), now);
    const unrecorded = {
      ...recordOn(book, '2026-09-22'),
      session: { ...recordOn(book, '2026-09-22').session, key: 'x' },
    };
    assert.equal(recordPack(context, unrecorded), now);
    assert.equal(recordPack(context, recordOn(book, '2026-09-21')), before);
  });
});
