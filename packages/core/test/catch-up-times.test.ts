// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Catch-up sessions and time (#228, answers 354, 355 and 358): slots of two
// schools meet by their bell times, not their numbers; a catch-up session a
// later timetable hides stays cancellable and makes up nothing; and a
// cancelled one comes back only while its time is free. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addCatchUp,
  cancelCatchUp,
  clashOf,
  confirmSessions,
  freeSlots,
  makeUpsDue,
  openCatchUps,
  restoreCatchUp,
  sessionsBetween,
  slotKey,
  type CatchUpSession,
  type Meets,
  type RecordBook,
  type RecordEvent,
  type Slot,
  type TimetableEntry,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const today = d('2026-10-04');
const tuesday = d('2026-10-06');
const m1: Slot = { half: 'morning', index: 1 };
const m2: Slot = { half: 'morning', index: 2 };

const lesson = (id: string, courseId: string, groupId: string, weekday: 2, slot: Slot): TimetableEntry => ({
  id,
  weekday,
  slot,
  courseId,
  groupId,
  weeks: 'every',
  sessionType: 'lesson',
});

/** The example school's first two slots at 08:00 and 09:00; the second school's first at 09:30. */
const byBells: Meets = (_day, a, b) => {
  const starts: Record<string, number> = { 's-cem/m1': 480, 's-cem/m2': 540, 's-two/m1': 570 };
  const start = (one: Parameters<Meets>[1]) => starts[`${one.school.id}/${slotKey(one.slot)}`] ?? 0;
  return Math.abs(start(a) - start(b)) < 60;
};

/** The example class, and a class at a second school taught on Tuesday's first slot. */
async function twoSchools(): Promise<RecordBook> {
  const events = cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: { ...event.version, entries: [...event.version.entries, lesson('e-two', 'c-two', 'g-two', 2, m1)] },
        }
      : event,
  );
  const second: RecordEvent[] = [
    {
      kind: 'school.set',
      school: { id: 's-two', name: 'Second school', levels: ['cem'], subjects: ['math'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-two',
        schoolId: 's-two',
        level: 'cem',
        grade: '1am',
        name: '1AM5',
        groups: [{ id: 'g-two', kind: 'whole', name: '1AM5' }],
      },
    },
    {
      kind: 'course.set',
      course: { id: 'c-two', classId: 'k-two', subject: 'math', year: '2026-2027', pack: null },
    },
  ];
  const at = events.findIndex((event) => event.kind === 'timetable.set');
  return openBook([...events.slice(0, at), ...second, ...events.slice(at)]);
}

describe('catch-up sessions and time', () => {
  it('meet another school’s session by its bell time, not its slot number', async () => {
    const context = contextOf(await twoSchools());
    assert.equal(clashOf(context, 'c-math', tuesday, m2, byBells)?.courseId, 'c-two');
    assert.equal(clashOf(context, 'c-math', tuesday, m1, byBells), null);
    assert.equal(clashOf(context, 'c-math', tuesday, m1)?.courseId, 'c-two');
    const free = freeSlots(context, 'c-math', tuesday, tuesday, () => [m1, m2], byBells);
    assert.deepEqual(
      free.map((one) => slotKey(one.slot)),
      ['m1'],
    );
    assert.throws(
      () => addCatchUp(context, { id: 'u-1', courseId: 'c-math', day: tuesday, slot: m2 }, today, undefined, byBells),
      /a session at this time/,
    );
  });

  it('stay cancellable and make up nothing once a later timetable takes their time', async () => {
    const book = await twoSchools();
    const [sunday] = sessionsBetween(contextOf(book), today, today);
    assert.ok(sunday);
    await book.recordAll(
      today,
      confirmSessions(contextOf(book), [{ session: sunday, choice: { outcome: 'not-held', makeUp: true } }]),
    );
    const [due] = makeUpsDue(contextOf(book), 'c-math');
    assert.ok(due);
    await book.record(
      today,
      addCatchUp(contextOf(book), { id: 'u-1', courseId: 'c-math', day: tuesday, slot: m2 }, today, due.key),
    );
    assert.deepEqual(makeUpsDue(contextOf(book), 'c-math'), []);
    const [version] = book.state.timetables.map((one) => one.version);
    assert.ok(version);
    await book.record(today, {
      kind: 'timetable.set',
      version: {
        ...version,
        id: 'v2',
        from: d('2026-10-05'),
        entries: [...version.entries, lesson('e-tue', 'c-math', 'g-all', 2, m2)],
      },
    });
    const context = contextOf(book);
    assert.equal(
      sessionsBetween(context, tuesday, tuesday).some((one) => one.catchUp === 'u-1'),
      false,
    );
    assert.deepEqual(
      openCatchUps(context, 'c-math').map((one) => [one.catchUp.id, one.placed]),
      [['u-1', false]],
    );
    assert.deepEqual(
      makeUpsDue(context, 'c-math').map((one) => one.key),
      [due.key],
    );
    assert.deepEqual(cancelCatchUp(context, 'u-1'), { kind: 'catchup.removed', id: 'u-1' });
  });

  it('come back after a cancel only while their time is free', async () => {
    const book = await twoSchools();
    const add = (id: string) =>
      addCatchUp(contextOf(book), { id, courseId: 'c-math', day: d('2026-10-07'), slot: m1 }, today);
    await book.record(today, add('u-1'));
    const kept: CatchUpSession | undefined = book.state.catchUps.get('u-1');
    assert.ok(kept);
    await book.record(today, cancelCatchUp(contextOf(book), 'u-1'));
    assert.deepEqual(restoreCatchUp(contextOf(book), kept), { kind: 'catchup.set', catchUp: kept });
    await book.record(today, add('u-2'));
    assert.throws(() => restoreCatchUp(contextOf(book), kept), /a session at this time/);
  });
});
