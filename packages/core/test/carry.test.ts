// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «نتيجة أخرى» needs from the core (#33): where what is left of an item
// goes on, and the teacher's make-up mark on a session not held. Made-up
// data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awaitingBetween, carryTo, confirmSessions, current, recordsForRoute } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

describe('carryTo', () => {
  it('goes on in the next session of the same group and queue', async () => {
    const book = await openBook(cemEvents());
    const [sunday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    assert.ok(sunday);
    const { next, passed } = carryTo(contextOf(book), sunday);
    assert.equal(next?.day, d('2026-09-21'));
    assert.equal(next?.groupId, 'g-all');
    assert.equal(passed, null);
  });

  it('passes over a session of another kind, such as a test', async () => {
    const book = await openBook(cemEvents());
    const [sunday, monday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-21'));
    assert.ok(sunday && monday);
    await book.recordAll(
      d('2026-09-21'),
      confirmSessions(contextOf(book), [{ session: monday, details: { sessionType: 'test' } }]),
    );
    const { next, passed } = carryTo(contextOf(book), sunday);
    assert.equal(next?.day, d('2026-09-23'));
    assert.equal(passed?.day, d('2026-09-21'));
  });

  it('finds nothing after the year ends', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const [last] = awaitingBetween(context, d('2027-05-01'), d('2027-08-31')).slice(-1);
    assert.ok(last);
    assert.deepEqual(carryTo(context, last), { next: null, passed: null });
  });
});

describe('the make-up mark', () => {
  it('is kept on a session not held only when the teacher marks it, and travels with the record', async () => {
    const book = await openBook(cemEvents());
    const [sunday, monday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-21'));
    assert.ok(sunday && monday);
    await book.recordAll(
      d('2026-09-21'),
      confirmSessions(contextOf(book), [
        { session: sunday, choice: { outcome: 'not-held', makeUp: true }, privateReason: 'teacher-absent' },
        { session: monday, choice: { outcome: 'not-held' } },
      ]),
    );
    assert.equal(current(book.state.sessions.get(sunday.key))?.makeUp, true);
    assert.equal(current(book.state.sessions.get(monday.key))?.makeUp, undefined);
    const shared = JSON.stringify(recordsForRoute(book.state, 'school-space'));
    assert.match(shared, /"makeUp":true/);
    assert.doesNotMatch(shared, /teacher-absent/);
  });
});
