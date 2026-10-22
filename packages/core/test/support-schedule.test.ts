// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Scheduled support sessions (#228, answers 361 and 362): a free time taken
// for support, which takes the teacher's time but is no plan session and
// makes up nothing; paired in order with the items left; ended by the
// logged session that names it, once only; cancelled only before that, and
// scheduled again when that session is removed; logged from its day on,
// with its paired item. An added support day's sessions take the teacher's
// time too. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addCatchUp,
  addSessionsDay,
  busySlots,
  cancelCatchUp,
  clashOf,
  extraRemoval,
  freeSlots,
  logExtra,
  openCatchUps,
  saveSupportQueue,
  scheduledSupport,
  sessionsBetween,
  supportItemFor,
  type AddedDay,
  type ExtraSession,
  type RecordBook,
  type Slot,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const today = d('2026-10-04');
const tuesday = d('2026-10-06');
const m2: Slot = { half: 'morning', index: 2 };
const items = [
  { id: 's1', title: 'أ (مثال)' },
  { id: 's2', title: 'ب (مثال)' },
];

/** The class's support queue, and support sessions on Tuesday 6 and Wednesday 7 October at the second slot. */
async function scheduled(): Promise<RecordBook> {
  const book = await openBook(cemEvents());
  await book.record(today, saveSupportQueue(book.state, { courseId: 'c-math', items }));
  for (const [id, day] of [
    ['u-1', '2026-10-06'],
    ['u-2', '2026-10-07'],
  ] as const) {
    const input = { id, courseId: 'c-math', day: d(day), slot: m2, kind: 'support' as const };
    await book.record(today, addCatchUp(contextOf(book), input, today));
  }
  return book;
}

const logged = (scheduled: string, kind: ExtraSession['kind'] = 'support', id = 'x1'): ExtraSession => ({
  id,
  courseId: 'c-math',
  kind,
  day: d('2026-10-06'),
  from: '09:00',
  to: '10:00',
  scheduled,
});

describe('scheduled support sessions', () => {
  it('take the teacher’s time without being plan sessions, and pair with the items left', async () => {
    const book = await scheduled();
    const context = contextOf(book);
    assert.equal(
      sessionsBetween(context, d('2026-10-06'), d('2026-10-07')).some((one) => one.catchUp !== undefined),
      false,
    );
    assert.equal(clashOf(context, 'c-math', d('2026-10-06'), m2)?.courseId, 'c-math');
    assert.deepEqual(openCatchUps(context, 'c-math'), []);
    assert.deepEqual(
      scheduledSupport(contextOf(book), 'c-math', today).map((one) => [one.catchUp.id, one.item?.id ?? null]),
      [
        ['u-1', 's1'],
        ['u-2', 's2'],
      ],
    );
    const input = { id: 'u-3', courseId: 'c-math', day: d('2026-10-08'), slot: m2, kind: 'support' as const };
    assert.throws(() => addCatchUp(context, input, today, 'c-math/2026-10-04/m1/g-all'), /makes up no session/);
  });

  it('end once a logged session names them, and come back when it is removed', async () => {
    const book = await scheduled();
    assert.throws(() => logExtra(contextOf(book), logged('u-1', 'review'), tuesday), /Only a support session/);
    assert.throws(() => logExtra(contextOf(book), logged('u-9'), tuesday), /No such scheduled/);
    await book.recordAll(today, logExtra(contextOf(book), { ...logged('u-1'), item: 's1', finished: true }, tuesday));
    assert.deepEqual(
      scheduledSupport(contextOf(book), 'c-math', today).map((one) => [one.catchUp.id, one.item?.id ?? null]),
      [['u-2', 's2']],
    );
    assert.throws(() => logExtra(contextOf(book), logged('u-1', 'support', 'x2'), tuesday), /is logged/);
    assert.throws(() => cancelCatchUp(contextOf(book), 'u-1'), /stays/);
    assert.deepEqual(cancelCatchUp(contextOf(book), 'u-2'), { kind: 'catchup.removed', id: 'u-2' });
    await book.recordAll(today, extraRemoval('x1', false));
    assert.deepEqual(
      scheduledSupport(contextOf(book), 'c-math', today).map((one) => [one.catchUp.id, one.item?.id ?? null]),
      [
        ['u-1', 's1'],
        ['u-2', 's2'],
      ],
    );
  });

  it('leave their times busy for added days and other catch-up sessions', async () => {
    const fresh = contextOf(await openBook(cemEvents()));
    const wednesday = d('2026-10-07');
    const slotsOn = () => [m2];
    assert.equal(busySlots(fresh, tuesday).has('m2'), false);
    assert.equal(freeSlots(fresh, 'c-math', tuesday, wednesday, slotsOn).length, 2);
    const context = contextOf(await scheduled());
    assert.equal(busySlots(context, tuesday).has('m2'), true);
    assert.deepEqual(freeSlots(context, 'c-math', tuesday, wednesday, slotsOn), []);
  });

  it('are logged from their day on, each with its paired item', async () => {
    const book = await scheduled();
    const later = { ...logged('u-2'), item: 's2' };
    assert.throws(() => logExtra(contextOf(book), later, tuesday), /from its day on/);
    assert.equal(supportItemFor(contextOf(book), 'c-math', today, 'u-2')?.id, 's2');
    assert.equal(supportItemFor(contextOf(book), 'c-math', today)?.id, 's1');
    const wednesday = d('2026-10-07');
    await book.recordAll(wednesday, logExtra(contextOf(book), { ...later, day: wednesday }, wednesday));
    assert.deepEqual(
      scheduledSupport(contextOf(book), 'c-math', today).map((one) => [one.catchUp.id, one.item?.id ?? null]),
      [['u-1', 's1']],
    );
  });

  it('leave out the times of an added support day', async () => {
    const book = await openBook(cemEvents());
    const sunday = d('2026-10-11');
    const m3: Slot = { half: 'morning', index: 3 };
    assert.equal(freeSlots(contextOf(book), 'c-math', sunday, sunday, () => [m3]).length, 1);
    const day: AddedDay = {
      id: 'add-1',
      schoolId: 's-cem',
      day: sunday,
      adds: 'support',
      follows: 3,
      takes: ['c-math/m3/g-all/every'],
      name: { en: 'Support day' },
      source: "Director's notice",
      confidence: 'announced',
    };
    await book.record(today, addSessionsDay(contextOf(book), day));
    const context = contextOf(book);
    assert.deepEqual(
      freeSlots(context, 'c-math', sunday, sunday, () => [m3]),
      [],
    );
    assert.equal(clashOf(context, 'c-math', sunday, m3)?.courseId, 'c-math');
  });
});
