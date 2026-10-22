// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up class with directed-work sessions for Today's TD list (#231,
// answer 389), on the example mathematics pack.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { openTestData, type TestData } from './app-data';

const entry = (id: string, weekday: 0 | 4, index: number, sessionType: string): TimetableEntry => ({
  id,
  weekday,
  slot: { half: 'morning', index },
  courseId: 'c-m',
  groupId: 'k-m-w',
  weeks: 'every',
  sessionType,
});

/**
 * 1م1's mathematics: TD at 08:00 and a lesson at 09:00 on Thursday 15 October, or the other way round with
 * `lessonFirst`, and TD on Sunday at 08:00; `test` puts a test on Thursday at 09:00.
 */
export async function withTd(test = false, lessonFirst = false): Promise<TestData> {
  const data = await openTestData();
  const day = parseDay('2026-10-15');
  const events: RecordEvent[] = [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['math'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-m',
        schoolId: 's-1',
        level: 'cem',
        grade: '1am',
        name: '1م1',
        groups: [{ id: 'k-m-w', kind: 'whole', name: '1م1' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'c-m',
        classId: 'k-m',
        subject: 'math',
        year: '2026-2027',
        pack: { id: 'dz.cem.1am.math.example', release: '2026.1' },
      },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: day,
        source: 'hand',
        entries: [
          entry('e-td', 4, lessonFirst ? 2 : 1, 'td'),
          entry('e-ls', 4, lessonFirst ? 1 : 2, 'lesson'),
          entry('e-sun', 0, 1, 'td'),
        ],
        blocks: [],
      },
    },
  ];
  const slot = { half: 'morning' as const, index: 2 };
  const exam: RecordEvent = {
    kind: 'test.set',
    test: { id: 'x-1', courseId: 'c-m', day, slot, groupId: 'k-m-w', title: 'الفرض الأول' },
  };
  await data.book.recordAll(day, test ? [...events, exam] : events);
  return data;
}
