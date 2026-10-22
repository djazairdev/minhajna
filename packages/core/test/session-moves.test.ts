// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A clash between two schools kept or moved for one day (#232, answer 400):
// a kept clash is no longer open until a new version is drawn; a move takes
// one session to another free slot of its day only, every level of a joint
// class and a rotating group's turn with it, refusing a day gone by, a slot
// taken, a session moved or recorded, and is taken back only while the moved
// session is not recorded. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  confirmSessions,
  keepClash,
  moveRefusal,
  moveSession,
  reopenClash,
  sessionsBetween,
  slotKey,
  unmoveSession,
  weekClashes,
  type RecordBook,
  type RecordEvent,
  type Slot,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';
import { rotatingBook } from './rotation-fixtures.ts';

const today = d('2026-10-04');
const sunday = d('2026-10-11');
const m1: Slot = { half: 'morning', index: 1 };
const m2: Slot = { half: 'morning', index: 2 };

/** The example class on Sunday's first slot, and a class at a second school on the same slot. */
async function clashing(): Promise<RecordBook> {
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
    { kind: 'course.set', course: { id: 'c-two', classId: 'k-two', subject: 'math', year: '2026-2027', pack: null } },
  ];
  const events = cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: [
              ...event.version.entries,
              {
                id: 'e-two',
                weekday: 0,
                slot: m1,
                courseId: 'c-two',
                groupId: 'g-two',
                weeks: 'every',
                sessionType: 'lesson',
              } as const,
            ],
          },
        }
      : event,
  );
  const at = events.findIndex((event) => event.kind === 'timetable.set');
  return openBook([...events.slice(0, at), ...second, ...events.slice(at)]);
}

const on = (book: RecordBook, day = sunday) =>
  sessionsBetween(contextOf(book), day, day).map((one) => `${one.courseId} ${slotKey(one.slot)}`);
const move = { courseId: 'c-two', groupId: 'g-two', day: sunday, from: m1, to: m2 };

describe('a clash between two schools', () => {
  it('is kept until it is opened again or a new version is drawn', async () => {
    const book = await clashing();
    const version = book.state.timetables[0]!.version;
    const kept = () => weekClashes(version, book.state).map((one) => [one.weekday, slotKey(one.slot), one.kept]);
    assert.deepEqual(kept(), [[0, 'm1', false]]);
    assert.throws(() => keepClash(book.state, version, { weekday: 1, slot: m2 }, 'k-1'), /No clash/);
    await book.record(today, keepClash(book.state, version, { weekday: 0, slot: m1 }, 'k-1'));
    assert.deepEqual(kept(), [[0, 'm1', true]]);
    assert.throws(() => keepClash(book.state, version, { weekday: 0, slot: m1 }, 'k-2'), /is kept/);
    const redrawn = { ...version, id: 'v2' };
    assert.deepEqual(
      weekClashes(redrawn, book.state).map((one) => one.kept),
      [false],
    );
    await book.record(today, reopenClash(book.state, 'k-1'));
    assert.deepEqual(kept(), [[0, 'm1', false]]);
  });

  it('moves one session to a free slot of that day only', async () => {
    const book = await clashing();
    const context = contextOf(book);
    assert.equal(moveRefusal(context, { ...move, day: d('2026-10-04') }, d('2026-10-05')), 'past');
    assert.equal(moveRefusal(context, { ...move, to: m1 }, today), 'same');
    assert.equal(moveRefusal(context, { ...move, day: d('2026-10-12') }, today), 'no-session');
    await book.record(today, moveSession(context, { id: 'mv-1', ...move }, today));
    assert.deepEqual(on(book), ['c-math m1', 'c-two m2']);
    assert.equal(sessionsBetween(contextOf(book), sunday, sunday)[1]?.movedFrom?.index, 1);
    assert.deepEqual(on(book, d('2026-10-18')), ['c-math m1', 'c-two m1']);
    assert.equal(moveRefusal(contextOf(book), move, today), 'moved');
    const mathToM2 = { courseId: 'c-math', groupId: 'g-all', day: sunday, from: m1, to: m2 };
    assert.equal(moveRefusal(contextOf(book), mathToM2, today), 'busy');
  });

  it('is moved back only while the moved session is not recorded', async () => {
    const book = await clashing();
    await book.record(today, moveSession(contextOf(book), { id: 'mv-1', ...move }, today));
    assert.deepEqual(unmoveSession(book.state, 'mv-1'), { kind: 'move.removed', id: 'mv-1' });
    const moved = sessionsBetween(contextOf(book), sunday, sunday).find((one) => one.courseId === 'c-two');
    assert.ok(moved);
    await book.recordAll(sunday, confirmSessions(contextOf(book), [{ session: moved, choice: { outcome: 'done' } }]));
    assert.throws(() => unmoveSession(book.state, 'mv-1'), /is recorded/);
    const math = sessionsBetween(contextOf(book), sunday, sunday).find((one) => one.courseId === 'c-math');
    assert.ok(math);
    await book.recordAll(sunday, confirmSessions(contextOf(book), [{ session: math, choice: { outcome: 'done' } }]));
    const back = {
      courseId: 'c-math',
      groupId: 'g-all',
      day: sunday,
      from: m1,
      to: { half: 'morning', index: 3 },
    } as const;
    assert.equal(moveRefusal(contextOf(book), back, today), 'recorded');
  });

  it('moves every level of a joint class, and a rotating group’s turn', async () => {
    const joint = primaryEvents().flatMap((event): RecordEvent[] => {
      if (event.kind === 'class.set') {
        const groups = [
          ...event.schoolClass.groups,
          { id: 'g-4', kind: 'level', name: '4AP', grade: '4ap' } as const,
          { id: 'g-5', kind: 'level', name: '5AP', grade: '5ap' } as const,
        ];
        return [{ kind: 'class.set', schoolClass: { ...event.schoolClass, grade: '4ap', groups } }];
      }
      if (event.kind !== 'course.set') return [event];
      const fourth = { id: 'c-lang-4', classId: 'k-5apb', subject: 'language', year: '2026-2027', pack: null };
      return [
        { kind: 'course.set', course: { ...event.course, grade: '5ap' } },
        { kind: 'course.set', course: { ...fourth, grade: '4ap' } },
      ];
    });
    const book = await openBook(joint);
    const afternoon: Slot = { half: 'afternoon', index: 3 };
    const both = { courseId: 'c-lang-4', groupId: 'h-all', day: sunday, from: m1, to: afternoon };
    await book.record(today, moveSession(contextOf(book), { id: 'mv-j', ...both }, today));
    const at = (slot: Slot) =>
      sessionsBetween(contextOf(book), sunday, sunday)
        .filter((one) => slotKey(one.slot) === slotKey(slot))
        .map((one) => one.courseId)
        .sort();
    assert.deepEqual(at(afternoon), ['c-lang', 'c-lang-4']);
    assert.deepEqual(at(m1), []);
    assert.equal(moveRefusal(contextOf(book), { ...both, courseId: 'c-lang' }, today), 'moved');

    const rotating = await rotatingBook();
    const day = d('2026-09-27');
    const turn = { courseId: 'c-math', groupId: 'g-all', day, from: m1, to: m2 };
    assert.equal(moveRefusal(contextOf(rotating), { ...turn, groupId: 'g-1' }, d('2026-09-26')), 'no-session');
    assert.equal(moveRefusal(contextOf(rotating), turn, d('2026-09-26')), null);
    await rotating.record(day, moveSession(contextOf(rotating), { id: 'mv-r', ...turn }, d('2026-09-26')));
    const [moved] = sessionsBetween(contextOf(rotating), day, day);
    assert.equal(slotKey(moved!.slot), 'm2');
    assert.notEqual(moved!.rotation, undefined);
  });
});
