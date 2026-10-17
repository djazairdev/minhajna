// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a school calendar from parsed JSON, against the country profile it
// belongs to. It comes in as a file, so it is untrusted: every field is
// checked, and only the format's fields are kept (PRD §5.9).

import { compareDays } from './day.ts';
import { at, isFields, Reader, RELEASE, type ParseResult } from './read.ts';
import {
  CALENDAR_EFFECTS,
  CONFIDENCES,
  type CalendarEntry,
  type CountryProfile,
  type SchoolCalendar,
  type SchoolYear,
} from './reference.ts';
import {
  COUNTRY,
  ENTRY_ID,
  FILE_LAYERS,
  PLACE,
  YEAR_ID,
  gradeCodes,
  levelCodes,
  placeFits,
  readName,
} from './reference-fields.ts';

/**
 * Reads the school year. Its terms are numbered from 1, lie within the
 * year, and each starts after the one before it ends.
 */
function readYear(reader: Reader, value: unknown): SchoolYear | undefined {
  const path = 'year';
  if (!isFields(value)) {
    reader.fail(path, value === undefined ? 'required' : 'invalid');
    return undefined;
  }
  const id = reader.requiredText(value, 'id', path, YEAR_ID);
  const match = YEAR_ID.exec(id);
  if (match !== null && Number(match[2]) !== Number(match[1]) + 1) reader.fail(at(path, 'id'), 'invalid');
  const span = reader.span(value, path);
  const source = reader.requiredText(value, 'source', path);

  const before = reader.problems.length;
  const terms = reader.list(
    value,
    'terms',
    path,
    (raw, termPath) => {
      if (!isFields(raw)) {
        reader.fail(termPath, 'invalid');
        return undefined;
      }
      const number = reader.requiredNumber(raw, 'number', termPath, true);
      const termSpan = reader.span(raw, termPath);
      return number === undefined || termSpan === undefined ? undefined : { number, ...termSpan };
    },
    { nonEmpty: true },
  );
  if (span !== undefined && reader.problems.length === before) {
    terms.forEach((term, index) => {
      const termPath = `${path}.terms[${index}]`;
      const previous = terms[index - 1];
      const startsInTime =
        previous === undefined ? compareDays(term.from, span.from) >= 0 : compareDays(term.from, previous.to) > 0;
      if (term.number !== index + 1) reader.fail(at(termPath, 'number'), 'invalid');
      if (!startsInTime) reader.fail(at(termPath, 'from'), 'invalid');
      if (compareDays(term.to, span.to) > 0) reader.fail(at(termPath, 'to'), 'invalid');
    });
  }
  return span === undefined ? undefined : { id, from: span.from, to: span.to, terms, source };
}

/**
 * Reads one calendar entry. When it names levels as well as grades, every
 * grade belongs to one of those levels.
 */
function readEntry(
  reader: Reader,
  raw: unknown,
  path: string,
  profile: CountryProfile,
  year: SchoolYear | undefined,
): CalendarEntry | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const id = reader.requiredText(raw, 'id', path, ENTRY_ID);
  const layer = reader.oneOf(raw, 'layer', path, FILE_LAYERS);
  const zone = reader.text(raw, 'zone', path, PLACE);
  if (zone !== undefined && profile.zones !== undefined && !profile.zones.some((known) => known.code === zone)) {
    reader.fail(at(path, 'zone'), 'unknown-reference');
  }
  const schoolId = reader.text(raw, 'schoolId', path, PLACE);
  if (layer !== undefined) {
    placeFits(reader, raw, 'zone', layer === 'zone', path);
    placeFits(reader, raw, 'schoolId', layer === 'school', path);
  }
  const span = reader.span(raw, path);
  const effect = reader.oneOf(raw, 'effect', path, CALENDAR_EFFECTS);
  const levels = reader.codes(raw, 'levels', path, levelCodes(profile), false);
  const grades = reader.codes(raw, 'grades', path, gradeCodes(profile), false);
  if (grades !== undefined && levels !== undefined) {
    const allowed = gradeCodes({ levels: profile.levels.filter((level) => levels.includes(level.code)) });
    if (!grades.every((code) => allowed.includes(code))) reader.fail(at(path, 'grades'), 'invalid');
  }
  const term = reader.number(raw, 'term', path, true);
  if (term !== undefined && year !== undefined && !year.terms.some((candidate) => candidate.number === term)) {
    reader.fail(at(path, 'term'), 'unknown-reference');
  }
  const name = readName(reader, raw, path);
  const source = reader.requiredText(raw, 'source', path);
  const confidence = reader.oneOf(raw, 'confidence', path, CONFIDENCES);
  const complete = layer !== undefined && span !== undefined && effect !== undefined && name !== undefined;
  if (!complete || confidence === undefined) return undefined;
  return {
    id,
    layer,
    ...(zone !== undefined && { zone }),
    ...(schoolId !== undefined && { schoolId }),
    from: span.from,
    to: span.to,
    effect,
    ...(levels !== undefined && { levels }),
    ...(grades !== undefined && { grades }),
    ...(term !== undefined && { term }),
    name,
    source,
    confidence,
  };
}

/**
 * Reads a school calendar from parsed JSON, keeping only the format's fields.
 * Its levels and grades must be the profile's.
 */
export function parseSchoolCalendar(input: unknown, profile: CountryProfile): ParseResult<SchoolCalendar> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');

  const country = reader.requiredText(input, 'country', '', COUNTRY);
  if (country !== '' && country !== profile.code) reader.fail('country', 'unknown-reference');
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const year = readYear(reader, input['year']);

  const ids = new Set<string>();
  const entries = reader.list(
    input,
    'entries',
    '',
    (raw, path) => {
      const entry = readEntry(reader, raw, path, profile, year);
      if (entry !== undefined) {
        if (ids.has(entry.id)) reader.fail(at(path, 'id'), 'duplicate');
        ids.add(entry.id);
      }
      return entry;
    },
    { nonEmpty: false },
  );

  if (reader.problems.length > 0 || year === undefined) return { ok: false, problems: reader.problems };
  return { ok: true, value: { country, release, year, entries } };
}
