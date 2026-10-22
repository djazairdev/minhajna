// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Two made-up 2AS classes for the reorientation (#231, Reorient, answer
// 391): 2 ع ت 1 with six made-up pupils and 2 ع ت 2 with five, both taught
// mathematics on the example pack, 2 ع ت 1 in Sunday's and Tuesday's first
// morning slot and 2 ع ت 2 in Tuesday's second, from 20 September 2026,
// with nothing recorded.

import { parseDay, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { madeUpClass, rollCallTexts } from '../src/gallery/roll-call-texts';
import { openTestData, type TestData } from './app-data';

const entry = (id: string, course: string, group: string, weekday: 0 | 2, index: number): TimetableEntry => ({
  id,
  weekday,
  slot: { half: 'morning', index },
  courseId: course,
  groupId: group,
  weeks: 'every',
  sessionType: 'lesson',
});

const names = madeUpClass(rollCallTexts.ar);

function lycee(id: string, name: string, pupils: number, first: number): RecordEvent[] {
  return [
    {
      kind: 'class.set',
      schoolClass: {
        id,
        schoolId: 's-l',
        level: 'lycee',
        grade: '2as',
        name,
        groups: [{ id: `${id}-w`, kind: 'whole', name }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: `c-${id}`,
        classId: id,
        subject: 'math',
        year: '2026-2027',
        pack: { id: 'dz.cem.1am.math.example', release: '2026.1' },
      },
    },
    ...Array.from({ length: pupils }, (_, index): RecordEvent => ({
      kind: 'pupil.set',
      pupil: {
        id: `p-${id}-${index + 1}`,
        classId: id,
        name: names[first + index],
        sex: index % 2 === 0 ? 'm' : 'f',
        groups: [],
        movements: [],
      },
    })),
  ];
}

/** The two 2AS classes, k-a and k-b, with their courses c-k-a and c-k-b. */
export async function withReshape(): Promise<TestData> {
  const data = await openTestData();
  const events: RecordEvent[] = [
    {
      kind: 'school.set',
      school: { id: 's-l', name: 'ثانوية النور', levels: ['lycee'], subjects: ['math'], zone: '16' },
    },
    ...lycee('k-a', '2 ع ت 1', 6, 0),
    ...lycee('k-b', '2 ع ت 2', 5, 6),
    {
      kind: 'timetable.set',
      version: {
        id: 'v-l',
        from: parseDay('2026-09-20'),
        source: 'hand',
        entries: [
          entry('e-a0', 'c-k-a', 'k-a-w', 0, 1),
          entry('e-a2', 'c-k-a', 'k-a-w', 2, 1),
          entry('e-b2', 'c-k-b', 'k-b-w', 2, 2),
        ],
        blocks: [],
      },
    },
  ];
  await data.book.recordAll(parseDay('2026-09-20'), events);
  return data;
}
