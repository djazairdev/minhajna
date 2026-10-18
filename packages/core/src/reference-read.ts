// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a country profile from parsed JSON. It comes in as a file, so it is
// untrusted: every field is checked, and only the format's fields are kept
// (PRD §5.9).

import type { Weekday } from './day.ts';
import { isFields, LANGUAGE, Reader, RELEASE, type Fields, type ParseResult } from './read.ts';
import { QUEUES, ROLL_CALL_UNITS, type CountryProfile, type Level, type MonthNames, type Zone } from './reference.ts';
import { CODE, COUNTRY, distinct, PLACE, readName, readWeekday, type KnownCodes } from './reference-fields.ts';

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

/** The months' names, January first. Older profiles have none. */
function readMonths(reader: Reader, fields: Fields): readonly MonthNames[] | undefined {
  const value = fields['months'];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    reader.fail('months', 'invalid');
    return undefined;
  }
  if (value.length !== 12) reader.fail('months', 'invalid');
  const months: MonthNames[] = [];
  for (let index = 0; index < value.length; index++) {
    const raw: unknown = value[index];
    const path = `months[${index}]`;
    if (!isFields(raw)) {
      reader.fail(path, 'invalid');
    } else {
      months.push({
        ar: reader.requiredText(raw, 'ar', path),
        fr: reader.requiredText(raw, 'fr', path),
        en: reader.requiredText(raw, 'en', path),
      });
    }
  }
  return months;
}

/** The zones, each with a distinct code. Older profiles have none. */
function readZones(reader: Reader, fields: Fields): readonly Zone[] | undefined {
  if (fields['zones'] === undefined) return undefined;
  const codes = new Set<string>();
  return reader.list(
    fields,
    'zones',
    '',
    (raw, path) => {
      if (!isFields(raw)) {
        reader.fail(path, 'invalid');
        return undefined;
      }
      const code = reader.requiredText(raw, 'code', path, PLACE);
      distinct(reader, codes, code, path);
      const name = readName(reader, raw, path);
      return name === undefined ? undefined : { code, name };
    },
    { nonEmpty: true },
  );
}

/** Reads a country profile from parsed JSON, keeping only the format's fields. */
export function parseCountryProfile(input: unknown): ParseResult<CountryProfile> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');

  const code = reader.requiredText(input, 'code', '', COUNTRY);
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const weekStartsOn = readWeekday(reader, input['weekStartsOn'], 'weekStartsOn');
  const months = readMonths(reader, input);
  const zones = readZones(reader, input);
  const language = reader.text(input, 'language', '', LANGUAGE);

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
      const subjectLanguage = reader.text(raw, 'language', path, LANGUAGE);
      return name === undefined || subjectLevels === undefined
        ? undefined
        : {
            code: subjectCode,
            name,
            levels: subjectLevels,
            ...(subjectLanguage !== undefined && { language: subjectLanguage }),
          };
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
  return {
    ok: true,
    value: {
      code,
      release,
      weekStartsOn,
      workingDays,
      ...(months === undefined ? {} : { months }),
      levels,
      ...(language === undefined ? {} : { language }),
      subjects,
      sessionTypes,
      ...(zones === undefined ? {} : { zones }),
    },
  };
}
