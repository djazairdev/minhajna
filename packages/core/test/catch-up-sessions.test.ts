// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Catch-up sessions (#228, answers 353 to 355): a plan session on a day and
// a slot from today on, never where the teacher teaches; the free times
// offered; the make-ups due it can name, due again once it is cancelled;
// and no cancelling once it is recorded. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addCatchUp,
  cancelCatchUp,
  confirmSessions,
  freeSlots,
  makeUpsDue,
  recordsForRoute,
  sessionsBetween,
  todayView,
  type RecordBook,
  type Slot,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const today = d('2026-10-04');
const m1: Slot = { half: 'morning', index: 1 };
const m2: Slot = { half: 'morning', index: 2 };

/**
 * The class with Sunday's session not held and marked to be made up, and
 * the teacher's own time on Monday's first slot.
 */
async function owed(): Promise<RecordBook> {
  const book = await openBook(
    cemEvents().map((event) =>
      event.kind === 'timetable.set'
        ? {
            ...event,
            version: { ...event.version, blocks: [{ weekday: 1, half: 'morning', index: 1, label: 'Example' }] },
          }
        : event,
    ),
  );
  const context = contextOf(book);
  const [sunday] = sessionsBetween(context, today, today);
  assert.ok(sunday);
  await book.recordAll(
    today,
    confirmSessions(context, [{ session: sunday, choice: { outcome: 'not-held', makeUp: true } }]),
  );
  return book;
}

describe('catch-up sessions', () => {
  it('take the plan’s next item on the day and slot chosen, and make up the session named', async () => {
    const book = await owed();
    const [due] = makeUpsDue(contextOf(book), 'c-math');
    assert.ok(due);
    assert.equal(due.key, 'c-math/2026-10-04/m1/g-all');
    const event = addCatchUp(
      contextOf(book),
      { id: 'u-1', courseId: 'c-math', day: d('2026-10-06'), slot: m1 },
      today,
      due.key,
    );
    assert.deepEqual(event, {
      kind: 'catchup.set',
      catchUp: {
        id: 'u-1',
        courseId: 'c-math',
        groupId: 'g-all',
        day: d('2026-10-06'),
        slot: m1,
        sessionType: 'lesson',
        replaces: due.key,
      },
    });
    await book.record(today, event);
    assert.deepEqual(makeUpsDue(contextOf(book), 'c-math'), []);
    const view = todayView(contextOf(book), d('2026-10-06'));
    const added = view.sessions.find((one) => one.session.catchUp === 'u-1');
    assert.equal(added?.session.calendar, null);
    assert.equal(added?.status, 'awaiting');
    assert.ok(added?.proposal);
    assert.deepEqual(
      recordsForRoute(book.state, 'statement').flatMap((record) =>
        record.kind === 'catchup.set' ? [record.catchUp.id] : [],
      ),
      ['u-1'],
    );
    await book.record(today, cancelCatchUp(contextOf(book), 'u-1'));
    assert.deepEqual(
      makeUpsDue(contextOf(book), 'c-math').map((one) => one.key),
      [due.key],
    );
    assert.equal(
      sessionsBetween(contextOf(book), d('2026-10-06'), d('2026-10-06')).some((one) => one.catchUp !== undefined),
      false,
    );
  });

  it('refuse a past day, a slot taken, and a make-up that is not due', async () => {
    const book = await owed();
    const add = (day: string, slot: Slot, id = 'u-2', replaces?: string) =>
      addCatchUp(contextOf(book), { id, courseId: 'c-math', day: d(day), slot }, today, replaces);
    assert.throws(() => add('2026-10-01', m2), /from today on/);
    assert.throws(() => add('2026-10-05', m2), /a session at this time/);
    assert.throws(() => add('2027-07-01', m2), /outside the school year/);
    assert.throws(() => add('2026-10-06', m2, 'u-2', 'c-math/2026-10-05/m2/g-all'), /make-up due/);
    await book.record(today, add('2026-10-06', m2));
    assert.throws(() => add('2026-10-06', m2, 'u-3'), /a session at this time/);
    assert.throws(() => add('2026-10-07', m2), /exists/);
    assert.equal(makeUpsDue(contextOf(book), 'c-math').length, 1);
  });

  it('offer the next free times on school days, around the teacher’s sessions, own time and catch-ups', async () => {
    const book = await owed();
    await book.record(
      today,
      addCatchUp(contextOf(book), { id: 'u-1', courseId: 'c-math', day: d('2026-10-06'), slot: m1 }, today),
    );
    assert.deepEqual(
      freeSlots(contextOf(book), 'c-math', today, d('2026-10-17'), () => [m1, m2]).map(
        (one) => `${one.day} ${one.slot.half}-${one.slot.index}`,
      ),
      [
        '2026-10-04 morning-2',
        '2026-10-06 morning-2',
        '2026-10-07 morning-1',
        '2026-10-07 morning-2',
        '2026-10-08 morning-2',
        '2026-10-11 morning-2',
      ],
    );
    assert.equal(freeSlots(contextOf(book), 'c-math', today, d('2026-10-17'), () => [m1, m2], undefined, 2).length, 2);
    assert.deepEqual(
      freeSlots(contextOf(book), 'c-none', today, d('2026-10-17'), () => [m1]),
      [],
    );
  });

  it('stay once recorded', async () => {
    const book = await owed();
    await book.record(
      today,
      addCatchUp(contextOf(book), { id: 'u-1', courseId: 'c-math', day: today, slot: m2 }, today),
    );
    const context = contextOf(book);
    const added = sessionsBetween(context, today, today).find((one) => one.catchUp === 'u-1');
    assert.ok(added);
    await book.recordAll(today, confirmSessions(context, [{ session: added, choice: { outcome: 'done' } }]));
    assert.throws(() => cancelCatchUp(contextOf(book), 'u-1'), /stays/);
    assert.throws(() => cancelCatchUp(contextOf(book), 'u-9'), /No such/);
  });
});
