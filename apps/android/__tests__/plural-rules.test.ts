// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Node carries the full ICU, so its Intl.PluralRules is the reference that the
// app's own rules for Hermes must match.

import { installPluralRules, PluralRules } from '../src/text/plural-rules';

const LANGUAGES = ['ar', 'fr', 'en'] as const;

/** Every count up to 10,000, both signs, and decimals that land on each rounding edge. */
function values(): number[] {
  const all: number[] = [];
  for (let n = 0; n <= 10_000; n++) all.push(n, -n);
  let seed = 7;
  for (let k = 0; k < 5_000; k++) {
    seed = (seed * 48_271) % 2_147_483_647;
    all.push((seed % 2_000_000) / 10_000);
  }
  return all
    .concat([0.1, 0.5, 1.5, 2.25, 3.5, 10.1, 11.5, 99.99, 100.5, 1e6, 2e6, 1.5e6, 1e9, 1e-7, 0.0004])
    .concat([0.0005, 1.0005, 2.0001, 2.9999, 10.9999, 99.9996, 102.0004, 1_000_000.0001]);
}

test.each(LANGUAGES)('selects the same plural form as ICU for every count (%s)', (language) => {
  const ours = new PluralRules(language);
  const icu = new Intl.PluralRules(language);
  const differences = values().filter((value) => ours.select(value) !== icu.select(value));
  expect(differences).toEqual([]);
  expect([...ours.resolvedOptions().pluralCategories].sort()).toEqual(
    [...icu.resolvedOptions().pluralCategories].sort(),
  );
});

test('gives Arabic all six forms', () => {
  const rules = new PluralRules('ar-DZ');
  expect([0, 1, 2, 3, 11, 100].map((count) => rules.select(count))).toEqual([
    'zero',
    'one',
    'two',
    'few',
    'many',
    'other',
  ]);
  expect(rules.resolvedOptions().locale).toBe('ar');
});

test('gives "other" for a value that is not a finite number', () => {
  for (const language of LANGUAGES) {
    const rules = new PluralRules(language);
    expect([Number.NaN, Infinity, -Infinity].map((value) => rules.select(value))).toEqual(['other', 'other', 'other']);
  }
});

test('refuses a language it has no rule for, and ordinal rules', () => {
  expect(() => new PluralRules('de')).toThrow(RangeError);
  expect(() => new PluralRules([])).toThrow(RangeError);
  expect(() => new PluralRules('ar', { type: 'ordinal' })).toThrow(RangeError);
  expect(new PluralRules(['de', 'fr']).resolvedOptions().locale).toBe('fr');
});

test('fills Intl.PluralRules only where the engine has none', () => {
  const hermes: { PluralRules?: unknown } = {};
  installPluralRules(hermes);
  expect(hermes.PluralRules).toBe(PluralRules);

  const full = { PluralRules: Intl.PluralRules };
  installPluralRules(full);
  expect(full.PluralRules).toBe(Intl.PluralRules);
});
