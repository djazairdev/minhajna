// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bell times (#29): templates by level and shift, the times a teacher sets
// to match the school's bell, and Ramadan's, taken from the calendar, that
// keep each session's start and place. Made-up schools and times.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bellTimes,
  hoursOn,
  nextRamadan,
  parseBellData,
  parseSchoolCalendar,
  ramadanOn,
  templateFor,
  withSlotTime,
  type BellData,
  type CalendarEntry,
  type School,
  type Slot,
} from '../src/index.ts';
import { calendar, country, d, year } from './fixtures.ts';

const hour = (from: number) => [`${String(from).padStart(2, '0')}:00`, `${String(from + 1).padStart(2, '0')}:00`];

const source = (fields: object = {}): Record<string, unknown> => ({
  format: 1,
  country: 'dz',
  release: '2026.1',
  templates: [
    {
      level: 'cem',
      shift: 'single',
      morning: [8, 9, 10, 11].map(hour),
      afternoon: [13, 14].map(hour),
      source: 'Made up',
    },
    { level: 'primary', shift: 'double', morning: [hour(8)], afternoon: [hour(13)], source: 'Made up' },
  ],
  ramadan: [{ level: 'cem', minutes: 45, source: 'Made up', confidence: 'projected' }],
  ...fields,
});

function data(fields: object = {}): BellData {
  const result = parseBellData(source(fields), country);
  assert.ok(result.ok, JSON.stringify(result));
  return result.value;
}

const problems = (fields: object) => {
  const result = parseBellData(source(fields), country);
  return result.ok ? [] : result.problems;
};

const school: School = { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['math'] };
const m1: Slot = { half: 'morning', index: 1 };
const m2: Slot = { half: 'morning', index: 2 };
const m5: Slot = { half: 'morning', index: 5 };
const times = (bells: BellData, at: School, hours: 'usual' | 'ramadan', slots: Slot[], level = 'cem') =>
  bellTimes(bells, at, level, 'single', hours, slots).map((time) => time && [time.from, time.to, time.by]);

const ramadan: CalendarEntry = {
  id: 'ramadan',
  layer: 'national',
  from: d('2027-02-08'),
  to: d('2027-03-08'),
  effect: 'marker',
  times: 'ramadan',
  name: { en: 'Ramadan' },
  source: 'Made up',
  confidence: 'expected',
};

describe('bell data', () => {
  it('reads templates and Ramadan lengths, keeping only the format’s fields', () => {
    const bells = data({ extra: true });
    assert.deepEqual(bells.templates[0]?.morning[0], { from: '08:00', to: '09:00' });
    assert.deepEqual(bells.ramadan, [{ level: 'cem', minutes: 45, source: 'Made up', confidence: 'projected' }]);
    assert.equal('extra' in bells, false);
  });

  it('refuses an unknown level, a repeated template, a slot that ends before it starts or overlaps the one before', () => {
    const template = { level: 'cem', shift: 'single', morning: [hour(8)], afternoon: [hour(13)], source: 'Made up' };
    assert.deepEqual(problems({ templates: [{ ...template, level: 'college' }] }), [
      { path: 'templates[0].level', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(problems({ templates: [template, template] }), [{ path: 'templates[1]', problem: 'duplicate' }]);
    assert.deepEqual(problems({ templates: [{ ...template, morning: [['09:00', '08:00']] }] }), [
      { path: 'templates[0].morning[0]', problem: 'invalid' },
    ]);
    assert.deepEqual(problems({ templates: [{ ...template, morning: [hour(8), ['08:30', '09:30']] }] }), [
      { path: 'templates[0].morning[1]', problem: 'invalid' },
    ]);
    assert.deepEqual(problems({ templates: [{ ...template, morning: [['8:00', '09:00']] }] }), [
      { path: 'templates[0].morning[0]', problem: 'invalid' },
    ]);
  });

  it('refuses another country, a missing format and a Ramadan length with no confidence', () => {
    assert.deepEqual(problems({ country: 'ma' }), [{ path: 'country', problem: 'unknown-reference' }]);
    assert.deepEqual(problems({ format: undefined }), [{ path: 'format', problem: 'required' }]);
    assert.deepEqual(problems({ ramadan: [{ level: 'cem', minutes: 45, source: 'Made up' }] }), [
      { path: 'ramadan[0].confidence', problem: 'required' },
    ]);
  });
});

describe('the times of a slot', () => {
  it("takes the level's template, for its shift or else its single shift", () => {
    const bells = data();
    assert.equal(templateFor(bells, 'primary', 'double')?.shift, 'double');
    assert.equal(templateFor(bells, 'cem', 'double')?.shift, 'single');
    assert.equal(templateFor(bells, 'lycee', 'single'), null);
    assert.deepEqual(times(bells, school, 'usual', [m1, m5]), [['08:00', '09:00', 'template'], null]);
  });

  it("keeps the time the teacher set to match the school's bell, and the template's again once cleared", () => {
    const bells = data();
    const set = withSlotTime(school, 'usual', m1, { from: '08:15', to: '09:10' });
    assert.deepEqual(set.bells, { usual: [{ half: 'morning', index: 1, from: '08:15', to: '09:10' }] });
    assert.deepEqual(times(bells, set, 'usual', [m1, m2]), [
      ['08:15', '09:10', 'school'],
      ['09:00', '10:00', 'template'],
    ]);
    assert.deepEqual(withSlotTime(set, 'usual', m1, null), school);
  });

  it("keeps each session's start in Ramadan and shortens it to the level's length, unless the school's time is set", () => {
    const bells = data();
    const set = withSlotTime(withSlotTime(school, 'usual', m1, { from: '08:15', to: '09:10' }), 'ramadan', m2, {
      from: '09:30',
      to: '10:15',
    });
    assert.deepEqual(times(bells, set, 'ramadan', [m1, m2]), [
      ['08:15', '09:00', 'ramadan-rule'],
      ['09:30', '10:15', 'school'],
    ]);
    assert.deepEqual(times(bells, school, 'ramadan', [m1], 'primary'), [null]);
  });

  it("takes Ramadan's days from the calendar, and finds the next one to come", () => {
    const entries = [...calendar, ramadan];
    assert.equal(ramadanOn(entries, d('2027-02-10')), ramadan);
    assert.equal(hoursOn(entries, d('2027-02-10')), 'ramadan');
    assert.equal(hoursOn(entries, d('2027-03-09')), 'usual');
    assert.equal(nextRamadan(entries, d('2026-10-04')), ramadan);
    assert.equal(nextRamadan(entries, d('2027-03-09')), null);
  });
});

describe('a calendar entry with times', () => {
  const read = (entry: object) =>
    parseSchoolCalendar({ format: 1, country: 'dz', release: '2026.1', year, entries: [entry] }, country);

  it("reads Ramadan's times, and refuses others", () => {
    const result = read(ramadan);
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.value.entries[0]?.times, 'ramadan');
    const wrong = read({ ...ramadan, times: 'summer' });
    assert.deepEqual(wrong.ok ? [] : wrong.problems, [{ path: 'entries[0].times', problem: 'invalid' }]);
  });
});
