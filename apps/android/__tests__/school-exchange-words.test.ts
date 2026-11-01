// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Exchange's words (#592): the same keys and placeholders in Arabic, French
// and English, each language's own plural forms for the teachers and the
// lines counted, and My log's lines for the absences choice in every
// language.

import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

test('D-Exchange’s words read in every language, with each language’s plural forms', () => {
  const plural = /_(zero|one|two|few|many|other)$/u;
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object)
          .filter(([key]) => !plural.test(key))
          .map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.demo.exchange)).toEqual(places(ar.demo.exchange));
  for (const counted of ['teachers_', 'count_']) {
    const forms = (value: object) =>
      Object.keys(value)
        .filter((key) => key.startsWith(counted))
        .map((key) => key.slice(counted.length));
    expect(forms(ar.demo.exchange)).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    expect(forms(fr.demo.exchange)).toEqual(['one', 'many', 'other']);
    expect(forms(en.demo.exchange)).toEqual(['one', 'other']);
  }
  for (const one of [ar, fr, en]) {
    expect([typeof one.demo.ownLog.line.absencesOn, typeof one.demo.ownLog.line.absencesOff]).toEqual([
      'string',
      'string',
    ]);
  }
});
