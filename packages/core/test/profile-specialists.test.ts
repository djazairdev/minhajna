// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The subjects a specialist teaches (#216, R-3.8-11): the levels where a
// specialist keeps their own journal, among the subject's own levels. Older
// profiles have none. Made-up data only.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCountryProfile } from '../src/index.ts';

const source = JSON.parse(readFileSync(new URL('../../../data/dz/profile.json', import.meta.url), 'utf8')) as {
  readonly subjects: readonly Record<string, unknown>[];
} & Record<string, unknown>;

const problems = (input: unknown) => {
  const result = parseCountryProfile(input);
  return result.ok ? [] : result.problems;
};

test('reads the levels where French, English and Tamazight are taught by specialists', () => {
  const result = parseCountryProfile(source);
  assert.ok(result.ok);
  const specialist = (code: string) => result.value.subjects.find((subject) => subject.code === code)?.specialist;
  assert.deepEqual(specialist('french'), ['primary']);
  assert.deepEqual(specialist('english'), ['primary']);
  assert.deepEqual(specialist('tamazight'), ['primary']);
  assert.equal(specialist('arabic'), undefined);
  assert.equal(specialist('math'), undefined);
});

test('keeps an older profile without specialists, and refuses a level the subject does not teach', () => {
  const plain = {
    ...source,
    subjects: source.subjects.map((subject) =>
      Object.fromEntries(Object.entries(subject).filter(([key]) => key !== 'specialist')),
    ),
  };
  const result = parseCountryProfile(plain);
  assert.ok(result.ok);
  assert.ok(result.value.subjects.every((subject) => subject.specialist === undefined));
  const index = source.subjects.findIndex((subject) => subject.code === 'natural-sciences');
  const changed = (specialist: unknown) => ({
    ...source,
    subjects: source.subjects.map((subject, at) => (at === index ? { ...subject, specialist } : subject)),
  });
  assert.deepEqual(problems(changed(['primary'])), [
    { path: `subjects[${index}].specialist`, problem: 'unknown-reference' },
  ]);
  assert.deepEqual(problems(changed([])), [{ path: `subjects[${index}].specialist`, problem: 'invalid' }]);
  const french = source.subjects.findIndex((subject) => subject.code === 'french');
  const badLevels = {
    ...source,
    subjects: source.subjects.map((subject, at) =>
      at === french ? { ...subject, levels: ['primary', 'nursery'] } : subject,
    ),
  };
  assert.deepEqual(problems(badLevels), [{ path: `subjects[${french}].levels`, problem: 'unknown-reference' }]);
  assert.deepEqual(problems(changed('cem')), [{ path: `subjects[${index}].specialist`, problem: 'invalid' }]);
});
