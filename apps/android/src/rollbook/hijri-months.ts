// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Hijri months a Gregorian month spans, for the roll-call book's head
// (answer 253), from the Umm al-Qura table bundled from the repository's data
// folder. The table goes through the core's reader once; a refused table, or
// a month beyond it, names no Hijri month.

import { hijriLabel, monthRange, parseHijriTable, type HijriTable } from '@minhajna/core';
import table from '@minhajna/data/hijri-umalqura.json';

let read: HijriTable | null | undefined;

function hijriTable(): HijriTable | null {
  if (read === undefined) {
    const result = parseHijriTable(table);
    read = result.ok ? result.value : null;
  }
  return read;
}

/** The Hijri months `month`, written YYYY-MM, spans, in `language`, or null. */
export function hijriOf(month: string, language: 'ar' | 'fr' | 'en'): string | null {
  const known = hijriTable();
  if (known === null) return null;
  const { from, to } = monthRange(month);
  return hijriLabel(known, from, to, language);
}
