// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The profile is synthetic. Only the frozen month spellings are shared with
// formatting regressions; malformed inputs never contain pupil data.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCountryProfile, type ParseProblem } from '../src/index.ts';
import { country } from './fixtures.ts';
import { monthNames } from './month-fixtures.ts';

const source = { format: 1, ...country };

function problems(months: unknown): readonly ParseProblem[] {
  const result = parseCountryProfile({ ...source, months });
  return result.ok ? [] : result.problems;
}

describe('country-profile month names', () => {
  it('reads twelve months with Arabic, French and English names', () => {
    const result = parseCountryProfile({ ...source, months: monthNames });
    assert.ok(result.ok);
    assert.deepEqual(result.value.months, monthNames);
  });

  it('still opens an older format-1 profile without adding guessed month names', () => {
    const result = parseCountryProfile(source);
    assert.ok(result.ok);
    assert.deepEqual(result.value, country);
    assert.equal(Object.hasOwn(result.value, 'months'), false);
  });

  it('requires exactly twelve months when the field is present', () => {
    for (const invalid of [null, {}, 'months', 12, [], monthNames.slice(1), [...monthNames, monthNames[0]]]) {
      assert.deepEqual(problems(invalid), [{ path: 'months', problem: 'invalid' }]);
    }
  });

  it('refuses non-object entries, including holes in a twelve-item array', () => {
    for (const invalid of [null, 'January', 1, [], undefined]) {
      assert.deepEqual(problems([invalid, ...monthNames.slice(1)]), [{ path: 'months[0]', problem: 'invalid' }]);
    }
    const sparse: unknown[] = [];
    for (let index = 1; index < monthNames.length; index++) sparse[index] = monthNames[index];
    assert.deepEqual(problems(sparse), [{ path: 'months[0]', problem: 'invalid' }]);
  });

  it('requires all three languages for every month', () => {
    for (const language of ['ar', 'fr', 'en'] as const) {
      for (let index = 0; index < monthNames.length; index++) {
        const missing = monthNames.map((month, position) =>
          position === index ? { ...month, [language]: undefined } : month,
        );
        assert.deepEqual(problems(missing), [{ path: `months[${index}].${language}`, problem: 'required' }]);
      }
    }
  });

  it('refuses empty, whitespace-only and non-text translations', () => {
    for (const language of ['ar', 'fr', 'en'] as const) {
      for (const invalid of ['', ' \t\n ', null, 1, {}, []]) {
        const months = [{ ...monthNames[0], [language]: invalid }, ...monthNames.slice(1)];
        assert.deepEqual(problems(months), [{ path: `months[0].${language}`, problem: 'invalid' }]);
      }
    }
  });

  it('drops unknown month fields and copies accepted names', () => {
    const months = monthNames.map((month) => ({
      ...month,
      ar: String(month.ar),
      script: 'not executed',
      extra: { value: 'ignored' },
    }));
    const result = parseCountryProfile({ ...source, months });
    assert.ok(result.ok);
    assert.deepEqual(result.value.months, monthNames);
    const first = months[0];
    assert.ok(first !== undefined);
    first.ar = 'changed after parsing';
    assert.deepEqual(result.value.months, monthNames);
  });

  it('reports problems across months and other profile fields together', () => {
    const months = monthNames.map((month, index) => ({
      ...month,
      ...(index === 0 ? { ar: undefined } : {}),
      ...(index === 1 ? { fr: ' ' } : {}),
      ...(index === 11 ? { en: 12 } : {}),
    }));
    const result = parseCountryProfile({ ...source, code: 'invalid', months });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.problems, [
      { path: 'code', problem: 'invalid' },
      { path: 'months[0].ar', problem: 'required' },
      { path: 'months[1].fr', problem: 'invalid' },
      { path: 'months[11].en', problem: 'invalid' },
    ]);
  });
});
