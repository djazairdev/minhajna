// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's standing from its course's signed weeks (#549, answer 627): its
// place in the plan is the furthest item worked on, in the plan's order,
// whatever order the weeks come in and an earlier item gone back over, an item
// the plan does not hold and one passed over left out; how far it reached and
// whether it runs long come from its latest week; the sessions not held count
// those closed, as the totals say, a closure on an exam day among them, and the
// others, exam days left out, each session's day counted from its week's own
// first day; the sessions awaiting confirmation are counted; and a course with
// no week has no standing. Every course and item is made up.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  weekStanding,
  type Day,
  type ItemFigures,
  type PackItem,
  type WeekRecord,
  type WeekSession,
} from '../src/index.ts';

const items: PackItem[] = ['a', 'b', 'c', 'd'].map((id) => ({
  id: `item-${id}`,
  kind: 'lesson',
  title: `Lesson ${id}`,
}));
const CLOSED = new Set(['2026-11-16', '2026-11-24', '2026-12-07']);
const calendar = { closure: (day: Day) => CLOSED.has(day), exam: (day: Day) => day === '2026-12-07' };

const session = (day: number, state: WeekSession['state']): WeekSession =>
  ({ day, start: 480, end: 540, group: '', week: 'both', state }) as WeekSession;

function week(
  start: string,
  sessions: WeekSession[],
  figures: ItemFigures[],
  more: Partial<WeekRecord['totals']> = {},
) {
  const totals = { subject: 'math', items: figures, reached: 0, runsLong: false, covered: 0, closed: 0, ...more };
  return { course: 'made-up-course', week: start as Day, version: 0, totals, class: '1AM1', subject: 'math', sessions };
}

test('the place, the reach and the pace come from the plan’s order and the latest week', () => {
  const weeks: WeekRecord[] = [
    week('2026-11-29', [session(1, 'held')], [{ item: 'item-b', sessions: 1, outcome: 'taught' }], {
      reached: 500,
      runsLong: true,
    }),
    week('2026-11-22', [session(1, 'held')], [{ item: 'item-c', sessions: 1, outcome: 'taught' }], { reached: 400 }),
    week(
      '2026-12-06',
      [session(1, 'held')],
      [
        { item: 'item-d', sessions: 0, outcome: 'merged' },
        { item: 'made-up-other', sessions: 2, outcome: 'taught' },
      ],
      { reached: 650, runsLong: false },
    ),
  ];
  const standing = weekStanding(weeks, items, calendar)!;
  assert.deepEqual(standing.position, { id: 'item-c', title: 'Lesson c' });
  assert.deepEqual([standing.reached, standing.runsLong], [650, false]);
  assert.equal(weekStanding(weeks.slice(0, 1), items, calendar)!.runsLong, true);
  assert.equal(weekStanding(weeks, [], calendar)!.position, null);
});

test('sessions not held count closures and other causes, never exams, and awaiting ones are counted', () => {
  const weeks = [
    week('2026-11-15', [session(1, 'not-held'), session(2, 'not-held'), session(3, 'held')], [], { closed: 1 }),
    week('2026-12-06', [session(1, 'not-held'), session(2, 'not-held'), session(4, 'awaiting')], [], { closed: 1 }),
    week('2026-12-13', [session(0, 'awaiting'), session(1, 'held')], []),
  ];
  const standing = weekStanding(weeks, items, calendar)!;
  assert.deepEqual(standing.notHeld, { closure: 2, other: 2 });
  assert.equal(standing.awaiting, 2);
  assert.equal(standing.position, null);
});

test('a session’s day counts from its week’s own first day', () => {
  const monday = week('2026-11-23', [session(2, 'not-held'), session(3, 'not-held')], [], { closed: 1 });
  assert.deepEqual(weekStanding([monday], items, calendar)!.notHeld, { closure: 1, other: 1 });
});

test('a course with no signed week has no standing', () => {
  assert.equal(weekStanding([], items, calendar), null);
});
