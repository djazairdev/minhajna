// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up primary French specialist for the specialists' journal's tests:
// 3 ابتدائي أ and 3 ابتدائي ب at مدرسة الفتح in the morning, and 5 ابتدائي أ
// at مدرسة الرياض in the afternoon, on Thursday 15 October 2026, with each
// school's bells.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { openTestData, type TestData } from './app-data';

const time = (half: 'morning' | 'afternoon', index: number, from: string, to: string) => ({ half, index, from, to });

/** A primary class at a school, with its whole group. */
export function primaryClass(id: string, schoolId: string, grade: string, name: string): RecordEvent {
  return {
    kind: 'class.set',
    schoolClass: { id, schoolId, level: 'primary', grade, name, groups: [{ id: `${id}-w`, kind: 'whole', name }] },
  };
}

/** A course of `subject` in a class this school year, with no plan. */
export function course(id: string, classId: string, subject: string): RecordEvent {
  return { kind: 'course.set', course: { id, classId, subject, year: '2026-2027', pack: null } };
}

/** A Thursday session of a course with its class's whole group. */
export function thursday(id: string, half: 'morning' | 'afternoon', index: number, courseId: string, classId: string) {
  return {
    id,
    weekday: 4,
    slot: { half, index },
    courseId,
    groupId: `${classId}-w`,
    weeks: 'every',
    sessionType: 'lesson',
  } satisfies TimetableEntry;
}

/** The French specialist's two schools, three classes and Thursday, with `more` recorded after. */
export async function withSpecialist(more: readonly RecordEvent[] = [], entries: readonly TimetableEntry[] = []) {
  const data: TestData = await openTestData();
  const school = (id: string, name: string, bells: ReturnType<typeof time>[]) =>
    ({
      kind: 'school.set',
      school: { id, name, levels: ['primary'], subjects: ['french'], zone: '16', bells: { usual: bells } },
    }) as const;
  await data.book.recordAll(parseDay('2026-10-15'), [
    school('s-1', 'مدرسة الفتح', [time('morning', 1, '08:00', '08:45'), time('morning', 2, '09:00', '09:45')]),
    school('s-2', 'مدرسة الرياض', [time('afternoon', 1, '13:00', '13:45')]),
    primaryClass('k-1', 's-1', '3ap', '3 ابتدائي أ'),
    primaryClass('k-2', 's-1', '3ap', '3 ابتدائي ب'),
    primaryClass('k-3', 's-2', '5ap', '5 ابتدائي أ'),
    course('f-1', 'k-1', 'french'),
    course('f-2', 'k-2', 'french'),
    course('f-3', 'k-3', 'french'),
    ...more,
    {
      kind: 'timetable.set',
      version: {
        id: 'v-1',
        from: parseDay('2026-10-11'),
        source: 'hand',
        entries: [
          thursday('e-1', 'morning', 1, 'f-1', 'k-1'),
          thursday('e-2', 'morning', 2, 'f-2', 'k-2'),
          thursday('e-3', 'afternoon', 1, 'f-3', 'k-3'),
          ...entries,
        ],
        blocks: [],
      },
    },
  ]);
  return data;
}
