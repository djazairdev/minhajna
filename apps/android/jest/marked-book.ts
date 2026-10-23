// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The made-up 4م1 of marks-class.ts with every mark of its first term given:
// each pupil's components, «الفرض الأول» and the exam, for the screens that
// show averages, appreciations and the export.

import { setMark, type MarkTarget } from '@minhajna/core';
import type { TestData } from './app-data';
import { DAY } from './components-screen';
import { withTest } from './marks-class';

const POINTS = { participation: 4, quizzes: 3, homework: 3, notebook: 3, attendance: 3, research: 4 } as const;
const mark = (target: MarkTarget, pupilId: string, value: number, max: number) =>
  setMark({ courseId: 'c-1', term: 1, target, pupilId }, value, max);

/** 4م1: the first pupil at 11.67, the second at 9.995, the third at 16.00. */
export async function marked(): Promise<TestData> {
  const data = await withTest();
  const given = {
    'p-1': [3.5, 2, 3, 2.5, 3, 4],
    'p-2': [3, 2, 2, 2, 1.72, 2],
    'p-3': [4, 3, 3, 3, 3, 4],
  } as const;
  const tests = { 'p-1': [12, 10], 'p-2': [10.25, 9.25], 'p-3': [16, 15] } as const;
  await data.book.recordAll(DAY, [
    ...Object.entries(given).flatMap(([pupilId, values]) =>
      Object.entries(POINTS).map(([id, points], index) =>
        mark({ kind: 'component', componentId: id }, pupilId, values[index], points),
      ),
    ),
    ...Object.entries(tests).flatMap(([pupilId, [test, exam]]) => [
      mark({ kind: 'test', testId: 't-1' }, pupilId, test, 20),
      mark({ kind: 'exam' }, pupilId, exam, 20),
    ]),
  ]);
  return data;
}
