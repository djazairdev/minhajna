// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The languages a country profile teaches in (#213, R-3.1-18): one for the
// profile and, for a subject taught in another, its own, each a language
// code. Older profiles have none. Made-up data only.

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

test('reads the language of the profile and of each subject taught in another', () => {
  const result = parseCountryProfile(source);
  assert.ok(result.ok);
  assert.equal(result.value.language, 'ar');
  assert.equal(result.value.subjects.find((subject) => subject.code === 'french')?.language, 'fr');
  assert.equal(result.value.subjects.find((subject) => subject.code === 'math')?.language, undefined);
});

test('keeps an older profile without languages, and refuses a language that is not a code', () => {
  const without = (fields: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'language'));
  const plain = { ...without(source), subjects: source.subjects.map(without) };
  const result = parseCountryProfile(plain);
  assert.ok(result.ok);
  assert.equal(result.value.language, undefined);
  assert.ok(result.value.subjects.every((subject) => subject.language === undefined));
  const [first, ...rest] = source.subjects;
  assert.deepEqual(problems({ ...source, language: 'Arabic', subjects: [{ ...first, language: 'f' }, ...rest] }), [
    { path: 'language', problem: 'invalid' },
    { path: 'subjects[0].language', problem: 'invalid' },
  ]);
});
