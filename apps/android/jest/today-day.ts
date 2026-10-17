// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up school day for Today's tests: Thursday 15 October 2026, 4م1 at
// 08:00 and 09:00 with the example pack, then 4م2 with no pack at 10:00.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { openTestData, type TestData } from './app-data';

const example = { id: 'dz.cem.4am.arabic.example', release: '2026.1' };

const schoolClass = (id: string, name: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: {
    id,
    schoolId: 's-1',
    level: 'cem',
    grade: '4am',
    name,
    groups: [{ id: `${id}-w`, kind: 'whole', name }],
  },
});

const entry = (id: string, weekday: 0 | 4, index: number, courseId: string) =>
  ({
    id,
    weekday,
    slot: { half: 'morning', index },
    courseId,
    groupId: courseId === 'c-1' ? 'k-1-w' : 'k-2-w',
    weeks: 'every',
    sessionType: 'lesson',
  }) satisfies TimetableEntry;

export async function withDay(): Promise<TestData> {
  const data = await openTestData();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    schoolClass('k-1', '4م1'),
    schoolClass('k-2', '4م2'),
    { kind: 'course.set', course: { id: 'c-1', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: example } },
    { kind: 'course.set', course: { id: 'c-2', classId: 'k-2', subject: 'arabic', year: '2026-2027', pack: null } },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [entry('e-1', 4, 1, 'c-1'), entry('e-2', 4, 2, 'c-1'), entry('e-3', 4, 3, 'c-2')],
        blocks: [],
      },
    },
  ]);
  return data;
}

/** A session's key on that Thursday. */
export const key = (slot: number, course = 'c-1', group = 'k-1-w') => `${course}/2026-10-15/m${slot}/${group}`;
