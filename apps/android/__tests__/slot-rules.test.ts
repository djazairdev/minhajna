// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot of the week (#28, Week-slot): what it holds, a session in A weeks
// and the teacher's own time in B weeks. Made-up classes only.

import { parseDay, type Course, type TimetableVersion } from '@minhajna/core';
import { itemsAt } from '../src/week/slot-rules';
import type { Cell } from '../src/week/week-rules';

const day = parseDay('2026-10-15');
const tue2: Cell = { weekday: 2, slot: { half: 'morning', index: 2 } };
const courses: Record<string, Course> = {
  'c-ar': { id: 'c-ar', classId: 'k-1', subject: 'arabic', year: '2026-2027', pack: null },
  'c-is': { id: 'c-is', classId: 'k-1', subject: 'islamic', year: '2026-2027', pack: null },
};
const lookup = { course: (id: string) => courses[id] };
const base: TimetableVersion = {
  id: 'v-1',
  from: day,
  entries: [
    {
      id: 'e-1',
      weekday: 2,
      slot: { half: 'morning', index: 2 },
      courseId: 'c-ar',
      groupId: 'g-1',
      weeks: 'A',
      sessionType: 'td',
      room: '12',
    },
    {
      id: 'e-2',
      weekday: 2,
      slot: { half: 'morning', index: 1 },
      courseId: 'c-ar',
      groupId: 'w',
      weeks: 'every',
      sessionType: 'lesson',
    },
  ],
  blocks: [{ weekday: 2, half: 'morning', index: 2, weeks: 'B', kind: 'duty', label: 'Duty' }],
  source: 'hand',
};

test('reads what a slot holds: a session with its subject, group, weeks and room, and own time with its kind', () => {
  expect(itemsAt(base, lookup, tue2)).toEqual([
    { kind: 'class', classId: 'k-1', subject: 'arabic', groupId: 'g-1', weeks: 'A', sessionType: 'td', room: '12' },
    { kind: 'own', ownKind: 'duty', halfDay: false, weeks: 'B', label: 'Duty' },
  ]);
});
