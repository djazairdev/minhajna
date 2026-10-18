// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up primary class for the primary journal's tests: 5 ابتدائي أ at
// مدرسة الياسمين, with Arabic and mathematics on Thursday 15 October 2026.

import { parseDay, type TimetableEntry } from '@minhajna/core';
import { openTestData, type TestData } from './app-data';

export const slot = (id: string, half: 'morning' | 'afternoon', index: number, courseId: string, activity?: string) =>
  ({
    id,
    weekday: 4,
    slot: { half, index },
    courseId,
    groupId: 'p-1-w',
    weeks: 'every',
    sessionType: 'lesson',
    ...(activity !== undefined && { activity }),
  }) satisfies TimetableEntry;

/** 5 ابتدائي أ on the made-up Thursday 15 October 2026: Arabic reading and Arabic, then mathematics after noon. */
export async function withPrimary(): Promise<TestData> {
  const data = await openTestData();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'مدرسة الياسمين', levels: ['primary'], subjects: ['arabic', 'math'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'p-1',
        schoolId: 's-1',
        level: 'primary',
        grade: '5ap',
        name: '5 ابتدائي أ',
        groups: [{ id: 'p-1-w', kind: 'whole', name: '5 ابتدائي أ' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'a-1',
        classId: 'p-1',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.primary.5ap.arabic.example', release: '2026.1' },
      },
    },
    { kind: 'course.set', course: { id: 'm-1', classId: 'p-1', subject: 'math', year: '2026-2027', pack: null } },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [
          slot('e-1', 'morning', 1, 'a-1', 'reading'),
          slot('e-2', 'morning', 2, 'a-1'),
          slot('e-3', 'afternoon', 1, 'm-1'),
        ],
        blocks: [],
      },
    },
  ]);
  return data;
}
