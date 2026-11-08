// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's own catalogue (answers 821 and 855): the same keys in
// Arabic, French and English, each with the same placeholders, none empty,
// and read under `dashboard` beside the teacher app's words.

import { i18n } from '../../android/src/text/i18n';
import { dashboardCatalogues } from '../src/catalogues';
import type { DashboardText } from '../src/text';
import '../src/text';

/** Every entry of a catalogue, with its nested keys joined by dots. */
function entries(catalogue: object, prefix = ''): [string, string][] {
  return Object.entries(catalogue).flatMap(([key, value]): [string, string][] =>
    typeof value === 'string' ? [[prefix + key, value]] : entries(value as object, `${prefix}${key}.`),
  );
}

const placeholders = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/gu)].map((match) => match[1]).sort();

test('holds the same keys and placeholders in each language, none empty', () => {
  const arabic = new Map(entries(dashboardCatalogues.ar));
  for (const value of arabic.values()) expect(value.trim()).not.toBe('');
  for (const language of ['fr', 'en'] as const) {
    const other = new Map(entries(dashboardCatalogues[language]));
    expect([...other.keys()].sort()).toEqual([...arabic.keys()].sort());
    for (const [key, value] of other) {
      expect(value.trim()).not.toBe('');
      expect(placeholders(value)).toEqual(placeholders(arabic.get(key) ?? ''));
    }
  }
});

test('is read under the dashboard key, and leaves the teacher app’s words', () => {
  for (const language of ['ar', 'fr', 'en'] as const) {
    const t = i18n.getFixedT(language) as unknown as DashboardText;
    expect(t('dashboard.name')).toBe(dashboardCatalogues[language].name);
    expect(i18n.exists('welcome.start', { lng: language })).toBe(true);
  }
});
