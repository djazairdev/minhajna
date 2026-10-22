// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up hybrid lycée example pack and class for the weekly targets
// (#231, Plan-lycee, answer 387): 1ج م ع ت 2's mathematics on Sunday,
// Tuesday and Thursday at 08:00 from 20 September 2026, on the example
// mathematics items made hybrid, the first unit due by teaching week 3 and
// the second by week 6.

import { parseDay, type PlanPack, type RecordEvent, type TimetableEntry } from '@minhajna/core';
import { openTestData, type TestData } from './app-data';

export const hybridId = 'dz.lycee.1as.math.example';

const targets = new Map([
  ['u1-i', 3],
  ['u2-i', 6],
]);

const entry = (id: string, weekday: 0 | 2 | 4): TimetableEntry => ({
  id,
  weekday,
  slot: { half: 'morning', index: 1 },
  courseId: 'c-l',
  groupId: 'k-l-w',
  weeks: 'every',
  sessionType: 'lesson',
});

/** The lycée class on the hybrid pack, with nothing recorded. */
export async function withHybrid(): Promise<TestData> {
  const data = await openTestData();
  const example = data.packs.find((one) => one.id === 'dz.cem.1am.math.example');
  if (example === undefined) throw new Error('No example pack');
  const hybrid: PlanPack = {
    ...example,
    id: hybridId,
    anchor: { kind: 'hybrid', unit: 'sessions' },
    provenance: { issuer: 'Made-up hybrid lycée example; not a plan', edition: 'example' },
    items: example.items.map((item) => (targets.has(item.id) ? { ...item, week: targets.get(item.id)! } : item)),
  };
  const events: RecordEvent[] = [
    {
      kind: 'school.set',
      school: { id: 's-l', name: 'ثانوية النور', levels: ['lycee'], subjects: ['math'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-l',
        schoolId: 's-l',
        level: 'lycee',
        grade: '1as',
        name: '1ج م ع ت 2',
        groups: [{ id: 'k-l-w', kind: 'whole', name: '1ج م ع ت 2' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'c-l',
        classId: 'k-l',
        subject: 'math',
        year: '2026-2027',
        pack: { id: hybridId, release: '2026.1' },
      },
    },
    {
      kind: 'timetable.set',
      version: {
        id: 'v-l',
        from: parseDay('2026-09-20'),
        source: 'hand',
        entries: [entry('e-sun', 0), entry('e-tue', 2), entry('e-thu', 4)],
        blocks: [],
      },
    },
  ];
  await data.book.recordAll(parseDay('2026-09-20'), events);
  return { ...data, packs: [...data.packs, hybrid] };
}
