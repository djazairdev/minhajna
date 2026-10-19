// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads the Hijri month table from parsed JSON. It comes in as a file, so it
// is untrusted: every field is checked, and only the format's fields are
// kept (PRD §5.9). The months follow one another without a gap, each 29 or
// 30 days long, and the twelve names are given in Arabic, French and
// English.

import { addDays, compareDays } from './day.ts';
import type { HijriMonth, HijriTable } from './hijri.ts';
import { isFields, Reader, RELEASE, type ParseResult } from './read.ts';
import type { MonthNames } from './reference.ts';

const LANGUAGES = ['ar', 'fr', 'en'] as const;

function readNames(reader: Reader, raw: unknown, path: string): MonthNames | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const [ar, fr, en] = LANGUAGES.map((language) => reader.requiredText(raw, language, path));
  return ar && fr && en ? { ar, fr, en } : undefined;
}

function readMonth(reader: Reader, raw: unknown, path: string): HijriMonth | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const year = reader.requiredNumber(raw, 'year', path, true);
  const month = reader.requiredNumber(raw, 'month', path, true);
  const start = reader.day(raw, 'start', path);
  if (year === undefined || month === undefined || start === undefined) return undefined;
  if (year < 1 || month < 1 || month > 12) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  return { year, month, start };
}

/** Whether `next` is the month after `month`, starting 29 or 30 days after it. */
function follows(month: HijriMonth, next: HijriMonth): boolean {
  const order =
    month.month === 12
      ? next.year === month.year + 1 && next.month === 1
      : next.year === month.year && next.month === month.month + 1;
  const length = (days: number) => compareDays(addDays(month.start, days), next.start) === 0;
  return order && (length(29) || length(30));
}

/** Reads the Hijri month table, keeping only the format's fields. */
export function parseHijriTable(input: unknown): ParseResult<HijriTable> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const names = reader.list(input, 'names', '', (raw, path) => readNames(reader, raw, path), { nonEmpty: true });
  if (Array.isArray(input['names']) && input['names'].length !== 12) reader.fail('names', 'invalid');
  const read = reader.list(
    input,
    'months',
    '',
    (raw, path) => {
      const month = readMonth(reader, raw, path);
      return month === undefined ? undefined : { month, path };
    },
    { nonEmpty: true },
  );
  read.forEach(({ month }, index) => {
    const next = read[index + 1];
    if (next !== undefined && !follows(month, next.month)) reader.fail(next.path, 'invalid');
  });
  if (reader.problems.length > 0) return { ok: false, problems: reader.problems };
  return { ok: true, value: { release, names, months: read.map(({ month }) => month) } };
}
