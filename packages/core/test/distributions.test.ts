// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The distributions (#237, answers 416 and 421): the class's plan fitted to
// its timetable and the calendar for the year, confirmed sessions as taught
// and the rest projected; the main queue only, so the half-groups' TD is
// left out; a session not held counting for nothing; and the annual,
// monthly and termly views by sequence, teaching week and term. Made-up
// records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  annualDistribution,
  confirmSessions,
  distributionSessions,
  monthlyDistribution,
  sessionsBetween,
  termlyDistribution,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const row = (one: { session: { day: string; groupId: string }; items: readonly { id: string }[] }) =>
  `${one.session.day} ${one.session.groupId} ${one.items.map((item) => item.id).join('+')}`;

describe('distributions', () => {
  it('projects the main queue over the year, leaving the half-groups’ TD out', async () => {
    const book = await openBook(cemEvents());
    const sessions = distributionSessions(contextOf(book), 'c-math');
    assert.deepEqual(sessions.slice(0, 5).map(row), [
      '2026-09-20 g-all d1',
      '2026-09-21 g-all l1',
      '2026-09-23 g-all l1',
      '2026-09-24 g-all l2',
      '2026-09-27 g-all l3',
    ]);
    assert.equal(sessions.length, 15);
    assert.ok(sessions.every((one) => one.session.groupId === 'g-all' && !one.confirmed));
    assert.deepEqual(distributionSessions(contextOf(book), 'c-none'), []);
  });

  it('goes by sequence over the year, an item outside any standing as its own', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(annualDistribution(contextOf(book), 'c-math'), [
      { id: 'd1', title: 'Diagnostic assessment', from: '2026-09-20', to: '2026-09-20', sessions: 1, confirmed: 0 },
      { id: 'u1', title: 'Whole numbers', from: '2026-09-21', to: '2026-10-05', sessions: 9, confirmed: 0 },
      { id: 'u2', title: 'Fractions', from: '2026-10-07', to: '2026-10-14', sessions: 5, confirmed: 0 },
    ]);
  });

  it('goes by teaching week in a month, with each week’s resources once', async () => {
    const book = await openBook(cemEvents());
    const october = monthlyDistribution(contextOf(book), 'c-math', '2026-10');
    assert.deepEqual(
      october.map((week) => [week.week, week.from, week.to, week.sessions, week.resources.map((one) => one.id)]),
      [
        ['2026-09-27', '2026-10-01', '2026-10-01', 1, ['i1']],
        ['2026-10-04', '2026-10-04', '2026-10-08', 4, ['r1', 'l5']],
        ['2026-10-11', '2026-10-11', '2026-10-14', 3, ['l6', 'l7']],
      ],
    );
    assert.deepEqual(monthlyDistribution(contextOf(book), 'c-math', '2026-11'), []);
  });

  it('goes by term, with its days, sequences and sessions, and leaves out a term with none', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(annualDistribution(contextOf(book), 'c-none'), []);
    assert.deepEqual(termlyDistribution(contextOf(book), 'c-none'), []);
    assert.deepEqual(termlyDistribution(contextOf(book), 'c-math'), [
      {
        term: 1,
        from: '2026-09-20',
        to: '2026-12-17',
        sequences: [
          { id: 'd1', title: 'Diagnostic assessment' },
          { id: 'u1', title: 'Whole numbers' },
          { id: 'u2', title: 'Fractions' },
        ],
        sessions: 15,
      },
    ]);
  });

  it('counts confirmed sessions as taught, moves the rest, and leaves a session not held out', async () => {
    const book = await openBook(cemEvents());
    const [sunday, monday] = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-09-21'), new Set(['c-math']));
    assert.ok(sunday && monday);
    const events: RecordEvent[] = confirmSessions(contextOf(book), [
      { session: sunday },
      { session: monday, choice: { outcome: 'not-held' } },
    ]);
    await book.recordAll(d('2026-09-21'), events);
    const sessions = distributionSessions(contextOf(book), 'c-math');
    assert.deepEqual(sessions.slice(0, 3).map(row), [
      '2026-09-20 g-all d1',
      '2026-09-23 g-all l1',
      '2026-09-24 g-all l1',
    ]);
    assert.deepEqual(
      sessions.slice(0, 2).map((one) => one.confirmed),
      [true, false],
    );
    assert.deepEqual(annualDistribution(contextOf(book), 'c-math')[0], {
      id: 'd1',
      title: 'Diagnostic assessment',
      from: '2026-09-20',
      to: '2026-09-20',
      sessions: 1,
      confirmed: 1,
    });
  });

  it('counts every item a confirmed session taught, such as two merged lessons', async () => {
    const book = await openBook(cemEvents());
    const week = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-09-24'), new Set(['c-math']));
    const thursday = week.find((one) => one.day === '2026-09-24');
    assert.ok(thursday);
    const context = contextOf(book);
    await book.recordAll(
      d('2026-09-24'),
      confirmSessions(
        context,
        week
          .filter((one) => one.groupId === 'g-all')
          .map((session) =>
            session === thursday ? { session, choice: { outcome: 'merged', with: 'l3' } } : { session },
          ),
      ),
    );
    const sessions = distributionSessions(contextOf(book), 'c-math');
    assert.deepEqual(sessions.slice(0, 5).map(row), [
      '2026-09-20 g-all d1',
      '2026-09-21 g-all l1',
      '2026-09-23 g-all l1',
      '2026-09-24 g-all l2+l3',
      '2026-09-27 g-all l4',
    ]);
    assert.equal(annualDistribution(contextOf(book), 'c-math')[1]?.confirmed, 3);
  });
});
