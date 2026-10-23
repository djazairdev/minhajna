// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The made-up Thursday of today-day.ts with three made-up pupils in 4م1 and
// a test of theirs, for the mark entry's tests.

import { parseDay, type RecordEvent } from '@minhajna/core';
import type { TestData } from './app-data';
import { withDay } from './today-day';

/** A made-up pupil of 4م1, joining on `joined` when given. */
export const pupil = (id: string, name: string, joined?: string): RecordEvent => ({
  kind: 'pupil.set',
  pupil: {
    id,
    classId: 'k-1',
    name,
    sex: 'f',
    groups: [],
    movements: joined === undefined ? [] : [{ day: parseDay(joined), kind: 'in', reason: 'transfer' }],
  },
});

/** That Thursday with three pupils in 4م1 and «الفرض الأول» on Sunday 8 November. */
export async function withTest(): Promise<TestData> {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    pupil('p-1', 'تلميذة أولى'),
    pupil('p-2', 'تلميذة ثانية'),
    pupil('p-3', 'تلميذة ثالثة'),
    {
      kind: 'test.set',
      test: {
        id: 't-1',
        courseId: 'c-1',
        day: parseDay('2026-11-08'),
        slot: { half: 'morning', index: 1 },
        groupId: 'k-1-w',
        title: 'الفرض الأول',
      },
    },
  ]);
  return data;
}
