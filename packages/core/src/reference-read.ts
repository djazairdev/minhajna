// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a country profile from parsed JSON. It comes in as a file, so it is
// untrusted: every field is checked, and only the format's fields are kept
// (PRD §5.9).

import type { Weekday } from './day.ts';
import { isFields, Reader, RELEASE, type ParseResult } from './read.ts';
import { QUEUES, ROLL_CALL_UNITS, type CountryProfile, type Level } from './reference.ts';
import { CODE, COUNTRY, distinct, readName, readWeekday, type KnownCodes } from './reference-fields.ts';

/** The level's code counts as known even when another field is wrong, so the problem is reported once. */
function readLevel(reader: Reader, raw: unknown, path: string, known: KnownCodes): Level | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const code = reader.requiredText(raw, 'code', path, CODE);
  distinct(reader, known.levels, code, path);
  const rollCallUnit = reader.oneOf(raw, 'rollCallUnit', path, ROLL_CALL_UNITS);
  const sessionMinutes = reader.requiredNumber(raw, 'sessionMinutes', path, true);
  const name = readName(reader, raw, path);
  const levelGrades = reader.list(
    raw,
    'grades',
    path,
    (rawGrade, gradePath) => {
      if (!isFields(rawGrade)) {
        reader.fail(gradePath, 'invalid');
        return undefined;
      }
      const gradeCode = reader.requiredText(rawGrade, 'code', gradePath, CODE);
      distinct(reader, known.grades, gradeCode, gradePath);
      const gradeName = readName(reader, rawGrade, gradePath);
      return gradeName === undefined ? undefined : { code: gradeCode, name: gradeName };
    },
    { nonEmpty: true },
  );
  if (rollCallUnit === undefined || sessionMinutes === undefined || name === undefined) return undefined;
  return { code, rollCallUnit, sessionMinutes, name, grades: levelGrades };
}

/** Reads a country profile from parsed JSON, keeping only the format's fields. */
export function parseCountryProfile(input: unknown): ParseResult<CountryProfile> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');

  const code = reader.requiredText(input, 'code', '', COUNTRY);
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const weekStartsOn = readWeekday(reader, input['weekStartsOn'], 'weekStartsOn');

  const rawDays = input['workingDays'];
  const workingDays: Weekday[] = [];
  if (Array.isArray(rawDays) && rawDays.length > 0 && new Set(rawDays).size === rawDays.length) {
    rawDays.forEach((raw: unknown, index) => {
      const day = readWeekday(reader, raw, `workingDays[${index}]`);
      if (day !== undefined) workingDays.push(day);
    });
  } else {
    reader.fail('workingDays', rawDays === undefined ? 'required' : 'invalid');
  }

  const known: KnownCodes = { levels: new Set(), grades: new Set() };
  const levels = reader.list(input, 'levels', '', (raw, path) => readLevel(reader, raw, path, known), {
    nonEmpty: true,
  });

  const subjectCodes = new Set<string>();
  const subjects = reader.list(
    input,
    'subjects',
    '',
    (raw, path) => {
      if (!isFields(raw)) {
        reader.fail(path, 'invalid');
        return undefined;
      }
      const subjectCode = reader.requiredText(raw, 'code', path, CODE);
      distinct(reader, subjectCodes, subjectCode, path);
      const name = readName(reader, raw, path);
      const subjectLevels = reader.codes(raw, 'levels', path, [...known.levels], true);
      return name === undefined || subjectLevels === undefined
        ? undefined
        : { code: subjectCode, name, levels: subjectLevels };
    },
    { nonEmpty: true },
  );

  const typeCodes = new Set<string>();
  const sessionTypes = reader.list(
    input,
    'sessionTypes',
    '',
    (raw, path) => {
      if (!isFields(raw)) {
        reader.fail(path, 'invalid');
        return undefined;
      }
      const typeCode = reader.requiredText(raw, 'code', path, CODE);
      distinct(reader, typeCodes, typeCode, path);
      const queue = reader.oneOf(raw, 'queue', path, QUEUES);
      const name = readName(reader, raw, path);
      return queue === undefined || name === undefined ? undefined : { code: typeCode, queue, name };
    },
    { nonEmpty: true },
  );

  if (reader.problems.length > 0 || weekStartsOn === undefined) return { ok: false, problems: reader.problems };
  return { ok: true, value: { code, release, weekStartsOn, workingDays, levels, subjects, sessionTypes } };
}
