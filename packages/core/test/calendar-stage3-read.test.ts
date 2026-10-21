// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseSchoolCalendar } from '../src/index.ts';
import { country, year } from './fixtures.ts';

const entry = {
  id: 'made-up',
  layer: 'national',
  effect: 'no-school',
  from: '2026-10-14',
  to: '2026-10-15',
  name: { en: 'Made-up holiday' },
  source: 'Made-up estimate',
  confidence: 'expected',
};
const file = (fields: object) => ({
  format: 1,
  country: 'dz',
  release: '2026.1',
  year,
  entries: [{ ...entry, ...fields }],
});

test('format 1 can carry safe lunar eligibility metadata, but never local partial-day or confirmation semantics', () => {
  const read = parseSchoolCalendar(file({ lunar: true }), country);
  assert.ok(read.ok);
  assert.equal(read.value.entries[0]?.lunar, true);
  for (const fields of [
    { lunar: false },
    { lunar: 'yes' },
    { lunar: true, effect: 'exam' },
    { half: 'morning' },
    { confirmedFrom: 'untrusted' },
    { council: { classId: 'c-1', term: 1, at: '14:00' } },
  ]) {
    assert.equal(parseSchoolCalendar(file(fields), country).ok, false);
  }
  assert.equal(parseSchoolCalendar(file({}), country).ok, true);
});

test('the prepared calendar release marks only Ramadan and the four expected lunar holidays; no date is confirmed', () => {
  const raw: unknown = JSON.parse(
    readFileSync(new URL('../../../data/dz/calendar-2026-2027.json', import.meta.url), 'utf8'),
  );
  const read = parseSchoolCalendar(raw, country);
  assert.ok(read.ok);
  assert.equal(read.value.release, '2026.4');
  assert.deepEqual(
    read.value.entries.filter((one) => one.lunar).map((one) => one.id),
    ['ramadan', 'eid-al-fitr', 'eid-al-adha', 'awal-muharram', 'ashura'],
  );
  assert.ok(read.value.entries.filter((one) => one.lunar).every((one) => one.confidence === 'expected'));
  assert.ok(read.value.entries.every((one) => one.confirmedFrom === undefined && one.half === undefined));
});
