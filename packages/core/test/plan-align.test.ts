// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes and «محاذاة مع القسم X» (#225, R-4.7-36, answer 286): a
// second made-up class, 1AM3, on the same pack, taught on other weekdays.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  alignChange,
  awaitingBetween,
  confirmSessions,
  parallelCourses,
  planView,
  recordChange,
  type RecordBook,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook } from './fixtures.ts';

function twoClasses(): RecordEvent[] {
  const events = cemEvents();
  const timetable = events.find((event) => event.kind === 'timetable.set');
  assert.ok(timetable?.kind === 'timetable.set');
  const lesson = (id: string, weekday: 0 | 1 | 3 | 4) => ({
    id,
    weekday,
    slot: { half: 'afternoon' as const, index: 2 },
    courseId: 'c-math3',
    groupId: 'h-all',
    weeks: 'every' as const,
    sessionType: 'lesson',
  });
  return [
    ...events.filter((event) => event !== timetable),
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-1am3',
        schoolId: 's-cem',
        level: 'cem',
        grade: '1am',
        name: '1AM3',
        groups: [{ id: 'h-all', kind: 'whole', name: '1AM3' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'c-math3',
        classId: 'k-1am3',
        subject: 'math',
        year: '2026-2027',
        pack: { id: mathPack.id, release: mathPack.release },
      },
    },
    {
      ...timetable,
      version: {
        ...timetable.version,
        entries: [
          ...timetable.version.entries,
          lesson('f-sun', 0),
          lesson('f-mon', 1),
          lesson('f-wed', 3),
          lesson('f-thu', 4),
        ],
      },
    },
  ];
}

async function teach(book: RecordBook, courseId: string, to: string): Promise<void> {
  const context = contextOf(book);
  const sessions = awaitingBetween(context, d('2026-09-20'), d(to)).filter((one) => one.courseId === courseId);
  await book.recordAll(
    d(to),
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
}

describe('Parallel classes', () => {
  it('pairs classes of the same subject, grade, school, year and pack', async () => {
    const context = contextOf(await openBook(twoClasses()));
    assert.deepEqual(
      parallelCourses(context, 'c-math').map((course) => course.id),
      ['c-math3'],
    );
    assert.deepEqual(
      parallelCourses(context, 'c-math3').map((course) => course.id),
      ['c-math'],
    );
  });

  it('aligns a class behind another on its next item, the items passed following it', async () => {
    const book = await openBook(twoClasses());
    await teach(book, 'c-math', '2026-09-24');
    const day = d('2026-09-25');
    const ahead = planView(contextOf(book), 'c-math', day)!.main.find((row) => row.position)!.item.id;
    const behind = planView(contextOf(book), 'c-math3', day)!.main.find((row) => row.position)!.item.id;
    assert.notEqual(ahead, behind);
    assert.equal(alignChange(contextOf(book), 'c-math', 'c-math3', day, 'x'), null);
    const change = alignChange(contextOf(book), 'c-math3', 'c-math', day, 'a1');
    assert.deepEqual(change, {
      id: 'a1',
      courseId: 'c-math3',
      day,
      seq: 1,
      kind: 'move',
      item: ahead,
      before: behind,
      align: 'k-1am2',
    });
    await book.record(day, recordChange(contextOf(book), change));
    const main = planView(contextOf(book), 'c-math3', day)!.main;
    assert.equal(main.find((row) => row.position)?.item.id, ahead);
    assert.equal(main[main.findIndex((row) => row.item.id === ahead) + 1]?.item.id, behind);
    assert.equal(main.length, planView(contextOf(book), 'c-math', day)!.main.length);
  });
});
