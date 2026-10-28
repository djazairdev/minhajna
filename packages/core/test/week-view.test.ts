// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The week at once (#251, answers 526 and 527), from a made-up class: the week
// that holds a day, from its first day, with its working days as Today has
// them, but for the earlier sessions' count, each course walked once; the
// timetable's slots in order; each cell's sessions; how many sessions are held
// and recorded, a recorded one counted at once; and a day a holiday takes, kept
// with its sessions but not counted.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { confirmSessions, slotKey, todayView, weekCell, weekView } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

describe('the week at once', () => {
  it('holds the working days of the week a day falls in, as Today has them, and the slots in order', async () => {
    const book = await openBook(cemEvents());
    const week = weekView(contextOf(book), d('2026-09-23'));
    assert.equal(week.start, d('2026-09-20'));
    assert.deepEqual(
      week.days.map((view) => view.day),
      ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].map(d),
    );
    for (const view of week.days)
      assert.deepEqual(view, { ...todayView(contextOf(book), view.day), awaitingEarlier: 0 });
    assert.deepEqual(week.slots.map(slotKey), ['m1', 'm2', 'm3', 'm4', 'a1', 'a2', 'a3', 'a4']);
    const sessions = week.days.flatMap((view) => view.sessions);
    assert.ok(sessions.length > 0);
    assert.equal(week.held, sessions.length);
    assert.equal(week.recorded, 0);
  });

  it('gives each cell its sessions, and counts a recorded one at once', async () => {
    const book = await openBook(cemEvents());
    const before = weekView(contextOf(book), d('2026-09-20'));
    const first = before.days.flatMap((view) => view.sessions)[0]!;
    const view = before.days.find((one) => one.day === first.session.day)!;
    assert.deepEqual(weekCell(view, first.session.slot), [first]);
    assert.deepEqual(weekCell(view, { half: 'afternoon', index: 4 }), []);
    await book.recordAll(
      first.session.day,
      confirmSessions(contextOf(book), [{ session: first.session, choice: { outcome: 'done' } }]),
    );
    const after = weekView(contextOf(book), d('2026-09-20'));
    for (const one of after.days) assert.deepEqual(one, { ...todayView(contextOf(book), one.day), awaitingEarlier: 0 });
    assert.equal(after.recorded, 1);
    assert.equal(after.held, before.held);
  });

  it('keeps a day a holiday takes, with its sessions, and counts none of them', async () => {
    const book = await openBook(cemEvents());
    const week = weekView(contextOf(book), d('2026-10-27'));
    for (const one of week.days) assert.deepEqual(one, { ...todayView(contextOf(book), one.day), awaitingEarlier: 0 });
    const thursday = week.days.find((view) => view.day === d('2026-10-29'));
    assert.ok(thursday !== undefined && thursday.sessions.length > 0);
    assert.ok(thursday.sessions.every((item) => item.status === 'calendar'));
    const all = week.days.flatMap((view) => view.sessions);
    const open = all.filter((item) => item.session.day !== d('2026-10-29'));
    assert.ok(open.every((item) => item.status !== 'calendar'));
    assert.equal(week.held, open.length);
    assert.equal(week.held, all.length - thursday.sessions.length);
  });
});
