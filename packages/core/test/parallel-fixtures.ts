// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';

import { awaitingBetween, confirmSessions, type RecordBook, type RecordEvent } from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack } from './fixtures.ts';

/** The fixtures' events with a second made-up class, 1AM3, on the same pack, taught on other weekdays. */
export function twoClasses(): RecordEvent[] {
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

/** Confirms a course's sessions from the start of the year to `to`, as planned. */
export async function teach(book: RecordBook, courseId: string, to: string): Promise<void> {
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
