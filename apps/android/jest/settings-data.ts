// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import type { TestData } from './app-data';
import { withDay } from './today-day';

/** A second made-up school with the same grade and subject, deliberately pinned to an absent release. */
export async function settingsData(): Promise<TestData> {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-2', name: 'متوسطة الأمل (مثال)', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    {
      kind: 'class.set',
      schoolClass: {
        id: 'k-other',
        schoolId: 's-2',
        level: 'cem',
        grade: '4am',
        name: '4م3 (مثال)',
        groups: [{ id: 'k-other-w', kind: 'whole', name: 'القسم (مثال)' }],
      },
    },
    {
      kind: 'course.set',
      course: {
        id: 'c-other',
        classId: 'k-other',
        subject: 'arabic',
        year: '2026-2027',
        pack: { id: 'dz.cem.4am.arabic.example', release: '2025.9' },
      },
    },
  ]);
  return data;
}
