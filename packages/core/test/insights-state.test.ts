// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the opt-in insights stand in a demo world (#624, answer 695): a
// teachers' world offers them on any date; a national world stops the classes
// of each school space it joined, from the earliest day a key for that space
// and assignment was certified, and passes over a code that does not read;
// once the world's date reaches the first announced day after the first
// term's end, the second term's end or, with an exam window, the mock exam's
// figures day, and not a day before, they are retired, on the earliest such
// day of the bundled and the published calendars; a year with no term, or no
// calendar, has no totals day. Every world, school, code and day is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  firstTotalsDay,
  insightsState,
  joinCodeText,
  totalsFrom,
  type CalendarEntry,
  type Certificate,
  type Day,
  type SchoolJoined,
  type SchoolYear,
} from '../src/index.ts';
import { d } from './fixtures.ts';

const year: SchoolYear = {
  id: '2026-2027',
  from: d('2026-09-20'),
  to: d('2027-07-08'),
  terms: [
    { number: 1, from: d('2026-09-20'), to: d('2026-12-17') },
    { number: 2, from: d('2027-01-03'), to: d('2027-03-18') },
    { number: 3, from: d('2027-04-04'), to: d('2027-07-08') },
  ],
  source: 'made up',
};
const entries: CalendarEntry[] = [
  {
    id: 'made-up-exams',
    layer: 'national',
    from: d('2027-03-07'),
    to: d('2027-03-11'),
    effect: 'exam',
    term: 2,
    grades: ['4am'],
    name: { ar: 'اختبارات', en: 'Exams', fr: 'Examens' },
    source: 'made up',
    confidence: 'announced',
  },
];

const SCHOOL = 'made-up-school-space-1';
const OTHER = 'made-up-school-space-2';
const ASSIGNMENT = '0123456789abcdef0123456789abcdef';

function join(school: string, issued: string, issue = 1, assignment = ASSIGNMENT): SchoolJoined {
  const code = joinCodeText({ world: 'K7QF4', school, epoch: 1, assignment, issue, key: 'ab'.repeat(32) });
  const certificate = { issued: d(issued) } as Certificate;
  return { code, device: 'made-up-device', pkcs8: 'TWFkZS11cA==', certificate };
}

const state = (date: Day, joins: SchoolJoined[] = [], kind: 'national' | 'teachers' = 'national') =>
  insightsState(kind, date, joins, [{ year, entries }]);

describe('where the insights stand in a world', () => {
  it('offers them in a teachers’ world, whatever its date', () => {
    assert.deepEqual(state(d('2026-12-17'), [], 'teachers'), { kind: 'teacher' });
    assert.deepEqual(state(d('2027-06-01'), [join(SCHOOL, '2026-12-17')], 'teachers'), { kind: 'teacher' });
  });

  it('stops the classes of each space joined in a national world, from the earliest day', () => {
    assert.deepEqual(state(d('2026-12-17')), { kind: 'school', joins: [] });
    const joins = [
      join(SCHOOL, '2026-12-17', 2),
      join(OTHER, '2026-12-16'),
      join(SCHOOL, '2026-12-15'),
      join(SCHOOL, '2026-12-17', 1, 'fedcba9876543210fedcba9876543210'),
      { ...join(SCHOOL, '2026-12-01'), code: 'not a joining code' },
    ];
    assert.deepEqual(state(d('2026-12-17'), joins), {
      kind: 'school',
      joins: [
        { school: SCHOOL, assignment: ASSIGNMENT, since: d('2026-12-15') },
        { school: OTHER, assignment: ASSIGNMENT, since: d('2026-12-16') },
        { school: SCHOOL, assignment: 'fedcba9876543210fedcba9876543210', since: d('2026-12-17') },
      ],
    });
  });

  it('retires them once the world’s date reaches the first totals day, and not before', () => {
    assert.equal(totalsFrom(year, []), d('2027-03-18'));
    assert.equal(totalsFrom(year, entries), d('2027-02-25'));
    const joins = [join(SCHOOL, '2026-12-17')];
    assert.equal(state(d('2027-02-24'), joins).kind, 'school');
    assert.deepEqual(state(d('2027-02-25'), joins), { kind: 'retired', since: d('2027-02-25') });
    assert.deepEqual(state(d('2027-05-02'), joins), { kind: 'retired', since: d('2027-02-25') });
  });

  it('retires them on the earliest first totals day of the bundled and the published calendars', () => {
    const calendars = [
      { year, entries: [] },
      { year, entries },
    ];
    assert.equal(firstTotalsDay(calendars), d('2027-02-25'));
    assert.equal(firstTotalsDay([...calendars].reverse()), d('2027-02-25'));
    assert.deepEqual(insightsState('national', d('2027-02-25'), [], calendars), {
      kind: 'retired',
      since: d('2027-02-25'),
    });
    assert.equal(insightsState('national', d('2027-02-24'), [], calendars).kind, 'school');
  });

  it('forms no totals in a year with no term', () => {
    const none = { ...year, terms: [] };
    assert.equal(totalsFrom(none, entries), null);
    assert.deepEqual(insightsState('national', d('2027-05-02'), [], [{ year: none, entries }]), {
      kind: 'school',
      joins: [],
    });
    assert.equal(firstTotalsDay([]), null);
  });
});
