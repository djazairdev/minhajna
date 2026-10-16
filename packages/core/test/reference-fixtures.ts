// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up data only (PRD §5.12). The calendar, the plans, the schools and
// the pupils are all invented. The country profile is modelled on Algeria's
// levels and session types; the real one lives in the data repository.

import {
  packKey,
  parseDay,
  parsePlanPack,
  type CalendarEntry,
  type CountryProfile,
  type Grade,
  type PlanPack,
  type Reference,
  type SchoolYear,
} from '../src/index.ts';

export const d = parseDay;

function grades(...codes: string[]): Grade[] {
  return codes.map((code) => ({ code, name: { en: code.toUpperCase() } }));
}

export const country: CountryProfile = {
  code: 'dz',
  release: '2026.1',
  weekStartsOn: 0,
  workingDays: [0, 1, 2, 3, 4],
  levels: [
    {
      code: 'primary',
      rollCallUnit: 'half-day',
      sessionMinutes: 45,
      name: { en: 'Primary' },
      grades: grades('1ap', '2ap', '3ap', '4ap', '5ap'),
    },
    {
      code: 'cem',
      rollCallUnit: 'session',
      sessionMinutes: 60,
      name: { en: 'Middle school' },
      grades: grades('1am', '2am', '3am', '4am'),
    },
    {
      code: 'lycee',
      rollCallUnit: 'session',
      sessionMinutes: 60,
      name: { en: 'Secondary school' },
      grades: grades('1as', '2as', '3as'),
    },
  ],
  subjects: [
    { code: 'math', name: { en: 'Mathematics' }, levels: ['primary', 'cem', 'lycee'] },
    { code: 'language', name: { en: 'Language' }, levels: ['primary'] },
  ],
  sessionTypes: [
    { code: 'lesson', queue: 'main', name: { en: 'Lesson' } },
    { code: 'integration', queue: 'main', name: { en: 'Integration' } },
    { code: 'td', queue: 'td', name: { en: 'Guided work' } },
    { code: 'remediation', queue: 'none', name: { en: 'Remediation' } },
    { code: 'reception', queue: 'none', name: { en: 'Reception' } },
    { code: 'free', queue: 'none', name: { en: 'Free slot' } },
    { code: 'test', queue: 'none', name: { en: 'Test' } },
    { code: 'exam', queue: 'none', name: { en: 'Exam' } },
  ],
};

export const year: SchoolYear = {
  id: '2026-2027',
  from: d('2026-09-20'),
  to: d('2027-06-10'),
  terms: [
    { number: 1, from: d('2026-09-20'), to: d('2026-12-17') },
    { number: 2, from: d('2027-01-03'), to: d('2027-03-18') },
    { number: 3, from: d('2027-04-04'), to: d('2027-06-10') },
  ],
  source: 'made up for tests',
};

function entry(fields: Omit<CalendarEntry, 'source' | 'confidence'>): CalendarEntry {
  return { source: 'made up for tests', confidence: 'announced', ...fields };
}

export const calendar: readonly CalendarEntry[] = [
  entry({
    id: 'autumn',
    layer: 'national',
    from: d('2026-10-29'),
    to: d('2026-11-07'),
    effect: 'no-school',
    name: { en: 'Autumn holidays' },
  }),
  entry({
    id: 'storm',
    layer: 'zone',
    zone: '16',
    from: d('2026-11-18'),
    to: d('2026-11-18'),
    effect: 'closure',
    name: { en: 'Weather closure' },
  }),
  entry({
    id: 'storm-elsewhere',
    layer: 'zone',
    zone: '31',
    from: d('2026-11-22'),
    to: d('2026-11-22'),
    effect: 'closure',
    name: { en: 'Weather closure' },
  }),
  entry({
    id: 'exams-1',
    layer: 'national',
    from: d('2026-12-06'),
    to: d('2026-12-10'),
    effect: 'exam',
    levels: ['cem'],
    term: 1,
    name: { en: 'Term 1 exams' },
  }),
  entry({
    id: 'winter',
    layer: 'national',
    from: d('2026-12-18'),
    to: d('2027-01-02'),
    effect: 'no-school',
    name: { en: 'Winter holidays' },
  }),
  entry({
    id: 'term-2-weeks',
    layer: 'national',
    from: d('2027-01-03'),
    to: d('2027-01-03'),
    effect: 'week-a',
    name: { en: 'Term 2 starts on an A week' },
  }),
  entry({
    id: 'spring',
    layer: 'national',
    from: d('2027-03-19'),
    to: d('2027-04-03'),
    effect: 'no-school',
    name: { en: 'Spring holidays' },
  }),
];

/** A made-up budget pack, shaped like a CEM maths plan. */
export const mathPackSource = {
  format: 1,
  id: 'dz.cem.1am.math.example',
  release: '2026.1',
  status: 'example',
  licence: 'full-text',
  language: 'en',
  anchor: { kind: 'budgets', unit: 'hours' },
  provenance: { issuer: 'Made up for tests', edition: 'example' },
  stageTemplates: [{ id: 'std', stages: ['Warm-up', 'Construction', 'Practice', 'Assessment'] }],
  items: [
    { id: 'd1', kind: 'diagnostic', title: 'Diagnostic assessment', budget: 1, buffer: true, term: 1 },
    { id: 'u1', kind: 'unit', title: 'Whole numbers' },
    {
      id: 'l1',
      kind: 'lesson',
      title: 'Reading and writing whole numbers',
      unit: 'u1',
      budget: 2,
      stages: 'std',
      term: 1,
    },
    { id: 'l2', kind: 'lesson', title: 'Comparing and ordering', unit: 'u1', budget: 1, stages: 'std', term: 1 },
    { id: 'l3', kind: 'lesson', title: 'Adding whole numbers', unit: 'u1', budget: 1, term: 1 },
    { id: 'l4', kind: 'lesson', title: 'Subtracting whole numbers', unit: 'u1', budget: 2, term: 1 },
    { id: 't1', kind: 'td', title: 'Number line practice', unit: 'u1', budget: 1 },
    { id: 't2', kind: 'td', title: 'Mental arithmetic', unit: 'u1', budget: 1 },
    { id: 'i1', kind: 'integration', title: 'Planning a class trip', unit: 'u1', budget: 1, term: 1 },
    {
      id: 'r1',
      kind: 'assessment-remediation',
      title: 'Assessment and remediation',
      unit: 'u1',
      budget: 2,
      buffer: true,
      term: 1,
    },
    { id: 'u2', kind: 'unit', title: 'Fractions' },
    { id: 'l5', kind: 'lesson', title: 'Fractions as parts of a whole', unit: 'u2', budget: 2, stages: 'std', term: 1 },
    { id: 'l6', kind: 'lesson', title: 'Equivalent fractions', unit: 'u2', budget: 2, optional: true, term: 2 },
    { id: 'l7', kind: 'lesson', title: 'Comparing fractions', unit: 'u2', budget: 1, term: 2 },
  ],
  merges: [['l2', 'l3']],
};

/** A made-up week pack, shaped like a primary language plan with activity slots. */
export const languagePackSource = {
  format: 1,
  id: 'dz.primary.5ap.language.example',
  release: '2026.1',
  status: 'example',
  licence: 'full-text',
  language: 'en',
  anchor: { kind: 'weeks' },
  provenance: { issuer: 'Made up for tests', edition: 'example' },
  items: [
    { id: 'r1', kind: 'lesson', title: 'Reading 1', week: 1, activity: 'reading', term: 1 },
    { id: 'w1', kind: 'lesson', title: 'Writing 1', week: 1, activity: 'writing', term: 1 },
    { id: 's1', kind: 'lesson', title: 'Speaking 1', week: 1, term: 1 },
    { id: 'r2', kind: 'lesson', title: 'Reading 2', week: 1, activity: 'reading', term: 1 },
    { id: 'w2', kind: 'lesson', title: 'Writing 2', week: 1, activity: 'writing', term: 1 },
    { id: 'r3', kind: 'lesson', title: 'Reading 3', week: 2, activity: 'reading', term: 1 },
    { id: 'w3', kind: 'lesson', title: 'Writing 3', week: 2, activity: 'writing', term: 1 },
    { id: 's2', kind: 'lesson', title: 'Speaking 2', week: 2, term: 1 },
    { id: 'r4', kind: 'lesson', title: 'Reading 4', week: 2, activity: 'reading', term: 1 },
    { id: 'w4', kind: 'lesson', title: 'Writing 4', week: 2, activity: 'writing', term: 1 },
    { id: 'b1', kind: 'assessment-remediation', title: 'Integration and remediation', week: 3, buffer: true, term: 1 },
  ],
};

function readPack(source: unknown): PlanPack {
  const result = parsePlanPack(source);
  if (!result.ok) throw new Error(`Fixture pack is invalid: ${JSON.stringify(result.problems)}`);
  return result.value;
}

export const mathPack = readPack(mathPackSource);
export const languagePack = readPack(languagePackSource);

export const reference: Reference = {
  country,
  year,
  calendar,
  packs: new Map([
    [packKey(mathPack.id, mathPack.release), mathPack],
    [packKey(languagePack.id, languagePack.release), languagePack],
  ]),
};
