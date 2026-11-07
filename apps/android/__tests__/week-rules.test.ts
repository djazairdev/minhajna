// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading the week (#28): each class's sessions a week. Made-up classes
// only.

import { parseDay, type SchoolClass, type TimetableVersion, type Weekday } from '@minhajna/core';
import { classLoads } from '../src/week/week-rules';

const day = parseDay('2026-10-15');
const classes: SchoolClass[] = ['4م1', '4م2'].map((name, at) => ({
  id: `k-${at + 1}`,
  schoolId: 's-1',
  level: 'cem',
  grade: '4am',
  name,
  groups: [{ id: `g-${at + 1}`, kind: 'whole', name }],
}));
const empty: TimetableVersion = { id: 'v-1', from: day, entries: [], blocks: [], source: 'hand' };
const classOf = (courseId: string) => (courseId === 'c-1' ? classes[0] : courseId === 'c-2' ? classes[1] : undefined);

test('counts each class a week in the order of the classes', () => {
  const entry = (courseId: string, weekday: Weekday, half: 'morning' | 'afternoon', index: number) => ({
    id: `e-${weekday}-${half}`,
    weekday,
    slot: { half, index },
    courseId,
    groupId: courseId === 'c-1' ? 'g-1' : 'g-2',
    weeks: 'every' as const,
    sessionType: 'lesson',
  });
  const version: TimetableVersion = {
    ...empty,
    entries: [
      entry('c-2', 0, 'morning', 1),
      entry('c-2', 1, 'morning', 1),
      entry('c-2', 2, 'morning', 1),
      entry('c-1', 6, 'afternoon', 2),
    ],
  };
  expect(classLoads(version, classOf, classes)).toEqual({
    loads: [
      { name: '4م1', count: 1 },
      { name: '4م2', count: 3 },
    ],
    total: 4,
  });
});
