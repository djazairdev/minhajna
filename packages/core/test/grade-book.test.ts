// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The grade book (#240, answers 456 and 457): the pupils sitting the exam;
// T, F, E and the average by CEM's formula, none while a part is missing or
// the exam was missed; ranks sharing equal averages; the class's figures,
// with a 9.995 that shows 10.00 left below the threshold; primary's T as the
// mean of the months marked, none while one is short; a subject with no
// formula showing T alone; and how values show, in two decimals and in full.
// Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fullMark,
  gradeBook,
  reaches,
  setMark,
  shownAtThreshold,
  shownMark,
  type AssessmentData,
  type AssessmentPreset,
  type MarkTarget,
  type MarkValue,
  type PresetComponent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, primaryEvents } from './fixtures.ts';

const component = (id: string, points: number): PresetComponent => ({
  id,
  name: { ar: id },
  capture: 'manual',
  points,
  min: 1,
  max: points,
});
const preset = (level: string, scale: number, a: number, b: number): AssessmentPreset => ({
  level,
  scale,
  circular: '270',
  rulesYear: '2025-2026',
  components: [component('a', a), component('b', b)],
  source: 'Made up.',
});
const data: AssessmentData = {
  country: 'dz',
  release: 'test.1',
  presets: [preset('cem', 20, 12, 8), preset('primary', 10, 6, 4)],
  formulas: [
    { level: 'cem', id: 'cem', weights: { T: 1, F: 1, E: 4 } },
    { level: 'primary', id: 'primary-examined', weights: { T: 1, E: 1 } },
  ],
};

const mark = (courseId: string, target: MarkTarget, pupilId: string, value: MarkValue, max = 20) =>
  setMark({ courseId, term: 1, target, pupilId }, value, max);
const part = (componentId: string, month?: string): MarkTarget => ({
  kind: 'component',
  componentId,
  ...(month !== undefined && { month }),
});
const testOn = (id: string, day: string) =>
  ({
    kind: 'test.set',
    test: { id, courseId: 'c-math', day: d(day), slot: { half: 'morning', index: 1 }, groupId: 'g-all', title: id },
  }) as const;

/** p01 and p03 at 13.75, p02 at 9.995, p04 absent from the exam, p05 with a component empty. */
async function cemBook() {
  const book = await openBook(cemEvents());
  const math = (target: MarkTarget, pupilId: string, value: MarkValue, max = 20) =>
    mark('c-math', target, pupilId, value, max);
  const t1: MarkTarget = { kind: 'test', testId: 't-1' };
  const t2: MarkTarget = { kind: 'test', testId: 't-2' };
  const exam: MarkTarget = { kind: 'exam' };
  await book.recordAll(d('2026-12-10'), [
    testOn('t-1', '2026-11-08'),
    testOn('t-2', '2026-11-22'),
    testOn('t-3', '2027-02-01'),
    ...['p01', 'p03'].flatMap((id) => [
      math(part('a'), id, 10, 12),
      math(part('b'), id, 6, 8),
      math(t1, id, 12),
      math(t2, id, 9),
      math(exam, id, 14),
    ]),
    math(part('a'), 'p02', 8.47, 12),
    math(part('b'), 'p02', 4.25, 8),
    math(t1, 'p02', 10.25),
    math(t2, 'p02', 'absent'),
    math(exam, 'p02', 9.25),
    math(part('a'), 'p04', 6, 12),
    math(part('b'), 'p04', 4, 8),
    math(t1, 'p04', 11),
    math(exam, 'p04', 'absent'),
    math(part('a'), 'p05', 9, 12),
    math(t1, 'p05', 15),
    math(exam, 'p05', 13),
  ]);
  return book;
}

test('CEM’s book: T, F, E and ((T + F)/2 + 2E)/3 for each pupil sitting the exam, at full precision', async () => {
  const book = await cemBook();
  const sheet = gradeBook(contextOf(book), data, 'c-math', 1);
  assert.ok(sheet);
  assert.deepEqual([sheet.scale, sheet.threshold, sheet.parts, sheet.months], [20, 10, ['T', 'F', 'E'], []]);
  assert.equal(sheet.rows.length, 10);
  const row = (id: string) => sheet.rows.find((one) => one.pupilId === id);
  assert.deepEqual(row('p01'), {
    pupilId: 'p01',
    number: 1,
    months: [],
    T: 16,
    F: 10.5,
    E: 14,
    P: null,
    O: null,
    average: 13.75,
    rank: 1,
  });
  assert.deepEqual([row('p02')?.T, row('p02')?.F, row('p02')?.average?.toFixed(6)], [12.72, 10.25, '9.995000']);
  assert.deepEqual([row('p04')?.E, row('p04')?.average, row('p04')?.rank], ['absent', null, null]);
  assert.deepEqual([row('p05')?.T, row('p05')?.F, row('p05')?.average], [null, 15, null]);
  assert.deepEqual([row('p06')?.T, row('p06')?.F, row('p06')?.E], [null, null, null]);
  assert.deepEqual(
    sheet.rows.map((one) => one.rank),
    [1, 3, 1, null, null, null, null, null, null, null],
  );
  const { figures } = sheet;
  assert.deepEqual([figures.mean?.toFixed(6), figures.highest, figures.lowest], ['12.498333', 13.75, 9.995]);
  assert.deepEqual([figures.reached, figures.counted], [2, 3]);
  assert.equal(shownMark(row('p02')!.average!), '10.00');
  assert.equal(shownAtThreshold(row('p02')!.average!, 10), true);
  assert.equal(shownAtThreshold(13.75, 10), false);
});

test('primary’s T is the mean of the months marked, out of 10, and none while a month is short', async () => {
  const book = await openBook(primaryEvents());
  const lang = (target: MarkTarget, pupilId: string, value: number, max: number) =>
    mark('c-lang', target, pupilId, value, max);
  await book.recordAll(d('2026-12-10'), [
    lang(part('a', '2026-10'), 'q01', 5, 6),
    lang(part('b', '2026-10'), 'q01', 3, 4),
    lang(part('a', '2026-11'), 'q01', 4, 6),
    lang(part('b', '2026-11'), 'q01', 2, 4),
    lang({ kind: 'exam' }, 'q01', 8, 10),
    lang(part('a', '2026-10'), 'q02', 6, 6),
    lang(part('b', '2026-10'), 'q02', 4, 4),
    lang(part('a', '2026-11'), 'q02', 5, 6),
    lang({ kind: 'exam' }, 'q02', 9, 10),
  ]);
  const sheet = gradeBook(contextOf(book), data, 'c-lang', 1);
  assert.ok(sheet);
  assert.deepEqual(
    [sheet.scale, sheet.threshold, sheet.parts, sheet.months],
    [10, 5, ['T', 'E'], ['2026-10', '2026-11']],
  );
  const [q01, q02] = sheet.rows;
  assert.deepEqual([q01?.months, q01?.T, q01?.E, q01?.average], [[8, 6], 7, 8, 7.5]);
  assert.deepEqual([q02?.months, q02?.T, q02?.average], [[10, null], null, null]);
  assert.deepEqual([sheet.figures.reached, sheet.figures.counted], [1, 1]);
});

test('a subject with no formula shows T alone, and an unknown course or term has no book', async () => {
  const book = await openBook(primaryEvents());
  const noFormula: AssessmentData = { ...data, formulas: [] };
  const sheet = gradeBook(contextOf(book), noFormula, 'c-lang', 1);
  assert.deepEqual([sheet?.formula, sheet?.parts, sheet?.figures.counted], [null, ['T'], 0]);
  assert.ok(sheet?.rows.every((row) => row.average === null && row.rank === null));
  assert.equal(gradeBook(contextOf(book), data, 'c-none', 1), null);
  assert.equal(gradeBook(contextOf(book), data, 'c-lang', 9), null);
  assert.equal(gradeBook(contextOf(book), { ...data, presets: [] }, 'c-lang', 1), null);
});

test('a value shows two decimals rounded half up, and in full truncated to four', () => {
  assert.deepEqual(
    [shownMark(9.995), shownMark(12.725), shownMark(7.004999), shownMark(10)],
    ['10.00', '12.73', '7.00', '10.00'],
  );
  assert.deepEqual(
    [fullMark(9.996), fullMark(9.99999), fullMark(10), fullMark(12.5), fullMark(2 / 3)],
    ['9.996', '9.9999', '10.00', '12.50', '0.6666'],
  );
  assert.deepEqual([reaches(9.9999999999, 10), reaches(9.999, 10), reaches(10.01, 10)], [true, false, true]);
});
