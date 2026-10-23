// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Continuous assessment's components (#238, answers 430 to 438): Algeria's
// presets, each adding up to its scale, primary's languages and maths apart
// from its music, visual arts and PE; the formulas a subject's averages
// follow; the term a day falls in; a setup applying from its term on, the
// last saved for a term counting whatever the order, read through a
// reshaped class, kept with the pupil records and travelling where they do,
// one per term; what keeps a setup from being saved; and a roll-call choice
// holding only with its component. Made-up records only.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  assessmentFor,
  formulaFor,
  layerOf,
  parseAssessmentData,
  parseCountryProfile,
  presetFor,
  recordsForRoute,
  savedSetup,
  setupOf,
  setupProblem,
  setupTotal,
  termNumberOn,
  type AssessmentData,
  type AssessmentPreset,
  type CountryProfile,
  type RecordEvent,
  type SetupLine,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

function readData(path: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../data/${path}`, import.meta.url), 'utf8'));
}

function algeria(): { profile: CountryProfile; data: AssessmentData } {
  const profile = parseCountryProfile(readData('dz/profile.json'));
  assert.ok(profile.ok);
  const data = parseAssessmentData(readData('dz/assessment.json'), profile.value);
  assert.deepEqual(data.ok ? [] : data.problems, []);
  assert.ok(data.ok);
  return { profile: profile.value, data: data.value };
}

/** The preset's lines with other points, in its order. */
function lines(preset: AssessmentPreset, points: readonly number[]): SetupLine[] {
  return preset.components.map((one, index) => ({ ...one, kind: 'preset', points: points[index]! }));
}

test('Algeria’s presets keep 2025/26’s rules, each adding up to its scale', () => {
  const { data } = algeria();
  assert.deepEqual(
    data.presets.map((one) => [one.level, one.scale, setupTotal(one.components), one.circular, one.subjects?.[0]]),
    [
      ['primary', 10, 10, '270', 'arabic'],
      ['primary', 10, 10, '270', 'music'],
      ['cem', 20, 20, '270', undefined],
      ['lycee', 20, 20, '270', undefined],
    ],
  );
  const cem = presetFor(data, 'cem', 'math')!;
  assert.equal(cem.rulesYear, '2025-2026');
  assert.deepEqual(
    cem.components.map((one) => [one.name['ar'], one.capture, one.points, one.min, one.max]),
    [
      ['المشاركة في القسم', 'session', 4, 2, 6],
      ['الاستجوابات الشفهية والكتابية', 'session', 3, 2, 5],
      ['الواجبات المنزلية', 'homework', 3, 2, 5],
      ['الكراس', 'periodic', 3, 2, 4],
      ['الانضباط والمواظبة', 'roll-call', 3, 1, 4],
      ['البحوث والمشاريع', 'manual', 4, 2, 6],
    ],
  );
  for (const preset of data.presets) assert.match(preset.source, /not official/);
  assert.deepEqual(formulaFor(data, 'cem', 'arabic')?.weights, { T: 1, F: 1, E: 4 });
  assert.equal(formulaFor(data, 'lycee', 'philosophy')?.id, 'lycee');
  assert.equal(presetFor(data, 'cem', 'music')?.level, 'cem');
});

test('primary’s music, visual arts and PE have a preset of their own and no formula', () => {
  const { data } = algeria();
  assert.deepEqual(
    ['arabic', 'math', 'islamic', 'music', 'pe'].map((subject) => [
      presetFor(data, 'primary', subject)?.subjects?.[0],
      formulaFor(data, 'primary', subject)?.id,
    ]),
    [
      ['arabic', 'primary-examined'],
      ['arabic', 'primary-examined'],
      [undefined, 'primary-exam-only'],
      ['music', undefined],
      ['music', undefined],
    ],
  );
  assert.deepEqual(
    presetFor(data, 'primary', 'visual-arts')!.components.map((one) => [one.id, one.points, one.min, one.max]),
    [
      ['participation', 3, 2, 4],
      ['practical', 4, 2, 5],
      ['ability', 3, 2, 4],
    ],
  );
  const primary = data.presets.filter((one) => one.level === 'primary');
  assert.equal(
    primary.some((preset) => preset.components.some((one) => one.capture === 'roll-call')),
    false,
  );
});

test('a day falls in its term; between terms in the next, and after the last in the last', () => {
  const year = {
    terms: [
      { number: 2, from: d('2027-01-03'), to: d('2027-03-18') },
      { number: 1, from: d('2026-09-21'), to: d('2026-12-17') },
      { number: 3, from: d('2027-04-04'), to: d('2027-07-08') },
    ],
  };
  assert.deepEqual(
    ['2026-09-01', '2026-10-23', '2026-12-17', '2026-12-18', '2027-03-20', '2027-07-20'].map((day) =>
      termNumberOn(year, d(day)),
    ),
    [1, 1, 1, 2, 3, 3],
  );
  assert.equal(termNumberOn({ terms: [] }, d('2026-10-23')), 1);
});

test('a setup applies from its term on, the last saved for a term counting whatever the order', async () => {
  const { data } = algeria();
  const cem = presetFor(data, 'cem', 'math')!;
  const book = await openBook(cemEvents());
  assert.equal(assessmentFor(book.state, cem, 'c-math', 1).saved, null);
  const save = (term: number, points: number[], rollCall = false): RecordEvent => ({
    kind: 'assessment.set',
    setup: setupOf('c-math', term, '2026.1', lines(cem, points), rollCall),
  });
  assert.equal(layerOf(save(1, [4, 3, 3, 3, 3, 4])), 'pupil-records');
  const saves = [
    save(3, [6, 2, 3, 2, 3, 4]),
    save(2, [5, 3, 3, 2, 3, 4], true),
    save(1, [6, 3, 2, 2, 3, 4]),
    save(3, [4, 4, 3, 2, 3, 4]),
    save(2, [5, 2, 4, 2, 3, 4]),
  ];
  for (const [index, event] of saves.entries()) await book.record(d(`2026-10-${10 + index}`), event);
  const points = (term: number) => assessmentFor(book.state, cem, 'c-math', term).lines.map((one) => one.points);
  assert.deepEqual([1, 2, 3].map(points), [
    [6, 3, 2, 2, 3, 4],
    [5, 2, 4, 2, 3, 4],
    [4, 4, 3, 2, 3, 4],
  ]);
  assert.equal(assessmentFor(book.state, cem, 'c-math', 2).rollCall, false);
  assert.equal(savedSetup(book.state, 'c-math', 2)?.release, '2026.1');
  const sent = recordsForRoute(book.state, 'school-space').flatMap((one) =>
    one.kind === 'assessment.set' ? [one.setup.components.map((part) => part.points)] : [],
  );
  assert.deepEqual(sent, [
    [6, 3, 2, 2, 3, 4],
    [5, 2, 4, 2, 3, 4],
    [4, 4, 3, 2, 3, 4],
  ]);
  const travelled = (route: Parameters<typeof recordsForRoute>[1]) =>
    recordsForRoute(book.state, route).filter((one) => one.kind === 'assessment.set').length;
  assert.deepEqual((['documents', 'handover-direct', 'statement', 'handover'] as const).map(travelled), [3, 3, 0, 0]);
});

test('a reshaped class reads the setup of the class it continues until it saves its own', async () => {
  const { data } = algeria();
  const cem = presetFor(data, 'cem', 'math')!;
  const book = await openBook(cemEvents());
  const own = (courseId: string, term: number, points: number[]): RecordEvent => ({
    kind: 'assessment.set',
    setup: setupOf(courseId, term, '2026.1', lines(cem, points), false),
  });
  await book.record(d('2026-09-28'), own('c-math', 1, [6, 3, 2, 2, 3, 4]));
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
  assert.deepEqual(
    assessmentFor(book.state, cem, 'c-new', 1).lines.map((one) => one.points),
    [6, 3, 2, 2, 3, 4],
  );
  await book.record(d('2027-01-05'), own('c-new', 2, [5, 3, 3, 2, 3, 4]));
  assert.equal(savedSetup(book.state, 'c-new', 1)?.courseId, 'c-math');
  assert.equal(savedSetup(book.state, 'c-new', 2)?.courseId, 'c-new');
});

test('a setup is saved only with every line in its range, every column named, and the scale reached', () => {
  const { data } = algeria();
  const cem = presetFor(data, 'cem', 'math')!;
  const preset = lines(cem, [4, 3, 3, 3, 3, 4]);
  assert.equal(setupProblem(cem, preset), null);
  const lowered = lines(cem, [4, 3, 3, 3, 3, 3]);
  assert.equal(setupTotal(lowered), 19);
  assert.equal(setupProblem(cem, lowered), 'total');
  assert.equal(setupProblem(cem, lines(cem, [4, 3, 3, 5, 3, 2])), 'range');
  const column = { kind: 'column' as const, id: 'col-1', name: '  عروض شفهية ', points: 1, min: 1, max: 10 };
  assert.equal(setupProblem(cem, [...lowered, column]), null);
  assert.equal(setupProblem(cem, [...lowered, { ...column, name: '  ' }]), 'name');
  assert.equal(setupProblem(cem, [...lowered, { ...column, name: 'م'.repeat(41) }]), 'name');
  assert.equal(setupProblem(cem, [...lowered, { ...column, name: ` ${'م'.repeat(40)} ` }]), null);
  const saved = setupOf('c-math', 1, '2026.1', [...lowered, column], true);
  assert.deepEqual(saved.components.at(-1), { kind: 'column', id: 'col-1', name: 'عروض شفهية', points: 1 });
  assert.deepEqual(saved.components[0], {
    kind: 'preset',
    id: 'participation',
    name: cem.components[0]!.name,
    points: 4,
  });
  assert.equal(saved.rollCall, true);
  const without = lowered.filter((one) => one.id !== 'attendance');
  assert.equal(setupOf('c-math', 1, '2026.1', without, true).rollCall, false);
});

test('a saved component the preset no longer has becomes a column, and roll call needs its component', async () => {
  const { data } = algeria();
  const cem = presetFor(data, 'cem', 'math')!;
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-20'), {
    kind: 'assessment.set',
    setup: {
      courseId: 'c-math',
      term: 1,
      release: '2025.9',
      components: [
        { kind: 'preset', id: 'participation', name: cem.components[0]!.name, points: 6 },
        { kind: 'preset', id: 'oral', name: { ar: 'التعبير الشفهي', en: 'Oral' }, points: 4 },
        { kind: 'column', id: 'col-1', name: 'عروض', points: 10 },
      ],
      rollCall: true,
    },
  });
  const { lines: now, rollCall } = assessmentFor(book.state, cem, 'c-math', 1);
  assert.equal(rollCall, false);
  assert.deepEqual(
    now.map((one) => [
      one.kind,
      one.id,
      one.kind === 'column' ? one.name : one.name['ar'],
      one.points,
      one.min,
      one.max,
    ]),
    [
      ['preset', 'participation', 'المشاركة في القسم', 6, 2, 6],
      ['column', 'oral', 'التعبير الشفهي', 4, 1, 10],
      ['column', 'col-1', 'عروض', 10, 1, 10],
    ],
  );
  assert.equal(setupProblem(cem, now), null);
  const kept = {
    kind: 'assessment.set' as const,
    setup: setupOf('c-math', 2, '2026.1', lines(cem, [4, 3, 3, 3, 3, 4]), true),
  };
  await book.record(d('2027-01-05'), kept);
  assert.equal(assessmentFor(book.state, cem, 'c-math', 2).rollCall, true);
});
