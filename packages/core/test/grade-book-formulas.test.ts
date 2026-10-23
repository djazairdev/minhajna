// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lycée's formulas with practical work or an oral (#240, answer 463): the
// level's formula for a subject never an alternative; a subject's choices,
// its level's first; the formula a class and subject follows, the last one
// recorded while it is still a choice, kept by a reshaped class; the book's P
// or O when the formula weighs them, «غ» leaving the average empty; and the
// choice travelling with the pupil records, the last one for each course.
// Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  courseFormula,
  formulaChoices,
  formulaFor,
  gradeBook,
  recordsForRoute,
  setMark,
  type AssessmentData,
  type FormulaId,
  type MarkTarget,
  type MarkValue,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const data: AssessmentData = {
  country: 'dz',
  release: 'test.1',
  presets: [
    {
      level: 'lycee',
      scale: 20,
      circular: '270',
      rulesYear: '2025-2026',
      components: [{ id: 'a', name: { ar: 'a' }, capture: 'manual', points: 20, min: 1, max: 20 }],
      source: 'Made up.',
    },
  ],
  formulas: [
    { level: 'lycee', id: 'lycee-oral', alternative: true, subjects: ['english'], weights: { T: 1, F: 1, O: 1, E: 2 } },
    { level: 'lycee', id: 'lycee', weights: { T: 1, F: 1, E: 2 } },
    { level: 'lycee', id: 'lycee-practical', alternative: true, weights: { T: 1, F: 1, P: 1, E: 2 } },
  ],
};

/** The CEM fixtures' class made a first-year lycée class. */
const lyceeEvents = (): RecordEvent[] =>
  cemEvents().map((event) =>
    event.kind === 'class.set'
      ? { ...event, schoolClass: { ...event.schoolClass, level: 'lycee', grade: '1as' } }
      : event.kind === 'school.set'
        ? { ...event, school: { ...event.school, levels: ['lycee'] } }
        : event,
  );
const chosen = (formula: FormulaId, courseId = 'c-math'): RecordEvent => ({ kind: 'formula.set', courseId, formula });
const testOn: RecordEvent = {
  kind: 'test.set',
  test: {
    id: 't-1',
    courseId: 'c-math',
    day: d('2026-11-08'),
    slot: { half: 'morning', index: 1 },
    groupId: 'g-all',
    title: 't-1',
  },
};
const mark = (target: MarkTarget, pupilId: string, value: MarkValue) =>
  setMark({ courseId: 'c-math', term: 1, target, pupilId }, value, 20);

test('a subject’s choices: its level’s formula first, then the alternatives for it', () => {
  const ids = (subject: string) => formulaChoices(data, 'lycee', subject).map((one) => one.id);
  assert.equal(formulaFor(data, 'lycee', 'english')?.id, 'lycee');
  assert.deepEqual(ids('math'), ['lycee', 'lycee-practical']);
  assert.deepEqual(ids('english'), ['lycee', 'lycee-oral', 'lycee-practical']);
  assert.deepEqual(formulaChoices({ ...data, formulas: data.formulas.slice(2) }, 'lycee', 'math'), []);
  assert.deepEqual(formulaChoices(data, 'cem', 'math'), []);
});

test('a class and subject follows its last formula while still a choice, and a reshaped class keeps it', async () => {
  const book = await openBook(lyceeEvents());
  const followed = () => courseFormula(book.state, data, 'c-math')?.id;
  assert.equal(followed(), 'lycee');
  await book.record(d('2026-10-01'), chosen('lycee-practical'));
  assert.equal(followed(), 'lycee-practical');
  await book.record(d('2026-10-02'), chosen('lycee-oral'));
  assert.equal(followed(), 'lycee');
  await book.record(d('2026-10-03'), chosen('lycee-practical'));
  assert.equal(followed(), 'lycee-practical');
  assert.equal(courseFormula(book.state, data, 'c-none'), undefined);
  await book.record(d('2026-10-08'), {
    kind: 'course.set',
    course: {
      id: 'c-new',
      classId: 'k-1am2',
      subject: 'math',
      year: '2026-2027',
      pack: null,
      continues: { courseId: 'c-math', from: d('2026-10-08') },
    },
  });
  assert.equal(courseFormula(book.state, data, 'c-new')?.id, 'lycee-practical');
  await book.record(d('2026-10-09'), chosen('lycee', 'c-new'));
  assert.equal(courseFormula(book.state, data, 'c-new')?.id, 'lycee');
});

test('the book shows P when the formula weighs it, and «غ» leaves the average empty', async () => {
  const book = await openBook(lyceeEvents());
  await book.recordAll(d('2026-12-10'), [
    testOn,
    chosen('lycee-practical'),
    ...['p01', 'p02', 'p03'].flatMap((id) => [
      mark({ kind: 'component', componentId: 'a' }, id, 12),
      mark({ kind: 'test', testId: 't-1' }, id, 10),
      mark({ kind: 'exam' }, id, 14),
      mark({ kind: 'oral' }, id, 18),
    ]),
    mark({ kind: 'practical' }, 'p01', 16),
    mark({ kind: 'practical' }, 'p02', 'absent'),
  ]);
  const sheet = gradeBook(contextOf(book), data, 'c-math', 1);
  assert.ok(sheet);
  assert.deepEqual([sheet.formula?.id, sheet.parts], ['lycee-practical', ['T', 'F', 'E', 'P']]);
  const row = (id: string) => sheet.rows.find((one) => one.pupilId === id);
  assert.deepEqual(
    ['p01', 'p02', 'p03'].map((id) => [row(id)?.P, row(id)?.O, row(id)?.average]),
    [
      [16, null, (12 + 10 + 16 + 2 * 14) / 5],
      ['absent', null, null],
      [null, null, null],
    ],
  );
  await book.record(d('2026-12-11'), chosen('lycee'));
  const usual = gradeBook(contextOf(book), data, 'c-math', 1);
  assert.deepEqual(
    [usual?.parts, usual?.rows[0]?.P, usual?.rows.map((one) => one.average).slice(0, 3)],
    [['T', 'F', 'E'], null, [12.5, 12.5, 12.5]],
  );
});

test('the choice travels with the pupil records, the last one for each course', async () => {
  const book = await openBook(lyceeEvents());
  await book.recordAll(d('2026-10-01'), [chosen('lycee-practical'), chosen('lycee-oral', 'c-art'), chosen('lycee')]);
  const sent = (route: Parameters<typeof recordsForRoute>[1]) =>
    recordsForRoute(book.state, route).flatMap((one) =>
      one.kind === 'formula.set' ? [`${one.courseId} ${one.formula}`] : [],
    );
  assert.deepEqual(sent('school-space'), ['c-art lycee-oral', 'c-math lycee']);
  assert.deepEqual(
    (['documents', 'handover-direct', 'statement', 'handover'] as const).map((route) => sent(route).length),
    [2, 2, 0, 0],
  );
});
