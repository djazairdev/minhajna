// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The trial term end (#565, R-7.5-05, answer 587): the first term's last four
// weeks, from the week's first day, never before the term begins; with the
// bundled 2026-2027 calendar it runs from Sunday 22 November to Thursday 17
// December 2026, the day a demo world starts on; joining is voluntary only
// inside it, by the world's date; a teacher who joined stays joined, one who
// has not is not joined during the trial and must join after it; and a year
// with no term has no trial. The schools and teachers are made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  joiningIsVoluntary,
  parseCountryProfile,
  parseDay,
  parseSchoolCalendar,
  spaceStanding,
  trialTermEnd,
  type SchoolYear,
} from '../src/index.ts';

const data = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${name}`, import.meta.url), 'utf8'));
const profile = parseCountryProfile(data('profile.json'));
const calendar = profile.ok ? parseSchoolCalendar(data('calendar-2026-2027.json'), profile.value) : profile;
if (!profile.ok || !calendar.ok) throw new Error('The bundled data does not read');
const year = calendar.value.year;
const weekStartsOn = profile.value.weekStartsOn;
const trial = trialTermEnd(year, weekStartsOn);

describe('the trial term end', () => {
  it('is the first term’s last four weeks, which a demo world starts in', () => {
    assert.deepEqual(trial, { from: '2026-11-22', to: '2026-12-17', term: 1, year: '2026-2027' });
    assert.equal(trial?.to, year.terms[0]?.to);
  });

  it('never starts before its term does', () => {
    const short: SchoolYear = {
      ...year,
      terms: [{ number: 1, from: parseDay('2026-12-06'), to: parseDay('2026-12-17') }],
    };
    assert.equal(trialTermEnd(short, weekStartsOn)?.from, '2026-12-06');
  });

  it('makes joining voluntary only inside it, by the world’s date', () => {
    const on = (day: string) => joiningIsVoluntary(trial, parseDay(day));
    assert.deepEqual(['2026-11-21', '2026-11-22', '2026-12-17', '2026-12-18', '2027-03-18'].map(on), [
      false,
      true,
      true,
      false,
      false,
    ]);
    assert.equal(joiningIsVoluntary(null, parseDay('2026-12-17')), false);
  });

  it('keeps a joined teacher joined, and marks one who has not by the date', () => {
    const during = parseDay('2026-12-17');
    const after = parseDay('2027-03-18');
    assert.deepEqual([spaceStanding(trial, during, true), spaceStanding(trial, after, true)], ['joined', 'joined']);
    assert.equal(spaceStanding(trial, during, false), 'not-joined');
    assert.equal(spaceStanding(trial, after, false), 'to-join');
    assert.equal(spaceStanding(null, during, false), 'to-join');
  });

  it('is none for a year with no term', () => {
    assert.equal(trialTermEnd({ ...year, terms: [] }, weekStartsOn), null);
  });
});
