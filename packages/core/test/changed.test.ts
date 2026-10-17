// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the session's details need from the core (#34): another lesson than
// the one proposed, content from outside the plan, and a correction that
// keeps both versions with its coded reason while its words stay private.
// Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  current,
  proposalAt,
  recordsForRoute,
  todayView,
  type OutboundRoute,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

async function week() {
  const book = await openBook(cemEvents());
  const [sunday, monday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-21'));
  assert.ok(sunday && monday);
  return { book, sunday, monday };
}

describe('another lesson', () => {
  it('teaches the chosen item, and the proposed one stays first', async () => {
    const { book, sunday } = await week();
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(contextOf(book), [{ session: sunday, choice: { outcome: 'changed', item: 'l3' } }]),
    );
    assert.deepEqual(current(book.state.sessions.get(sunday.key)), {
      session: { key: sunday.key, courseId: 'c-math', groupId: 'g-all', day: d('2026-09-20'), slot: sunday.slot },
      outcome: 'changed',
      sessionType: 'lesson',
      coverage: [{ op: 'taught', item: 'l3', from: 0, to: 1 }],
    });
    assert.equal(todayView(contextOf(book), d('2026-09-21')).sessions[0]?.proposal?.item.id, 'd1');
  });

  it('stops at the stage reached, and refuses a finished item or a stage outside it', async () => {
    const { book, sunday, monday } = await week();
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(contextOf(book), [{ session: sunday, choice: { outcome: 'changed', item: 'l2', reached: 2 } }]),
    );
    assert.deepEqual(current(book.state.sessions.get(sunday.key))?.coverage, [
      { op: 'taught', item: 'l2', from: 0, to: 2 },
    ]);
    assert.throws(
      () =>
        confirmSessions(contextOf(book), [{ session: monday, choice: { outcome: 'changed', item: 'l2', reached: 9 } }]),
      RangeError,
    );
    await book.recordAll(
      d('2026-09-21'),
      confirmSessions(contextOf(book), [{ session: monday, choice: { outcome: 'changed', item: 'l3' } }]),
    );
    const [wednesday] = awaitingBetween(contextOf(book), d('2026-09-23'), d('2026-09-23'));
    assert.ok(wednesday);
    assert.throws(
      () => confirmSessions(contextOf(book), [{ session: wednesday, choice: { outcome: 'changed', item: 'l3' } }]),
      RangeError,
    );
  });

  it('records content from outside the plan, which moves no item', async () => {
    const { book, sunday } = await week();
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(contextOf(book), [
        { session: sunday, choice: { outcome: 'changed' }, details: { unplanned: 'Made-up: a school visit' } },
      ]),
    );
    assert.deepEqual(current(book.state.sessions.get(sunday.key)), {
      session: { key: sunday.key, courseId: 'c-math', groupId: 'g-all', day: d('2026-09-20'), slot: sunday.slot },
      outcome: 'changed',
      sessionType: 'lesson',
      coverage: [],
      unplanned: 'Made-up: a school visit',
    });
    assert.equal(todayView(contextOf(book), d('2026-09-21')).sessions[0]?.proposal?.item.id, 'd1');
  });
});

describe('a correction', () => {
  it('keeps both versions with its coded reason, and its words in the private note only', async () => {
    const { book, sunday } = await week();
    await book.recordAll(d('2026-09-20'), confirmSessions(contextOf(book), [{ session: sunday }]));
    await book.recordAll(
      d('2026-09-22'),
      confirmSessions(contextOf(book), [
        {
          session: sunday,
          details: { homework: { text: 'Made-up: exercise 5', due: d('2026-09-21') } },
          correction: 'other',
          reason: 'Made-up: forgot the homework',
        },
      ]),
    );
    const versions = book.state.sessions.get(sunday.key);
    assert.equal(versions?.length, 2);
    assert.equal(versions?.[0]?.value?.homework, undefined);
    assert.equal(versions?.[1]?.value?.homework?.text, 'Made-up: exercise 5');
    assert.equal(versions?.[1]?.day, d('2026-09-22'));
    assert.equal(versions?.[1]?.reason, 'other');
    assert.equal(book.state.notes.get(sunday.key)?.reasonText, 'Made-up: forgot the homework');
    const outbound: readonly OutboundRoute[] = [
      'documents',
      'statement',
      'handover',
      'handover-direct',
      'school-space',
    ];
    for (const route of outbound) {
      assert.doesNotMatch(JSON.stringify(recordsForRoute(book.state, route)), /forgot/, route);
    }
  });
});

describe('correcting a session', () => {
  it('starts from the proposal the session had, its own record set aside', async () => {
    const { book, sunday, monday } = await week();
    const before = proposalAt(contextOf(book), monday);
    await book.recordAll(d('2026-09-21'), confirmSessions(contextOf(book), [{ session: sunday }, { session: monday }]));
    assert.equal(before?.item.id, 'l1');
    assert.deepEqual(proposalAt(contextOf(book), monday), before);
    assert.equal(proposalAt(contextOf(book), sunday)?.item.id, 'd1');
  });

  it('takes a detail out with null, and the version before keeps it', async () => {
    const { book, sunday } = await week();
    await book.recordAll(
      d('2026-09-20'),
      confirmSessions(contextOf(book), [
        {
          session: sunday,
          details: { homework: { text: 'Made-up: exercise 5', due: d('2026-09-21') }, factual: 'Kept' },
        },
      ]),
    );
    await book.recordAll(
      d('2026-09-22'),
      confirmSessions(contextOf(book), [{ session: sunday, details: { homework: null }, correction: 'entry-error' }]),
    );
    const versions = book.state.sessions.get(sunday.key);
    assert.equal(versions?.[0]?.value?.homework?.text, 'Made-up: exercise 5');
    assert.equal(versions?.[1]?.value?.homework, undefined);
    assert.equal(versions?.[1]?.value?.factual, 'Kept');
    assert.equal(versions?.[1]?.reason, 'entry-error');
  });
});
