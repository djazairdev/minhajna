// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The plans a school's share reads (#601, answer 631): one for each class and
// subject the timetable holds, under the course its signed weeks name, with the
// class's grade, the teacher of its first session in the week that names one
// and its pinned pack's items in order, none for a subject it pins no pack in
// or whose pack is unknown; and none for a class the school does not list; and
// only names the server takes, a class with another grade name giving none and
// a session with no teacher counting for none, and items otherwise named,
// repeated or past the most a grade gives left out; and the first of two
// classes whose names make one course giving its plan. Every school, class and
// teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkPlans,
  courseId,
  MOST_GRADE_ITEMS,
  schoolPlans,
  type DemoSchool,
  type DemoSession,
} from '../src/index.ts';
import { mac } from './world-crypto.ts';

const SPACE = 'space-of-school-1';
const slot = { half: 'morning', index: 1 } as const;
const session = (classId: string, subject: string, teacherId: string, weekday: 0 | 1 = 0): DemoSession => ({
  classId,
  teacherId,
  subject,
  weekday,
  slot,
});

const school = {
  classes: [
    { id: 'c1', grade: '4am', name: '4AM1', pupils: [], packs: { math: { id: 'math-4am', release: '2026.1' } } },
    { id: 'c2', grade: '1am', name: '1AM2', pupils: [], packs: { math: { id: 'math-9', release: '2026.1' } } },
  ],
  week: [
    session('c1', 'math', 'teacher-1'),
    session('c1', 'math', 'teacher-2', 1),
    session('c1', 'arabic', 'teacher-3'),
    session('c2', 'math', 'teacher-1'),
    session('c9', 'math', 'teacher-1'),
  ],
} satisfies Pick<DemoSchool, 'classes' | 'week'>;

describe('the plans a school’s share reads', () => {
  it('gives each class and subject its grade, first teacher and pinned pack’s items, under its course', async () => {
    const itemsOf = ({ id }: { id: string }) => (id === 'math-4am' ? ['u1.l1', 'u1.l2'] : undefined);
    const plans = await schoolPlans(SPACE, school, itemsOf, mac);
    const course = (name: string, subject: string) => courseId(SPACE, name, subject, mac);
    assert.deepEqual(plans, {
      [await course('4AM1', 'math')]: { grade: '4am', teacher: 'teacher-1', items: ['u1.l1', 'u1.l2'] },
      [await course('4AM1', 'arabic')]: { grade: '4am', teacher: 'teacher-3', items: [] },
      [await course('1AM2', 'math')]: { grade: '1am', teacher: 'teacher-1', items: [] },
    });
  });

  it('gives only names the server takes, so a bad pack costs only its reach', async () => {
    const many = Array.from({ length: MOST_GRADE_ITEMS + 5 }, (_, at) => `item-${at}`);
    const listed = ['constructor', '__x', 'item-0', 'item-0', ...many];
    const odd = {
      classes: [
        { ...school.classes[0]!, packs: { math: { id: 'big', release: '1' } } },
        { ...school.classes[1]!, grade: '__proto__' },
      ],
      week: [
        session('c1', 'math', ''),
        session('c1', 'math', 'teacher-1'),
        session('c2', 'math', 'teacher-1'),
        session('c1', 'arabic', ''),
      ],
    } satisfies Pick<DemoSchool, 'classes' | 'week'>;
    const plans = await schoolPlans(SPACE, odd, () => listed, mac);
    checkPlans(plans);
    assert.deepEqual(Object.values(plans), [
      { grade: '4am', teacher: 'teacher-1', items: many.slice(0, MOST_GRADE_ITEMS) },
    ]);
  });

  it('gives the first of two classes whose names make one course its plan', async () => {
    const twins = {
      classes: [school.classes[0]!, { ...school.classes[1]!, name: '4am1' }],
      week: [session('c1', 'math', 'teacher-1'), session('c2', 'math', 'teacher-2')],
    } satisfies Pick<DemoSchool, 'classes' | 'week'>;
    const plans = await schoolPlans(SPACE, twins, () => [], mac);
    assert.deepEqual(Object.values(plans), [{ grade: '4am', teacher: 'teacher-1', items: [] }]);
  });
});
