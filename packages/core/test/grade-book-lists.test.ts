// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whom the grade book lists, and what it reads (#240, answer 457): the pupils
// enrolled on the exam window's first day, or on the term's last day with no
// window; in a joint class, the level's pupils on the level's own window; a
// primary subject with an exam only, its average the exam; and a month marked
// only for a component taken out of the setup left out of T. Made-up records
// only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gradeBook,
  joinPupil,
  makeContext,
  setMark,
  type AssessmentData,
  type MarkTarget,
  type RecordEvent,
  type SchoolClass,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents, reference } from './fixtures.ts';

const preset = (level: string, scale: number, subjects?: string[]) => ({
  level,
  scale,
  circular: '270',
  rulesYear: '2025-2026',
  ...(subjects !== undefined && { subjects }),
  components: [
    { id: 'a', name: { ar: 'a' }, capture: 'manual' as const, points: scale / 2, min: 1, max: scale / 2 },
    { id: 'b', name: { ar: 'b' }, capture: 'manual' as const, points: scale / 2, min: 1, max: scale / 2 },
  ],
  source: 'Made up.',
});
const data: AssessmentData = {
  country: 'dz',
  release: 'test.1',
  presets: [preset('cem', 20), preset('primary', 10)],
  formulas: [
    { level: 'cem', id: 'cem', weights: { T: 1, F: 1, E: 4 } },
    { level: 'primary', id: 'primary-examined', weights: { T: 1, E: 1 } },
  ],
};
const ids = (rows: readonly { pupilId: string }[] | undefined) => rows?.map((row) => row.pupilId);

test('the rows are the pupils on the exam window’s first day, or on the term’s last day without one', async () => {
  const book = await openBook(cemEvents());
  const joining = { id: 'p11', classId: 'k-1am2', name: 'Made-up Pupil', sex: 'f', reason: 'transfer' } as const;
  await book.record(d('2026-12-07'), joinPupil(contextOf(book), { ...joining, day: d('2026-12-07') }));
  const first = gradeBook(contextOf(book), data, 'c-math', 1);
  assert.equal(first?.rows.length, 10);
  assert.ok(!ids(first?.rows)?.includes('p11'));
  const second = gradeBook(contextOf(book), data, 'c-math', 2);
  assert.equal(ids(second?.rows)?.at(-1), 'p11');
  assert.deepEqual(
    second?.rows.map((row) => row.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
});

test('a joint class lists the level’s own pupils, on its own window', async () => {
  const joint: SchoolClass = {
    id: 'k-5apb',
    schoolId: 's-pri',
    level: 'primary',
    grade: '4ap',
    name: '4-5AP',
    groups: [
      { id: 'h-all', kind: 'whole', name: '4-5AP' },
      { id: 'g-4', kind: 'level', name: '4AP', grade: '4ap' },
      { id: 'g-5', kind: 'level', name: '5AP', grade: '5ap' },
    ],
  };
  const events: RecordEvent[] = [
    ...primaryEvents().map((event): RecordEvent => {
      if (event.kind === 'class.set') return { kind: 'class.set', schoolClass: joint };
      if (event.kind === 'pupil.set') {
        const level = ['q01', 'q02'].includes(event.pupil.id) ? 'g-4' : 'g-5';
        return { kind: 'pupil.set', pupil: { ...event.pupil, groups: [level] } };
      }
      if (event.kind === 'course.set') return { kind: 'course.set', course: { ...event.course, grade: '5ap' } };
      return event;
    }),
    {
      kind: 'course.set',
      course: { id: 'c-lang-4', classId: 'k-5apb', subject: 'language', year: '2026-2027', pack: null, grade: '4ap' },
    },
  ];
  const exams = {
    id: 'exams-5',
    layer: 'national' as const,
    from: d('2026-12-06'),
    to: d('2026-12-10'),
    effect: 'exam' as const,
    levels: ['primary'],
    grades: ['5ap'],
    term: 1,
    name: { en: 'Made-up 5AP exams' },
    source: 'made up for tests',
    confidence: 'announced' as const,
  };
  const book = await openBook(events);
  const context = makeContext({ ...reference, calendar: [...reference.calendar, exams] }, book.state);
  assert.deepEqual(ids(gradeBook(context, data, 'c-lang-4', 1)?.rows), ['q01', 'q02']);
  const fifth = ids(gradeBook(context, data, 'c-lang', 1)?.rows) ?? [];
  assert.ok(fifth.length > 0 && !fifth.some((id) => ['q01', 'q02'].includes(id)));
});

test('a primary subject with an exam only averages the exam', async () => {
  const book = await openBook(primaryEvents());
  const examOnly: AssessmentData = {
    ...data,
    presets: [preset('primary', 10, ['math'])],
    formulas: [{ level: 'primary', id: 'primary-exam-only', weights: { E: 1 } }],
  };
  await book.record(
    d('2026-12-10'),
    setMark({ courseId: 'c-lang', term: 1, target: { kind: 'exam' }, pupilId: 'q01' }, 7.5, 10),
  );
  const sheet = gradeBook(contextOf(book), examOnly, 'c-lang', 1);
  assert.deepEqual([sheet?.parts, sheet?.months, sheet?.scale], [['E'], [], 10]);
  assert.deepEqual([sheet?.rows[0]?.T, sheet?.rows[0]?.E, sheet?.rows[0]?.average], [null, 7.5, 7.5]);
});

test('a month marked only for a component taken out of the setup is not one of the book’s months', async () => {
  const book = await openBook(primaryEvents());
  const component = (componentId: string, month: string, value: number) => {
    const target: MarkTarget = { kind: 'component', componentId, month };
    return setMark({ courseId: 'c-lang', term: 1, target, pupilId: 'q01' }, value, 5);
  };
  await book.recordAll(d('2026-12-10'), [
    component('a', '2026-10', 4),
    component('b', '2026-10', 3),
    component('gone', '2026-11', 2),
  ]);
  const sheet = gradeBook(contextOf(book), data, 'c-lang', 1);
  assert.deepEqual([sheet?.months, sheet?.rows[0]?.months, sheet?.rows[0]?.T], [['2026-10'], [7], 7]);
});
