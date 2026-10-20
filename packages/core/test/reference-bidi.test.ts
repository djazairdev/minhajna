// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reference data refuses bidi controls and line separators in its texts
// (#314): isolating a name on screen cannot hold against one that closes
// the isolate itself. Made up for tests.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCountryProfile } from '../src/index.ts';

const level = { code: 'cem', rollCallUnit: 'session', sessionMinutes: 60, name: { en: 'Middle school' } };
const source = {
  format: 1,
  code: 'dz',
  release: '2026.1',
  weekStartsOn: 0,
  workingDays: [0, 1, 2, 3, 4],
  levels: [{ ...level, grades: [{ code: '1am', name: { en: 'Year 1' } }] }],
  subjects: [{ code: 'math', name: { en: 'Mathematics' }, levels: ['cem'] }],
  sessionTypes: [{ code: 'lesson', queue: 'main', name: { en: 'Lesson' } }],
};

function problems(value: unknown): unknown {
  const result = parseCountryProfile(value);
  return result.ok ? [] : result.problems;
}

describe('reference texts', () => {
  it('reads the profile as made', () => {
    assert.deepEqual(problems(source), []);
  });

  it('refuses a bidi control in a name or a release', () => {
    assert.deepEqual(
      problems({
        ...source,
        release: '2026.1⁦',
        subjects: [{ ...source.subjects[0], name: { en: 'Mathe⁧matics', fr: 'Maths ' } }],
      }),
      [
        { path: 'release', problem: 'invalid' },
        { path: 'subjects[0].name', problem: 'invalid' },
      ],
    );
  });
});
