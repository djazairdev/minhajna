// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A calendar file can name a make-up, support or revision day (#219,
// R-4.5-08): what it adds, the working day it follows, and the closure it
// makes up for; never the sessions it takes, which are the teacher's choice.
// Made-up data only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSchoolCalendar } from '../src/index.ts';
import { country, year } from './fixtures.ts';

test('a calendar file can hold a day that adds sessions, but never the sessions it takes', () => {
  const base = {
    id: 'make-up',
    layer: 'national',
    from: '2026-11-21',
    to: '2026-11-21',
    effect: 'adds-sessions',
    name: { en: 'Make-up day' },
    source: 'Made-up notice',
    confidence: 'announced',
  };
  const read = (entry: object) =>
    parseSchoolCalendar({ format: 1, country: 'dz', release: '2026.1', year, entries: [entry] }, country);
  const problems = (entry: object) => {
    const result = read(entry);
    return result.ok ? [] : result.problems;
  };
  const fields = { adds: 'make-up', follows: 0, replaces: 'storm' };
  const result = read({ ...base, ...fields, takes: ['c-math/m1/g-all/every'] });
  assert.ok(result.ok, JSON.stringify(result));
  const [entry] = result.value.entries;
  assert.deepEqual([entry?.adds, entry?.follows, entry?.replaces, entry?.takes], ['make-up', 0, 'storm', undefined]);
  assert.deepEqual(problems(base), [
    { path: 'entries[0].adds', problem: 'required' },
    { path: 'entries[0].follows', problem: 'required' },
  ]);
  assert.deepEqual(problems({ ...base, ...fields, follows: 5 }), [{ path: 'entries[0].follows', problem: 'invalid' }]);
  assert.deepEqual(problems({ ...base, ...fields, adds: 'support' }), [
    { path: 'entries[0].replaces', problem: 'invalid' },
  ]);
  assert.deepEqual(problems({ ...base, effect: 'closure', adds: 'make-up', follows: 1 }), [
    { path: 'entries[0].adds', problem: 'invalid' },
    { path: 'entries[0].follows', problem: 'invalid' },
  ]);
});
