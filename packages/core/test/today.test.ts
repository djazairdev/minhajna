// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  current,
  nextSession,
  recordsForRoute,
  todayView,
  undoSession,
  type OutboundRoute,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';

describe('Today', () => {
  it("lists the day's sessions with their proposals", async () => {
    const view = todayView(contextOf(await openBook(cemEvents())), d('2026-09-20'));
    assert.equal(view.sessions.length, 1);
    const [first] = view.sessions;
    assert.equal(first?.status, 'awaiting');
    assert.equal(first?.proposal?.item.id, 'd1');
    assert.equal(first?.course.id, 'c-math');
    assert.equal(view.awaitingEarlier, 0);
    assert.deepEqual(view.marks, []);
  });

  it('states how many earlier sessions await confirmation', async () => {
    const view = todayView(contextOf(await openBook(cemEvents())), d('2026-09-27'));
    assert.equal(view.awaitingEarlier, 5);
  });

  // Monday reached only stage 1, so Wednesday finished l1.
  it('confirms a whole week at once, marking only the exceptions', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const week = awaitingBetween(context, d('2026-09-20'), d('2026-09-24'));
    const monday = week.find((session) => session.day === '2026-09-21');
    assert.ok(monday);
    const events = confirmSessions(
      context,
      week.map((session) =>
        session === monday
          ? { session, choice: { outcome: 'partial', reached: 1 }, privateNote: 'Made-up private note' }
          : { session },
      ),
    );
    assert.deepEqual(
      events.map((event) => event.kind),
      [
        'session.recorded',
        'session.recorded',
        'session.noted',
        'session.recorded',
        'session.recorded',
        'session.recorded',
      ],
    );
    await book.recordAll(d('2026-09-24'), events);

    const after = contextOf(book);
    assert.equal(awaitingBetween(after, d('2026-09-20'), d('2026-09-24')).length, 0);
    const thursday = todayView(after, d('2026-09-24')).sessions[0];
    assert.equal(thursday?.status, 'recorded');
    const wednesday = todayView(after, d('2026-09-23')).sessions[0];
    assert.deepEqual(wednesday?.record?.coverage, [{ op: 'taught', item: 'l1', from: 1, to: 4 }]);
  });

  it('marks an exam window for some grades only, on the day of a class it covers', async () => {
    const book = await openBook(cemEvents());
    const exam = (id: string, grade: string) => ({
      kind: 'calendar.set' as const,
      entry: {
        id,
        layer: 'national' as const,
        from: d('2026-10-20'),
        to: d('2026-10-20'),
        effect: 'exam' as const,
        grades: [grade],
        name: { en: `Made-up exams for ${grade}` },
        source: 'made up for tests',
        confidence: 'announced' as const,
      },
    });
    await book.recordAll(d('2026-10-01'), [exam('exam-1am', '1am'), exam('exam-4am', '4am')]);
    const view = todayView(contextOf(book), d('2026-10-20'));
    assert.deepEqual(
      view.marks.map((mark) => mark.id),
      ['exam-1am'],
    );
    assert.equal(view.sessions[0]?.status, 'calendar');
    assert.equal(view.sessions[0]?.session.calendarEntry, 'exam-1am');
  });

  it('gives the next session the calendar leaves to teach', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const next = (day: string) => nextSession(context, d(day))?.day ?? null;
    assert.equal(next('2026-10-27'), '2026-10-28');
    assert.equal(next('2026-10-28'), '2026-11-08');
    assert.equal(next('2026-11-17'), '2026-11-19');
    assert.equal(next('2026-12-08'), '2026-12-13');
    assert.equal(next(context.ref.year.to), null);
  });

  it('marks holidays and the sessions they replace', async () => {
    const view = todayView(contextOf(await openBook(cemEvents())), d('2026-10-29'));
    assert.deepEqual(
      view.marks.map((mark) => mark.id),
      ['autumn'],
    );
    assert.equal(view.sessions[0]?.status, 'calendar');
    assert.equal(view.sessions[0]?.proposal, null);
  });

  it("shows the teacher's own time", async () => {
    const view = todayView(contextOf(await openBook(primaryEvents())), d('2026-09-22'));
    assert.deepEqual(view.blocks, [{ weekday: 2, half: 'afternoon', label: 'Teacher time' }]);
  });

  // The reason is private: the session's note keeps it, never its record.
  it('undoes the one tap that confirmed a session, and keeps both changes in the history', async () => {
    const book = await openBook(cemEvents());
    const [sunday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    assert.ok(sunday);
    const before = todayView(contextOf(book), d('2026-09-20'));
    const entries = book.entries.length;
    await book.recordAll(d('2026-09-20'), confirmSessions(contextOf(book), [{ session: sunday }]));
    assert.equal(todayView(contextOf(book), d('2026-09-20')).sessions[0]?.status, 'recorded');
    const undo = undoSession(contextOf(book), sunday.key);
    assert.deepEqual(undo, {
      kind: 'session.withdrawn',
      session: { key: sunday.key, courseId: 'c-math', groupId: sunday.groupId, day: sunday.day, slot: sunday.slot },
    });
    await book.record(d('2026-09-20'), undo);
    assert.equal(book.entries.length, entries + 2);
    assert.deepEqual(todayView(contextOf(book), d('2026-09-20')), before);
    assert.deepEqual(awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20')), [sunday]);
    assert.equal(book.state.sessions.get(sunday.key)?.[0]?.value?.outcome, 'done');
    assert.equal(current(book.state.sessions.get(sunday.key)), null);
    assert.deepEqual(
      recordsForRoute(book.state, 'documents').filter((event) => event.kind.startsWith('session.')),
      [],
    );
    assert.equal(undoSession(contextOf(book), sunday.key), null);
  });

  it('undoes a correction by bringing back the version before it', async () => {
    const book = await openBook(cemEvents());
    const [sunday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    assert.ok(sunday);
    await book.recordAll(d('2026-09-20'), confirmSessions(contextOf(book), [{ session: sunday }]));
    const done = current(book.state.sessions.get(sunday.key));
    await book.recordAll(
      d('2026-09-21'),
      confirmSessions(contextOf(book), [{ session: sunday, choice: { outcome: 'not-held' } }]),
    );
    const undo = undoSession(contextOf(book), sunday.key);
    assert.deepEqual(undo, { kind: 'session.recorded', record: done });
    await book.record(d('2026-09-21'), undo);
    assert.deepEqual(current(book.state.sessions.get(sunday.key)), done);
    assert.equal(book.state.sessions.get(sunday.key)?.length, 3);
  });

  it('corrects a session and keeps both versions', async () => {
    const book = await openBook(cemEvents());
    const [sunday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    assert.ok(sunday);
    await book.recordAll(d('2026-09-20'), confirmSessions(contextOf(book), [{ session: sunday }]));
    await book.recordAll(
      d('2026-09-22'),
      confirmSessions(contextOf(book), [
        { session: sunday, choice: { outcome: 'not-held' }, reason: 'Recorded on the wrong day' },
      ]),
    );
    const versions = book.state.sessions.get(sunday.key);
    assert.equal(versions?.length, 2);
    assert.equal(versions?.[0]?.value?.outcome, 'done');
    assert.equal(versions?.[1]?.day, '2026-09-22');
    assert.equal(current(versions)?.outcome, 'not-held');
    assert.equal(versions?.[1]?.reason, undefined);
    assert.equal(book.state.notes.get(sunday.key)?.reasonText, 'Recorded on the wrong day');
  });

  // A correction's reason goes into the note too, which keeps what it said
  // before.
  it("keeps a reason in the teacher's own words in the private note, never in the session record", async () => {
    const book = await openBook(cemEvents());
    const [sunday] = awaitingBetween(contextOf(book), d('2026-09-20'), d('2026-09-20'));
    assert.ok(sunday);
    const events = confirmSessions(contextOf(book), [
      {
        session: sunday,
        choice: { outcome: 'not-held' },
        privateReason: 'teacher-absent',
        reason: 'Made-up: I was ill',
      },
    ]);
    assert.deepEqual(
      events.map((event) => event.kind),
      ['session.recorded', 'session.noted'],
    );
    assert.doesNotMatch(JSON.stringify(events[0]), /ill/);
    await book.recordAll(d('2026-09-20'), events);

    await book.recordAll(
      d('2026-09-22'),
      confirmSessions(contextOf(book), [
        { session: sunday, choice: { outcome: 'not-held' }, reason: 'Made-up: a note came in' },
      ]),
    );
    assert.deepEqual(book.state.notes.get(sunday.key), {
      sessionKey: sunday.key,
      reason: 'teacher-absent',
      reasonText: 'Made-up: a note came in',
    });
    const outbound: readonly OutboundRoute[] = [
      'seating-plan-printout',
      'documents',
      'statement',
      'handover',
      'handover-direct',
      'school-space',
    ];
    for (const route of outbound) {
      assert.doesNotMatch(JSON.stringify(recordsForRoute(book.state, route)), /Made-up|teacher-absent/, route);
    }
  });
});
