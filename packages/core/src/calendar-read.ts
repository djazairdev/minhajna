// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a school calendar from parsed JSON, against the country profile it
// belongs to. It comes in as a file, so it is untrusted: every field is
// checked, and only the format's fields are kept (PRD §5.9). A day that
// adds sessions names what they are for and the weekday it follows; which of
// that weekday's sessions it takes is the teacher's choice, never the file's.

import { compareDays } from './day.ts';
import { at, isFields, Reader, RELEASE, type Fields, type ParseResult } from './read.ts';
import {
  ADDED_KINDS,
  CALENDAR_EFFECTS,
  CALENDAR_TIMES,
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

const ADDED_FIELDS = ['adds', 'follows', 'replaces'] as const;

/** What a day that adds sessions is for, the working day it follows, and the closure it makes up for, if any. */
function readAdded(reader: Reader, raw: Fields, path: string, profile: CountryProfile) {
  const adds = reader.oneOf(raw, 'adds', path, ADDED_KINDS);
  const value = raw['follows'];
  const follows = profile.workingDays.find((day) => day === value);
  if (follows === undefined) reader.fail(at(path, 'follows'), value === undefined ? 'required' : 'invalid');
  const replaces = reader.text(raw, 'replaces', path, ENTRY_ID);
  if (replaces !== undefined && adds !== 'make-up') reader.fail(at(path, 'replaces'), 'invalid');
  return { adds, follows, replaces };
}

/** The dates an entry had before an update moved it, and why. */
function readMoved(reader: Reader, value: unknown, path: string): CalendarEntry['moved'] {
  if (!isFields(value)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const span = reader.span(value, path);
  const reason = reader.requiredText(value, 'reason', path);
  if (reason.length > 300) reader.fail(at(path, 'reason'), 'invalid');
  return span === undefined || reason === '' ? undefined : { from: span.from, to: span.to, reason };
}

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
 * Reads one calendar entry, of a reference calendar file or of a calendar
 * update. When it names levels as well as grades, every grade belongs to one
 * of those levels.
 */
export function readEntry(
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
  const effect = reader.oneOf(
    raw,
    'effect',
    path,
    CALENDAR_EFFECTS.filter((one) => one !== 'rotating-groups'),
  );
  const added = effect === 'adds-sessions' ? readAdded(reader, raw, path, profile) : undefined;
  if (effect !== 'adds-sessions') {
    for (const key of ADDED_FIELDS) if (raw[key] !== undefined) reader.fail(at(path, key), 'invalid');
  }
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
  const times = raw['times'] === undefined ? undefined : reader.oneOf(raw, 'times', path, CALENDAR_TIMES);
  const name = readName(reader, raw, path);
  const source = reader.requiredText(raw, 'source', path);
  const confidence = reader.oneOf(raw, 'confidence', path, CONFIDENCES);
  const moved = raw['moved'] === undefined ? undefined : readMoved(reader, raw['moved'], at(path, 'moved'));
  const lunar = raw['lunar'];
  if (lunar !== undefined && (lunar !== true || layer !== 'national' || effect !== 'no-school'))
    reader.fail(at(path, 'lunar'), 'invalid');
  for (const key of ['half', 'confirmedFrom', 'rotation', 'received'])
    if (raw[key] !== undefined) reader.fail(at(path, key), 'invalid');
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
    ...(times !== undefined && { times }),
    ...(added?.adds !== undefined && { adds: added.adds }),
    ...(added?.follows !== undefined && { follows: added.follows }),
    ...(added?.replaces !== undefined && { replaces: added.replaces }),
    name,
    source,
    confidence,
    ...(moved !== undefined && { moved }),
    ...(lunar === true && { lunar }),
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
