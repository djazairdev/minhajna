// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which books still had a pupil whose data was erased (#248, answers 473 and
// 474): a pupil counts on the class's books of every period that began before
// the day they left, however late the erasure, and not on a later period's
// book, nor on another class's; none when the state has no erasures. A
// departure recorded ahead of its day waits for that day before the erasure,
// the fact keeps the day, and a fact without it falls back to the erasure's
// day. A pupil who only changed class is still at school and is not erased
// (answer 475). Made-up classes only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  confirmDeparture,
  eventOf,
  erasedFrom,
  erasedPupils,
  leavePupil,
  MemoryStore,
  RecordBook,
  type ErasedPupil,
} from '../src/index.ts';
import { cemEvents, contextOf, d } from './fixtures.ts';
import { deps } from './support.ts';

const erased: ErasedPupil[] = [
  { classId: 'k-1', place: 4, day: d('2026-12-05'), left: d('2026-10-14') },
  { classId: 'k-1', place: 9, day: d('2026-11-20'), left: d('2026-11-02') },
  { classId: 'k-2', place: 1, day: d('2026-10-20'), left: d('2026-10-18') },
];

/** 1AM2 with p02 recorded on 28 October as leaving on 5 November, confirmed on 29 October. */
async function leavingAhead(store = new MemoryStore()) {
  const book = await RecordBook.open(store, deps);
  await book.recordAll(d('2026-09-13'), cemEvents());
  await book.record(d('2026-10-28'), leavePupil(contextOf(book), 'p02', d('2026-11-05'), 'transfer'));
  await book.record(d('2026-10-29'), confirmDeparture(contextOf(book), 'p02'));
  return { book, store };
}

describe('erasedFrom', () => {
  it('counts the class’s pupils on the books of periods that began before they left', () => {
    assert.equal(erasedFrom(erased, 'k-1', d('2026-09-01')), 2);
    assert.equal(erasedFrom(erased, 'k-1', d('2026-10-13')), 2);
    assert.equal(erasedFrom(erased, 'k-1', d('2026-10-14')), 1);
    assert.equal(erasedFrom(erased, 'k-1', d('2026-11-01')), 1);
    assert.equal(erasedFrom(erased, 'k-1', d('2026-11-02')), 0);
    assert.equal(erasedFrom(erased, 'k-2', d('2026-10-01')), 1);
    assert.equal(erasedFrom(erased, 'k-3', d('2026-09-01')), 0);
  });

  it('counts none when the state has no erasures', () => {
    assert.equal(erasedFrom(undefined, 'k-1', d('2026-09-01')), 0);
    assert.equal(erasedFrom([], 'k-1', d('2026-09-01')), 0);
  });
});

describe('erasedPupils', () => {
  it('waits for a departure recorded ahead, then keeps its day however late the erasure', async () => {
    const { book } = await leavingAhead();
    await assert.rejects(book.erasePupil(d('2026-11-04'), 'p02'), /departure confirmed/);
    assert.equal(book.entries.filter((entry) => entry.kind === 'pupil.erased').length, 0);
    const fact = await book.erasePupil(d('2026-12-05'), 'p02');
    const event = eventOf(fact);
    assert.equal(event?.kind === 'pupil.erased' ? event.erased.left : null, d('2026-11-05'));
    const [one] = book.state.erasedPupils ?? [];
    assert.deepEqual([one?.day, one?.left], [d('2026-12-05'), d('2026-11-05')]);
    assert.equal(erasedFrom(book.state.erasedPupils, 'k-1am2', d('2026-11-01')), 1);
    assert.equal(erasedFrom(book.state.erasedPupils, 'k-1am2', d('2026-12-01')), 0);
    assert.deepEqual(erasedPupils(book.entries, new Map()), book.state.erasedPupils);
  });

  it('refuses a pupil who only changed class, however long ago', async () => {
    const book = await RecordBook.open(new MemoryStore(), deps);
    await book.recordAll(d('2026-09-13'), cemEvents());
    await book.record(d('2026-10-11'), leavePupil(contextOf(book), 'p02', d('2026-10-11'), 'class-change'));
    await book.record(d('2026-10-13'), confirmDeparture(contextOf(book), 'p02'));
    await assert.rejects(book.erasePupil(d('2026-12-05'), 'p02'), /departure confirmed/);
    assert.equal(book.state.pupils.has('p02'), true);
    assert.equal(book.entries.filter((entry) => entry.kind === 'pupil.erased').length, 0);
  });

  it('takes the erasure’s day for a fact that did not keep the departure’s', async () => {
    const { book, store } = await leavingAhead();
    const own = book.entries.find((entry) => {
      const event = eventOf(entry);
      return event?.kind === 'pupil.set' && event.pupil.id === 'p02';
    });
    assert.ok(own);
    await book.record(d('2026-11-09'), { kind: 'pupil.erased', erased: { classId: 'k-1am2', entries: [own.id] } });
    const reopened = await RecordBook.open(store, deps);
    assert.equal(reopened.state.pupils.has('p02'), false);
    assert.deepEqual(
      reopened.state.erasedPupils?.map((one) => one.left),
      [d('2026-11-09')],
    );
  });
});
