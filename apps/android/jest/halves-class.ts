// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The made-up Thursday of today-day.ts with 4م1 in two halves, for the
// half-group pair on Today (#231, answer 388).

import { parseDay, type TimetableEntry } from '@minhajna/core';
import type { TestData } from './app-data';
import { withDay } from './today-day';

/**
 * 4م1 in two halves from `from`: the whole class at 08:00 on Thursday, the first half at 09:00 every week, the
 * second on Sunday at 08:00 in `weeks`.
 */
export async function withHalves(from = '2026-10-15', weeks: 'every' | 'A' = 'A'): Promise<TestData> {
  const data = await withDay();
  const [timetable] = data.book.state.timetables;
  const half = (id: string, weekday: 0 | 4, index: number, groupId: string, weeks: 'every' | 'A'): TimetableEntry => ({
    id,
    weekday,
    slot: { half: 'morning', index },
    courseId: 'c-1',
    groupId,
    weeks,
    sessionType: 'lesson',
  });
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        ...data.book.state.classes.get('k-1')!,
        groups: [
          { id: 'k-1-w', kind: 'whole', name: '4م1' },
          { id: 'k-1-a', kind: 'half', name: 'الفوج 1' },
          { id: 'k-1-b', kind: 'half', name: 'الفوج 2' },
        ],
      },
    },
    {
      kind: 'timetable.set',
      version: {
        ...timetable.version,
        from: parseDay(from),
        entries: [
          ...timetable.version.entries.filter((entry) => entry.id !== 'e-2'),
          half('e-2a', 4, 2, 'k-1-a', 'every'),
          half('e-2b', 0, 1, 'k-1-b', weeks),
        ],
      },
    },
  ]);
  return data;
}
