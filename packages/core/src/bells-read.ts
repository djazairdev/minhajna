// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a country's bell times from parsed JSON, against its profile. It
// comes in as a file, so it is untrusted: every field is checked, and only
// the format's fields are kept (PRD §5.9). In each half-day, a slot ends
// after it starts, and the next starts no earlier than it ends.

import {
  CLOCK,
  SHIFTS,
  clockMinutes,
  type BellData,
  type BellTemplate,
  type ClockSpan,
  type RamadanLength,
} from './bells.ts';
import { at, isFields, Reader, RELEASE, type Fields, type ParseResult } from './read.ts';
import { CONFIDENCES, type CountryProfile } from './reference.ts';
import { COUNTRY, levelCodes } from './reference-fields.ts';

/** The slots of one half-day, each as `["08:00", "09:00"]`. */
function readSpans(reader: Reader, raw: Fields, key: string, path: string): ClockSpan[] {
  const spans = reader.list(
    raw,
    key,
    path,
    (item, itemPath) => {
      const [from, to] = Array.isArray(item) ? (item as unknown[]) : [];
      const valid =
        Array.isArray(item) &&
        item.length === 2 &&
        typeof from === 'string' &&
        typeof to === 'string' &&
        CLOCK.test(from) &&
        CLOCK.test(to) &&
        clockMinutes(from) < clockMinutes(to);
      if (!valid) {
        reader.fail(itemPath, 'invalid');
        return undefined;
      }
      return { from, to };
    },
    { nonEmpty: true },
  );
  spans.forEach((span, index) => {
    const previous = spans[index - 1];
    if (previous !== undefined && clockMinutes(span.from) < clockMinutes(previous.to)) {
      reader.fail(`${at(path, key)}[${index}]`, 'invalid');
    }
  });
  return spans;
}

/** A level is known to the profile, and named once in its list. */
function readLevel(reader: Reader, raw: Fields, path: string, profile: CountryProfile) {
  const level = reader.requiredText(raw, 'level', path);
  if (level !== '' && !levelCodes(profile).includes(level)) reader.fail(at(path, 'level'), 'unknown-reference');
  return level;
}

/** Reads a country's bell times, keeping only the format's fields. Each level and shift has one template at most. */
export function parseBellData(input: unknown, profile: CountryProfile): ParseResult<BellData> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');
  const country = reader.requiredText(input, 'country', '', COUNTRY);
  if (country !== '' && country !== profile.code) reader.fail('country', 'unknown-reference');
  const release = reader.requiredText(input, 'release', '', RELEASE);

  const seen = new Set<string>();
  const templates = reader.list(
    input,
    'templates',
    '',
    (raw, path): BellTemplate | undefined => {
      if (!isFields(raw)) {
        reader.fail(path, 'invalid');
        return undefined;
      }
      const level = readLevel(reader, raw, path, profile);
      const shift = reader.oneOf(raw, 'shift', path, SHIFTS);
      if (seen.has(`${level}/${shift}`)) reader.fail(path, 'duplicate');
      seen.add(`${level}/${shift}`);
      const morning = readSpans(reader, raw, 'morning', path);
      const afternoon = readSpans(reader, raw, 'afternoon', path);
      const source = reader.requiredText(raw, 'source', path);
      return shift === undefined ? undefined : { level, shift, morning, afternoon, source };
    },
    { nonEmpty: false },
  );

  const lengths = new Set<string>();
  const ramadan = reader.list(
    input,
    'ramadan',
    '',
    (raw, path): RamadanLength | undefined => {
      if (!isFields(raw)) {
        reader.fail(path, 'invalid');
        return undefined;
      }
      const level = readLevel(reader, raw, path, profile);
      if (lengths.has(level)) reader.fail(path, 'duplicate');
      lengths.add(level);
      const minutes = reader.requiredNumber(raw, 'minutes', path, true);
      const source = reader.requiredText(raw, 'source', path);
      const confidence = reader.oneOf(raw, 'confidence', path, CONFIDENCES);
      return minutes === undefined || confidence === undefined ? undefined : { level, minutes, source, confidence };
    },
    { nonEmpty: false },
  );

  if (reader.problems.length > 0) return { ok: false, problems: reader.problems };
  return { ok: true, value: { country, release, templates, ramadan } };
}
