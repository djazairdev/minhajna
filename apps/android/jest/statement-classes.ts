// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up classes for the progress statement's tests (#438, #439): 1م1 on the
// example mathematics pack with its Thursday lesson confirmed on 15 October
// 2026, 1م2 on the same pack, and 1م3 with no plan. A long name for 1م1 makes
// its signed statement too long for one QR code.

import { confirmSessions, parseDay, todayView, type RecordEvent } from '@minhajna/core';
import { coreContext } from '../src/storage/core-context';
import type { TestData } from './app-data';
import { withTd } from './td-class';

const klass = (id: string, name: string): RecordEvent => ({
  kind: 'class.set',
  schoolClass: {
    id,
    schoolId: 's-1',
    level: 'cem',
    grade: '1am',
    name,
    groups: [{ id: `${id}-w`, kind: 'whole', name }],
  },
});
const course = (id: string, classId: string, pack: boolean): RecordEvent => ({
  kind: 'course.set',
  course: {
    id,
    classId,
    subject: 'math',
    year: '2026-2027',
    pack: pack ? { id: 'dz.cem.1am.math.example', release: '2026.1' } : null,
  },
});

/** The three classes, with 1\u06451 renamed `name` when given; c-m, c-n and c-o are their courses. */
export async function statementClasses(name?: string): Promise<TestData> {
  const day = parseDay('2026-10-15');
  const data = await withTd(false, true);
  await data.book.recordAll(day, [
    ...(name === undefined ? [] : [klass('k-m', name)]),
    klass('k-n', '1\u06452'),
    course('c-n', 'k-n', true),
    klass('k-o', '1\u06453'),
    course('c-o', 'k-o', false),
  ]);
  const context = () => coreContext({ ...data, state: data.book.state });
  const lesson = todayView(context(), day).sessions.find((one) => one.session.courseId === 'c-m');
  await data.book.recordAll(day, confirmSessions(context(), [{ session: lesson!.session }]));
  return data;
}
