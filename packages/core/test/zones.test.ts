// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The zones a country profile lists, such as Algeria's wilayas, and the
// calendar's zone entries checked against them (#25). Made-up zones.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCountryProfile, parseSchoolCalendar, type CountryProfile } from '../src/index.ts';
import { calendar, country, year } from './fixtures.ts';

const zones = [
  { code: '16', name: { ar: 'منطقة أولى', fr: 'Première zone', en: 'First zone' } },
  { code: '31', name: { ar: 'منطقة ثانية', fr: 'Deuxième zone', en: 'Second zone' } },
];

const profileSource = (fields: object = {}): object => ({
  format: 1,
  ...(JSON.parse(JSON.stringify(country)) as object),
  ...fields,
});

function profileWith(fields: object): CountryProfile {
  const result = parseCountryProfile(profileSource(fields));
  assert.ok(result.ok, JSON.stringify(result));
  return result.value;
}

const problems = (fields: object) => {
  const result = parseCountryProfile(profileSource(fields));
  return result.ok ? [] : result.problems;
};

const calendarSource = (zone: string) => ({
  format: 1,
  country: 'dz',
  release: '2026.1',
  year,
  entries: [{ ...calendar.find((entry) => entry.layer === 'zone'), zone }],
});

describe('a profile with zones', () => {
  it('keeps them in order, with their names', () => {
    assert.deepEqual(profileWith({ zones }).zones, zones);
  });

  it('may have none, as older profiles do', () => {
    assert.equal('zones' in profileWith({}), false);
  });

  it('refuses a repeated code, a code that is not a place, a zone with no name and an empty list', () => {
    assert.deepEqual(problems({ zones: [zones[0], zones[0]] }), [{ path: 'zones[1].code', problem: 'duplicate' }]);
    assert.deepEqual(problems({ zones: [{ ...zones[0], code: 'a zone' }] }), [
      { path: 'zones[0].code', problem: 'invalid' },
    ]);
    assert.deepEqual(problems({ zones: [{ code: '16' }] }), [{ path: 'zones[0].name', problem: 'required' }]);
    assert.deepEqual(problems({ zones: [] }), [{ path: 'zones', problem: 'invalid' }]);
  });
});

describe('a zone entry in the calendar', () => {
  it('names a zone the profile lists', () => {
    const profile = profileWith({ zones });
    assert.equal(parseSchoolCalendar(calendarSource('31'), profile).ok, true);
    assert.deepEqual(parseSchoolCalendar(calendarSource('99'), profile), {
      ok: false,
      problems: [{ path: 'entries[0].zone', problem: 'unknown-reference' }],
    });
  });

  it('is not checked against a profile with no zones', () => {
    assert.equal(parseSchoolCalendar(calendarSource('99'), profileWith({})).ok, true);
  });
});
