// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check line by line (#225, R-4.11-06, answers 296 to 300):
// what the timetable gives, what each calendar entry or test takes, what
// each day adding sessions gives, adding up to the check's own figures. A
// make-up day in a rotation takes the turn of the weekday it follows.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addSessionsDay,
  awaitingBetween,
  confirmSessions,
  rotationOn,
  sessionsBetween,
  setCalendarEntry,
  takeKey,
  termCheck,
  termCheckDetail,
  type AddedDay,
  type Context,
  type Day,
  type QueueDetail,
  type RecordEvent,
  type TermCheckDetail,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { rotatingBook, rotation } from './rotation-fixtures.ts';

/** What `detail`'s lines add up to, in each queue. */
const sum = (detail: QueueDetail) =>
  detail.scheduled -
  detail.taken.reduce((total, one) => total + one.sessions, 0) +
  detail.added.reduce((total, one) => total + one.sessions, 0);

/** The detail of `courseId` from `from`, checked against `termCheck` and its own lines. */
function checked(context: Context, courseId: string, from: Day): TermCheckDetail {
  const detail = termCheckDetail(context, courseId, from);
  assert.ok(detail !== null);
  assert.deepEqual(detail.check, termCheck(context, courseId, from));
  assert.equal(detail.main.left, detail.check.gives);
  assert.equal(detail.td.left, detail.check.td.gives);
  assert.equal(sum(detail.main), detail.main.left);
  assert.equal(sum(detail.td), detail.td.left);
  for (const one of [detail.main, detail.td].flatMap((queue) => [...queue.taken, ...queue.added])) {
    assert.ok(one.sessions >= 0, JSON.stringify(one));
  }
  return detail;
}

/** The fixtures' events with more math lessons on Sunday or Monday afternoons, as `[id, weekday, slot, group]`. */
function withLessons(more: readonly (readonly [string, 0 | 1, number, string])[]): RecordEvent[] {
  return cemEvents().map((event) => {
    if (event.kind !== 'timetable.set') return event;
    const entries = more.map(([id, weekday, index, groupId]) => ({
      id,
      weekday,
      slot: { half: 'afternoon' as const, index },
      courseId: 'c-math',
      groupId,
      weeks: 'every' as const,
      sessionType: 'lesson',
    }));
    return { ...event, version: { ...event.version, entries: [...event.version.entries, ...entries] } };
  });
}

const makeUp: AddedDay = {
  id: 'add-1',
  schoolId: 's-cem',
  day: d('2026-11-21'),
  adds: 'make-up',
  follows: 3,
  takes: ['c-math/m3/g-all/every'],
  name: { en: 'Make-up day' },
  source: "Director's notice",
  confidence: 'announced',
  replaces: 'storm',
};

describe('The September check line by line', () => {
  it('gives the timetable, then what each calendar entry takes by its first day', async () => {
    const detail = checked(contextOf(await openBook(cemEvents())), 'c-math', d('2026-09-20'));
    assert.deepEqual(
      { from: detail.from, weekly: detail.weekly, scheduled: detail.scheduled },
      { from: '2026-09-20', weekly: { all: 5, main: 4 }, scheduled: 50 },
    );
    assert.deepEqual(detail.main, {
      scheduled: 40,
      taken: [
        { kind: 'calendar', id: 'autumn', mark: 'holiday', day: '2026-10-29', sessions: 1 },
        { kind: 'calendar', id: 'storm', mark: 'closure', day: '2026-11-18', sessions: 1 },
      ],
      added: [],
      left: 38,
    });
    assert.deepEqual(detail.td, { scheduled: 10, taken: [], added: [], left: 10 });
  });

  it('counts a test by the queue its session had, and a make-up day as given', async () => {
    const book = await openBook(cemEvents());
    const day = d('2026-11-15');
    await book.record(day, {
      kind: 'test.set',
      test: {
        id: 't-1',
        courseId: 'c-math',
        day: d('2026-11-25'),
        slot: { half: 'morning', index: 3 },
        groupId: 'g-all',
        title: 'Made-up test',
      },
    });
    await book.record(day, addSessionsDay(contextOf(book), makeUp));
    const detail = checked(contextOf(book), 'c-math', day);
    assert.deepEqual(detail.main, {
      scheduled: 12,
      taken: [
        { kind: 'calendar', id: 'storm', mark: 'closure', day: '2026-11-18', sessions: 1 },
        { kind: 'test', id: 't-1', day: '2026-11-25', sessions: 1 },
      ],
      added: [{ kind: 'added', id: 'add-1', day: '2026-11-21', sessions: 1 }],
      left: 11,
    });
  });

  it('lists a test on a make-up day among what is taken', async () => {
    const book = await openBook(cemEvents());
    const day = d('2026-11-15');
    await book.record(day, addSessionsDay(contextOf(book), makeUp));
    await book.record(day, {
      kind: 'test.set',
      test: {
        id: 't-2',
        courseId: 'c-math',
        day: makeUp.day,
        slot: { half: 'morning', index: 3 },
        groupId: 'g-all',
        title: 'Made-up test',
      },
    });
    const detail = checked(contextOf(book), 'c-math', day);
    assert.deepEqual(detail.main.added, [{ kind: 'added', id: 'add-1', day: '2026-11-21', sessions: 1 }]);
    assert.deepEqual(
      detail.main.taken.find((one) => one.kind === 'test'),
      { kind: 'test', id: 't-2', day: '2026-11-21', sessions: 1 },
    );
  });

  it("leaves the other half-group's sessions out of a rotation", async () => {
    const book = await openBook(
      withLessons([
        ['x1', 0, 2, 'g-all'],
        ['x2', 0, 3, 'g-all'],
        ['x3', 0, 4, 'g-2'],
        ['x4', 1, 2, 'g-all'],
        ['x5', 1, 3, 'g-all'],
      ]),
    );
    await book.record(d('2026-09-19'), setCalendarEntry(contextOf(book), rotation));
    const detail = checked(contextOf(book), 'c-math', rotation.from);
    assert.equal(detail.main.taken.filter((one) => one.mark === 'rotation').length, 0);
  });

  it('gives a make-up Saturday in a rotation the turn of the weekday it follows (answer 300)', async () => {
    const book = await openBook(
      withLessons([
        ['x1', 0, 2, 'g-all'],
        ['x2', 0, 3, 'g-all'],
      ]),
    );
    const day = d('2026-11-15');
    await book.record(
      d('2026-09-19'),
      setCalendarEntry(contextOf(book), { ...rotation, from: day, to: d('2026-11-28') }),
    );
    const before = checked(contextOf(book), 'c-math', day).check.gives;
    const monday = book.state.timetables
      .at(-1)!
      .version.entries.filter((entry) => entry.weekday === 1 && entry.courseId === 'c-math');
    const saturday: AddedDay = { ...makeUp, id: 'add-s', follows: 1, takes: monday.map(takeKey) };
    await book.record(day, addSessionsDay(contextOf(book), saturday));
    const context = contextOf(book);
    const turn = rotationOn(context, book.state.classes.get('k-1am2')!, saturday.day, d('2026-11-16'))!.groupId;
    const added = sessionsBetween(context, saturday.day, saturday.day).filter((one) => one.added === 'add-s');
    assert.ok(added.length > 0);
    assert.ok(added.every((one) => one.groupId === turn));
    assert.ok(checked(context, 'c-math', day).check.gives >= before);
  });

  it('leaves out recorded sessions, and adds up with rotating half-groups', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-10-01'));
    await book.recordAll(
      d('2026-10-01'),
      confirmSessions(
        context,
        sessions.map((session) => ({ session })),
      ),
    );
    assert.equal(checked(contextOf(book), 'c-math', d('2026-09-20')).main.scheduled, 32);
    checked(contextOf(await rotatingBook()), 'c-math', rotation.from);
  });

  it('gives none without a check, and nothing from the exams on', async () => {
    const packless = cemEvents().map((event) =>
      event.kind === 'course.set' ? { ...event, course: { ...event.course, pack: null } } : event,
    );
    assert.equal(termCheckDetail(contextOf(await openBook(packless)), 'c-math', d('2026-09-20')), null);
    const context = contextOf(await openBook(cemEvents()));
    const late = checked(context, 'c-math', d('2026-12-06'));
    assert.deepEqual([late.scheduled, late.main.left, late.td.left], [0, 0, 0]);
  });
});
