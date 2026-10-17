// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CalendarView,
  parseCountryProfile,
  parseDay,
  parseSchoolCalendar,
  type CountryProfile,
  type School,
} from '../src/index.ts';

// Made up for tests, in the shape of a country profile and a calendar file.
const profileSource = {
  format: 1,
  code: 'dz',
  release: '2026.1',
  weekStartsOn: 0,
  workingDays: [0, 1, 2, 3, 4],
  levels: [
    {
      code: 'primary',
      rollCallUnit: 'half-day',
      sessionMinutes: 45,
      name: { en: 'Primary', fr: 'Primaire' },
      grades: [
        { code: '1ap', name: { en: 'Year 1' } },
        { code: '2ap', name: { en: 'Year 2' } },
      ],
    },
    {
      code: 'cem',
      rollCallUnit: 'session',
      sessionMinutes: 60,
      name: { en: 'Middle school' },
      grades: [
        { code: '1am', name: { en: 'Year 1' } },
        { code: '4am', name: { en: 'Year 4' } },
      ],
    },
  ],
  subjects: [
    { code: 'math', name: { en: 'Mathematics' }, levels: ['primary', 'cem'] },
    { code: 'physics', name: { en: 'Physics' }, levels: ['cem'] },
  ],
  sessionTypes: [
    { code: 'lesson', queue: 'main', name: { en: 'Lesson' } },
    { code: 'td', queue: 'td', name: { en: 'Guided work' } },
  ],
};

const calendarSource = {
  format: 1,
  country: 'dz',
  release: '2026.1',
  year: {
    id: '2026-2027',
    from: '2026-09-20',
    to: '2027-06-10',
    terms: [
      { number: 1, from: '2026-09-20', to: '2026-12-17' },
      { number: 2, from: '2027-01-03', to: '2027-03-18' },
      { number: 3, from: '2027-04-04', to: '2027-06-10' },
    ],
    source: 'Made-up notice',
  },
  entries: [
    {
      id: 'autumn',
      layer: 'national',
      from: '2026-10-28',
      to: '2026-11-01',
      effect: 'no-school',
      name: { en: 'Autumn holidays' },
      source: 'Made-up notice',
      confidence: 'announced',
    },
    {
      id: 'exams-1-4am',
      layer: 'national',
      from: '2026-12-06',
      to: '2026-12-10',
      effect: 'exam',
      levels: ['cem'],
      grades: ['4am'],
      term: 1,
      name: { en: 'Term 1 exams' },
      source: 'Made-up notice',
      confidence: 'announced',
    },
    {
      id: 'storm',
      layer: 'zone',
      zone: '16',
      from: '2026-11-18',
      to: '2026-11-18',
      effect: 'closure',
      name: { en: 'Weather closure' },
      source: 'Made-up notice',
      confidence: 'announced',
    },
  ],
};

function readProfile(): CountryProfile {
  const result = parseCountryProfile(profileSource);
  assert.ok(result.ok);
  return result.value;
}

function profileProblems(source: unknown): unknown {
  const result = parseCountryProfile(source);
  return result.ok ? [] : result.problems;
}

function calendarProblems(source: unknown): unknown {
  const result = parseSchoolCalendar(source, readProfile());
  return result.ok ? [] : result.problems;
}

function withEntry(fields: Record<string, unknown>): unknown {
  const [first] = calendarSource.entries;
  return { ...calendarSource, entries: [{ ...first, ...fields }] };
}

describe('country profiles', () => {
  it('reads a valid profile', () => {
    const profile = readProfile();
    assert.equal(profile.release, '2026.1');
    assert.deepEqual(
      profile.levels.map((level) => level.grades.map((grade) => grade.code)),
      [
        ['1ap', '2ap'],
        ['1am', '4am'],
      ],
    );
    assert.deepEqual(profile.subjects[1], { code: 'physics', name: { en: 'Physics' }, levels: ['cem'] });
  });

  it('drops fields outside the format', () => {
    const [primary, cem] = profileSource.levels;
    const result = parseCountryProfile({
      ...profileSource,
      updateUrl: 'https://example.org/run',
      levels: [{ ...primary, script: 'run()' }, cem],
      subjects: profileSource.subjects.map((subject) => ({ ...subject, colour: 'red' })),
    });
    assert.ok(result.ok);
    assert.doesNotMatch(JSON.stringify(result.value), /example\.org|run\(\)|red/);
  });

  it('refuses what the format does not allow, and reports every problem', () => {
    const [primary, cem] = profileSource.levels;
    assert.deepEqual(
      profileProblems({
        ...profileSource,
        code: 'DZA',
        weekStartsOn: 7,
        workingDays: [0, 0],
        levels: [
          { ...primary, rollCallUnit: 'lesson' },
          { ...cem, grades: [{ code: '1ap', name: { en: 'Again' } }] },
        ],
        subjects: [{ code: 'math', name: { en: 'Mathematics' }, levels: ['lycee'] }],
        sessionTypes: [{ code: 'lesson', queue: 'side', name: {} }],
      }),
      [
        { path: 'code', problem: 'invalid' },
        { path: 'weekStartsOn', problem: 'invalid' },
        { path: 'workingDays', problem: 'invalid' },
        { path: 'levels[0].rollCallUnit', problem: 'invalid' },
        { path: 'levels[1].grades[0].code', problem: 'duplicate' },
        { path: 'subjects[0].levels', problem: 'unknown-reference' },
        { path: 'sessionTypes[0].queue', problem: 'invalid' },
        { path: 'sessionTypes[0].name', problem: 'invalid' },
      ],
    );
    assert.deepEqual(profileProblems({ ...profileSource, levels: [] }), [
      { path: 'levels', problem: 'invalid' },
      { path: 'subjects[0].levels', problem: 'unknown-reference' },
      { path: 'subjects[1].levels', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(profileProblems({ ...profileSource, format: 2, release: 'first' }), [
      { path: 'format', problem: 'invalid' },
      { path: 'release', problem: 'invalid' },
    ]);
    assert.deepEqual(profileProblems('not a profile'), [{ path: '', problem: 'invalid' }]);
  });

  it('asks every name for a language code and a text', () => {
    const [primary, cem] = profileSource.levels;
    assert.deepEqual(
      profileProblems({ ...profileSource, levels: [{ ...primary, name: { English: 'Primary' } }, cem] }),
      [{ path: 'levels[0].name', problem: 'invalid' }],
    );
    assert.deepEqual(profileProblems({ ...profileSource, levels: [{ ...primary, name: { en: ' ' } }, cem] }), [
      { path: 'levels[0].name', problem: 'invalid' },
    ]);
  });
});

describe('school calendars', () => {
  // Fields a national entry does not have stay absent.
  it('reads a valid calendar', () => {
    const result = parseSchoolCalendar(calendarSource, readProfile());
    assert.ok(result.ok);
    const { year, entries } = result.value;
    assert.equal(year.terms.length, 3);
    assert.equal(year.source, 'Made-up notice');
    assert.deepEqual(entries[1]?.grades, ['4am']);
    assert.equal(entries[2]?.zone, '16');
    assert.equal('zone' in (entries[0] ?? {}), false);
  });

  it('gives the calendar view its holidays', () => {
    const profile = readProfile();
    const result = parseSchoolCalendar(calendarSource, profile);
    assert.ok(result.ok);
    const ref = { country: profile, year: result.value.year, calendar: result.value.entries, packs: new Map() };
    const school: School = { id: 's-1', name: 'Example school', levels: ['cem'], subjects: ['arabic'], zone: '16' };
    const view = new CalendarView(ref, []);
    assert.equal(view.info(parseDay('2026-10-29'), school).schoolDay, false);
    assert.equal(view.info(parseDay('2026-11-02'), school).schoolDay, true);
    assert.equal(view.info(parseDay('2026-11-18'), school).closure?.id, 'storm');
  });

  it('drops fields outside the format', () => {
    const result = parseSchoolCalendar(withEntry({ link: 'https://example.org' }), readProfile());
    assert.ok(result.ok);
    assert.doesNotMatch(JSON.stringify(result.value), /example\.org/);
  });

  it('checks the year and its terms', () => {
    const { year } = calendarSource;
    const [first, second, third] = year.terms;
    assert.deepEqual(calendarProblems({ ...calendarSource, year: { ...year, id: '2026-2028' } }), [
      { path: 'year.id', problem: 'invalid' },
    ]);
    assert.deepEqual(
      calendarProblems({ ...calendarSource, year: { ...year, terms: [first, { ...third, number: 2 }, second] } }),
      [
        { path: 'year.terms[2].number', problem: 'invalid' },
        { path: 'year.terms[2].from', problem: 'invalid' },
      ],
    );
    assert.deepEqual(
      calendarProblems({
        ...calendarSource,
        year: { ...year, terms: [first, second, { ...third, to: '2027-07-01' }] },
      }),
      [{ path: 'year.terms[2].to', problem: 'invalid' }],
    );
    assert.deepEqual(calendarProblems({ ...calendarSource, year: { ...year, source: undefined } }), [
      { path: 'year.source', problem: 'required' },
    ]);
  });

  it('refuses what the format does not allow', () => {
    assert.deepEqual(calendarProblems({ ...calendarSource, country: 'tn' }), [
      { path: 'country', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ layer: 'teacher' })), [
      { path: 'entries[0].layer', problem: 'invalid' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ layer: 'zone' })), [
      { path: 'entries[0].zone', problem: 'required' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ schoolId: 's-1' })), [
      { path: 'entries[0].schoolId', problem: 'invalid' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ from: '2026-11-02', to: '2026-10-28' })), [
      { path: 'entries[0].to', problem: 'invalid' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ from: '2026-02-30' })), [
      { path: 'entries[0].from', problem: 'invalid' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ levels: ['lycee'], term: 4 })), [
      { path: 'entries[0].levels', problem: 'unknown-reference' },
      { path: 'entries[0].term', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ levels: ['primary'], grades: ['4am'] })), [
      { path: 'entries[0].grades', problem: 'invalid' },
    ]);
    assert.deepEqual(calendarProblems(withEntry({ source: undefined, confidence: 'certain' })), [
      { path: 'entries[0].source', problem: 'required' },
      { path: 'entries[0].confidence', problem: 'invalid' },
    ]);
    assert.deepEqual(
      calendarProblems({ ...calendarSource, entries: [...calendarSource.entries, calendarSource.entries[0]] }),
      [{ path: 'entries[3].id', problem: 'duplicate' }],
    );
  });
});
