// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The distributions' harder cases (#237, answers 421 and 422): half-groups
// that take each lesson in turn, and a rotation's groups, counting once a
// round; a day the calendar takes; skipped items and a session that taught
// nothing from the plan; a merge across two sequences counting in each; a plan
// by weeks going by plan week; and the plan's end. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  annualDistribution,
  confirmSessions,
  distributionSessions,
  halfTurns,
  monthlyDistribution,
  rotationCredits,
  sessionsBetween,
  setCalendarEntry,
  termlyDistribution,
  type Context,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';
import { labEvents } from './half-fixtures.ts';
import { rotatingBook } from './rotation-fixtures.ts';

const rows = (context: Context, courseId = 'c-math') =>
  distributionSessions(context, courseId).map(
    (one) => `${one.session.day} ${one.session.groupId} ${one.items.map((item) => item.id).join('+')} ${one.credit}`,
  );

const counted = (context: Context) =>
  annualDistribution(context, 'c-math').map((row) => [row.id, row.from, row.to, row.sessions]);

describe('distributions of groups in turn', () => {
  it('counts half-groups in turn once a pair, on the second half’s day', async () => {
    const context = contextOf(await openBook(labEvents()));
    const sessions = distributionSessions(context, 'c-math');
    assert.deepEqual(rows(context).slice(2, 8), [
      '2026-09-22 g-1 l1 0',
      '2026-09-23 g-all l1 1',
      '2026-09-24 g-all l2 1',
      '2026-09-27 g-all l3 1',
      '2026-09-28 g-all l4 1',
      '2026-09-29 g-2 l4 1',
    ]);
    const total = sessions.reduce((sum, one) => sum + one.credit, 0);
    assert.equal(
      total,
      rotationCredits(
        sessions.map((one) => one.session),
        halfTurns(context),
      ),
    );
    assert.deepEqual(counted(context), [
      ['d1', '2026-09-20', '2026-09-20', 1],
      ['u1', '2026-09-21', '2026-10-05', 10],
      ['u2', '2026-10-07', '2026-10-14', 6],
    ]);
    assert.equal(termlyDistribution(context, 'c-math', sessions)[0]?.sessions, total);
    assert.deepEqual(
      monthlyDistribution(context, 'c-math', '2026-09', sessions).map((week) => week.sessions),
      [4, 4],
    );
    const turns = sessions.filter((one) => one.credit === 0);
    assert.deepEqual(monthlyDistribution(context, 'c-math', '2026-09', turns), []);
    assert.deepEqual(termlyDistribution(context, 'c-math', turns), []);
  });

  it('counts a rotation’s groups once a round, on the last group’s day', async () => {
    const context = contextOf(await rotatingBook());
    assert.deepEqual(rows(context).slice(0, 4), [
      '2026-09-20 g-1 d1 0',
      '2026-09-21 g-2 d1 1',
      '2026-09-23 g-2 l1 0',
      '2026-09-24 g-1 l1 1',
    ]);
    assert.deepEqual(counted(context), [
      ['d1', '2026-09-21', '2026-09-21', 1],
      ['u1', '2026-09-24', '2026-10-12', 9],
      ['u2', '2026-10-14', '2026-10-21', 5],
    ]);
  });
});

describe('distributions of a changed year', () => {
  it('leaves out a day the calendar takes, and the plan moves on', async () => {
    const book = await openBook(cemEvents());
    await book.record(
      d('2026-09-19'),
      setCalendarEntry(contextOf(book), {
        id: 'closed',
        layer: 'school',
        schoolId: 's-cem',
        from: d('2026-09-23'),
        to: d('2026-09-23'),
        effect: 'closure',
        name: { en: 'Made-up closure' },
        source: 'Made-up school notice',
        confidence: 'announced',
      }),
    );
    const context = contextOf(book);
    assert.deepEqual(rows(context).slice(1, 3), ['2026-09-21 g-all l1 1', '2026-09-24 g-all l1 1']);
    assert.deepEqual(counted(context).at(-1), ['u2', '2026-10-08', '2026-10-15', 5]);
  });

  it('counts a merge across sequences in each, and no skipped item nor a session that taught none', async () => {
    const book = await openBook(cemEvents());
    const [sunday, monday, wednesday] = sessionsBetween(
      contextOf(book),
      d('2026-09-20'),
      d('2026-09-23'),
      new Set(['c-math']),
    ).filter((one) => one.groupId === 'g-all');
    assert.ok(sunday && monday && wednesday);
    await book.recordAll(
      d('2026-09-23'),
      confirmSessions(contextOf(book), [
        { session: sunday, choice: { outcome: 'merged', with: 'l1' } },
        { session: monday, choice: { outcome: 'skipped', instead: false } },
        { session: wednesday, choice: { outcome: 'skipped', instead: true } },
      ]),
    );
    const context = contextOf(book);
    assert.deepEqual(rows(context).slice(0, 3), [
      '2026-09-20 g-all d1+l1 1',
      '2026-09-23 g-all l4 1',
      '2026-09-24 g-all l4 1',
    ]);
    const [diagnostic, whole] = annualDistribution(context, 'c-math');
    assert.deepEqual(
      [diagnostic, whole].map((row) => [row?.id, row?.from, row?.sessions, row?.confirmed]),
      [
        ['d1', '2026-09-20', 1, 1],
        ['u1', '2026-09-20', 6, 2],
      ],
    );
    const september = monthlyDistribution(context, 'c-math', '2026-09');
    assert.deepEqual(
      september[0]?.resources.map((one) => one.id),
      ['d1', 'l1', 'l4'],
    );
  });

  it('ends with the plan, though the timetable goes on', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const last = distributionSessions(context, 'c-math').at(-1);
    assert.equal(last?.session.day, '2026-10-14');
    assert.ok(sessionsBetween(context, d('2026-10-15'), d('2026-10-31'), new Set(['c-math'])).length > 0);
    assert.deepEqual(monthlyDistribution(context, 'c-math', '2026-12'), []);
  });
});

describe('distributions of a plan by weeks', () => {
  it('goes by plan week when the plan has no sequences', async () => {
    const context = contextOf(await openBook(primaryEvents()));
    assert.deepEqual(annualDistribution(context, 'c-lang'), [
      { id: 'week-1', title: '', week: 1, from: '2026-09-20', to: '2026-09-21', sessions: 5, confirmed: 0 },
      { id: 'week-2', title: '', week: 2, from: '2026-09-22', to: '2026-09-27', sessions: 5, confirmed: 0 },
      { id: 'week-3', title: '', week: 3, from: '2026-09-27', to: '2026-09-27', sessions: 1, confirmed: 0 },
    ]);
    assert.deepEqual(
      termlyDistribution(context, 'c-lang')[0]?.sequences.map((one) => one.week),
      [1, 2, 3],
    );
  });
});
