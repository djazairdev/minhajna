// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a country's assessment presets and formulas (#238, answers 430,
// 437 and 438): a file refused field by field, presets and formulas
// clashing at a level told by their place in the file, a level's scales
// disagreeing, another level's formula, and only the format's fields kept.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseAssessmentData, parseCountryProfile } from '../src/index.ts';

function readData(path: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../data/${path}`, import.meta.url), 'utf8'));
}

const read = parseCountryProfile(readData('dz/profile.json'));
assert.ok(read.ok);
const profile = read.value;

test('a preset file is refused field by field, and only the format’s fields are kept', () => {
  const file = readData('dz/assessment.json') as { presets: Record<string, unknown>[] };
  const [languages, arts, cem, lycee] = file.presets as [
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
  ];
  const components = cem['components'] as Record<string, unknown>[];
  const problems = (fields: Record<string, unknown>) => {
    const result = parseAssessmentData({ ...file, ...fields }, profile);
    return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
  };
  const changed = (fields: Record<string, unknown>) => problems({ presets: [{ ...cem, ...fields }] });
  assert.deepEqual(changed({ components: [{ ...components[0], points: 7 }, ...components.slice(1)] }), [
    'presets[0].components[0].points invalid',
    'presets[0].components invalid',
  ]);
  assert.deepEqual(changed({ scale: 15 }), ['presets[0].scale invalid', 'presets[0].components invalid']);
  assert.deepEqual(changed({ level: 'college' }), ['presets[0].level unknown-reference']);
  assert.deepEqual(problems({ presets: [cem, cem] }), ['presets[1] duplicate']);
  assert.deepEqual(problems({ presets: [languages, { ...arts, subjects: ['music', 'math'] }] }), [
    'presets[1] duplicate',
  ]);
  assert.deepEqual(problems({ presets: [{ ...cem, scale: 'x' }, lycee, lycee] }).at(-1), 'presets[2] duplicate');
  assert.deepEqual(problems({ presets: [languages, { ...lycee, level: 'primary' }] }), ['presets[1].scale invalid']);
  assert.deepEqual(changed({ subjects: ['science-technology'] }), ['presets[0].subjects unknown-reference']);
  const twice = components.map((one) => (one['id'] === 'research' ? { ...one, capture: 'roll-call' } : one));
  assert.deepEqual(changed({ components: twice }), ['presets[0].components duplicate']);
  const formula = (fields: Record<string, unknown>) => ({ level: 'cem', id: 'cem', weights: { E: 1 }, ...fields });
  assert.deepEqual(problems({ formulas: [formula({ weights: { T: 1, X: 2 } })] }), ['formulas[0].weights invalid']);
  assert.deepEqual(problems({ formulas: [formula({}), formula({ weights: { T: 1 } })] }), ['formulas[1] duplicate']);
  const examined = formula({ level: 'primary', id: 'primary-examined', subjects: ['arabic'] });
  assert.deepEqual(problems({ formulas: [examined, { ...examined, subjects: ['math'] }] }), ['formulas[1] duplicate']);
  assert.deepEqual(problems({ formulas: [formula({ subjects: ['science-technology'] })] }), [
    'formulas[0].subjects unknown-reference',
  ]);
  assert.deepEqual(problems({ formulas: [formula({ level: 'primary' })] }), ['formulas[0].id invalid']);
  assert.deepEqual(problems({ formulas: [formula({ level: 'college' })] }), ['formulas[0].level unknown-reference']);
  const hidden = String.fromCodePoint(0x202e);
  const named = { ...components[0], name: { ar: `المشاركة${hidden}` } };
  assert.deepEqual(changed({ components: [named, ...components.slice(1)] }), [
    'presets[0].components[0].name invalid',
    'presets[0].components invalid',
  ]);
  const extra = parseAssessmentData(
    { ...file, presets: [{ ...cem, note: 'x' }], formulas: [formula({ note: 'x' })], extra: 1 },
    profile,
  );
  assert.ok(extra.ok);
  assert.deepEqual(Object.keys(extra.value), ['country', 'release', 'presets', 'formulas']);
  assert.equal('note' in extra.value.presets[0]!, false);
  assert.equal('note' in extra.value.formulas[0]!, false);
});
