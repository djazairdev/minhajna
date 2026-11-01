// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Term-send's words (#591): the same keys and placeholders in Arabic, French
// and English, and each language's own plural forms for the pupils counted.

import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';

test('Term-send’s words read in every language, with each language’s plural forms', () => {
  const plural = /_(zero|one|two|few|many|other)$/u;
  const places = (value: unknown): unknown =>
    typeof value === 'string'
      ? (value.match(/\{\{\w+\}\}/gu) ?? []).sort()
      : Object.entries(value as object)
          .filter(([key]) => !plural.test(key))
          .map(([key, one]) => [key, places(one)]);
  for (const one of [en, fr]) expect(places(one.demo.termSend)).toEqual(places(ar.demo.termSend));
  const forms = (value: object, base: string) =>
    Object.keys(value)
      .filter((key) => key.startsWith(`${base}_`))
      .map((key) => key.slice(base.length + 1));
  for (const base of ['pupils', 'others']) {
    expect(forms(ar.demo.termSend, base)).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
    expect(forms(fr.demo.termSend, base)).toEqual(['one', 'many', 'other']);
    expect(forms(en.demo.termSend, base)).toEqual(['one', 'other']);
  }
});
