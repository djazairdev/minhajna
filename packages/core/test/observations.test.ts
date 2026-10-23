// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Descriptive observations in place of marks (#240, P-Obs, answer 464): the
// country's file read field by field, a grade's term naming each subject once;
// which grade, subject and term are observed; a class and subject's term by
// its grade; the last observation for each pupil, cleared ones left out; the
// counts on a list; and the observations travelling with the pupil records.
// Made-up records only.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  courseObserved,
  observationCounts,
  observationsFor,
  observedTerm,
  parseAssessmentData,
  parseCountryProfile,
  recordsForRoute,
  setObservation,
  type AssessmentData,
  type Observation,
  type RecordEvent,
} from '../src/index.ts';
import { d, openBook, primaryEvents } from './fixtures.ts';

const file = JSON.parse(readFileSync(new URL('../../../data/dz/assessment.json', import.meta.url), 'utf8')) as {
  observations: Record<string, unknown>[];
};
const profile = (() => {
  const read = parseCountryProfile(
    JSON.parse(readFileSync(new URL('../../../data/dz/profile.json', import.meta.url), 'utf8')),
  );
  assert.ok(read.ok);
  return read.value;
})();
const read = parseAssessmentData(file, profile);
assert.ok(read.ok);
const data: AssessmentData = read.value;

/** The primary fixture's class made a 1AP class. */
const firstYear = (): RecordEvent[] =>
  primaryEvents().map((event) =>
    event.kind === 'class.set' ? { ...event, schoolClass: { ...event.schoolClass, grade: '1ap' } } : event,
  );
const observe = (pupilId: string, value: Observation | null, term = 1) =>
  setObservation({ courseId: 'c-lang', term, pupilId }, value);

test('the file names 1AP term 1, 3AP French and English, and 4AP Tamazight, each with its source', () => {
  assert.deepEqual(
    data.observations?.map((one) => [one.grade, one.term, one.subjects ?? 'all', one.source.length > 0]),
    [
      ['1ap', 1, 'all', true],
      ['3ap', 1, ['french', 'english'], true],
      ['4ap', 1, ['tamazight'], true],
    ],
  );
  assert.deepEqual(
    [
      observedTerm(data, '1ap', 'math', 1),
      observedTerm(data, '1ap', 'math', 2),
      observedTerm(data, '3ap', 'english', 1),
      observedTerm(data, '3ap', 'arabic', 1),
      observedTerm(data, '4ap', 'tamazight', 1),
      observedTerm(data, '5ap', 'tamazight', 1),
      observedTerm({ country: data.country, release: data.release, presets: [], formulas: [] }, '1ap', 'math', 1),
    ],
    [true, false, true, false, true, false, false],
  );
});

test('an observed term is refused field by field, and a grade’s term names each subject once', () => {
  const problems = (observations: unknown) => {
    const result = parseAssessmentData({ ...file, observations }, profile);
    return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
  };
  const entry = (fields: Record<string, unknown>) => ({ grade: '3ap', term: 1, source: 'Made up.', ...fields });
  assert.deepEqual(problems([entry({ grade: '6ap' })]), ['observations[0].grade unknown-reference']);
  assert.deepEqual(problems([entry({ term: 0 })]), ['observations[0].term invalid']);
  assert.deepEqual(problems([entry({ term: 1.5 })]).length, 1);
  assert.deepEqual(problems([entry({ subjects: ['physics'] })]), ['observations[0].subjects unknown-reference']);
  assert.deepEqual(problems([entry({ source: undefined })]), ['observations[0].source required']);
  assert.deepEqual(problems('all'), ['observations invalid']);
  const french = entry({ subjects: ['french'] });
  assert.deepEqual(problems([french, entry({ subjects: ['english'] }), entry({ term: 2 })]), []);
  assert.deepEqual(problems([french, entry({ subjects: ['english', 'french'] })]), ['observations[1] duplicate']);
  assert.deepEqual(problems([entry({}), french]), ['observations[1] duplicate']);
  assert.deepEqual(problems([french, entry({})]), ['observations[1] duplicate']);
  const none = parseAssessmentData({ ...file, observations: undefined }, profile);
  assert.ok(none.ok);
  assert.equal('observations' in none.value, false);
});

test('a class and subject’s term is observed by its grade, and keeps each pupil’s last observation', async () => {
  const book = await openBook(firstYear());
  assert.deepEqual(
    [
      courseObserved(book.state, data, 'c-lang', 1),
      courseObserved(book.state, data, 'c-lang', 2),
      courseObserved(book.state, data, 'c-none', 1),
    ],
    [true, false, false],
  );
  await book.recordAll(d('2026-11-10'), [
    observe('q01', 'acquired'),
    observe('q02', 'not-acquired'),
    observe('q02', 'in-progress'),
    observe('q03', 'acquired'),
    observe('q03', null),
    observe('q04', 'acquired', 2),
  ]);
  const kept = observationsFor(book.state, 'c-lang', 1);
  assert.deepEqual(
    [...kept],
    [
      ['q01', 'acquired'],
      ['q02', 'in-progress'],
    ],
  );
  assert.deepEqual(observationCounts(['q01', 'q02', 'q03', 'q04'], new Map([...kept, ['q09', 'acquired']])), {
    acquired: 1,
    inProgress: 1,
    notAcquired: 0,
    missing: 2,
  });
  const sent = (route: Parameters<typeof recordsForRoute>[1]) =>
    recordsForRoute(book.state, route).flatMap((one) =>
      one.kind === 'observation.set'
        ? [`${one.observation.term} ${one.observation.pupilId} ${one.observation.value}`]
        : [],
    );
  assert.deepEqual(sent('school-space'), ['1 q01 acquired', '1 q02 in-progress', '2 q04 acquired']);
  assert.deepEqual(
    (['documents', 'handover-direct', 'statement', 'handover'] as const).map((route) => sent(route).length),
    [3, 3, 0, 0],
  );
});
