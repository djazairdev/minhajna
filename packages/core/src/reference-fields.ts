// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The checks that the profile, calendar and pack readers share. The index
// does not export them: they are not part of the core's interface.

import type { Weekday } from './day.ts';
import { at, hasBidiControl, isFields, LANGUAGE, Reader, type Fields } from './read.ts';
import type { CountryProfile, LocalizedText } from './reference.ts';

export const COUNTRY = /^[a-z]{2}$/;
/** The code of a level, grade, subject or session type, such as `cem`, `1am` or `math`. */
export const CODE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const YEAR_ID = /^(\d{4})-(\d{4})$/;
export const ENTRY_ID = /^[A-Za-z0-9._-]{1,64}$/;
/** A zone or a school, as the layers name them. */
export const PLACE = /^[A-Za-z0-9._-]{1,64}$/;
/** The teacher's own layer never comes in a file: it stays on the teacher's devices (PRD §4.5). */
export const FILE_LAYERS = ['national', 'zone', 'school'] as const;

export function readName(reader: Reader, fields: Fields, path: string, key = 'name'): LocalizedText | undefined {
  const value = fields[key];
  const texts = isFields(value) ? Object.entries(value) : [];
  const valid = texts.every(
    ([language, text]) =>
      LANGUAGE.test(language) && typeof text === 'string' && text.trim() !== '' && !hasBidiControl(text),
  );
  if (texts.length === 0 || !valid) {
    reader.fail(at(path, key), value === undefined ? 'required' : 'invalid');
    return undefined;
  }
  return Object.fromEntries(texts) as LocalizedText;
}

export function readWeekday(reader: Reader, value: unknown, path: string): Weekday | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) return value as Weekday;
  reader.fail(path, value === undefined ? 'required' : 'invalid');
  return undefined;
}

/** The codes read so far, so that a code is used only once and references can be checked. */
export interface KnownCodes {
  readonly levels: Set<string>;
  /** Unique across the profile, since entries and classes name a grade without its level. */
  readonly grades: Set<string>;
}

/** Reports a code already used in the same list. */
export function distinct(reader: Reader, seen: Set<string>, code: string, path: string): void {
  if (code === '') return;
  if (seen.has(code)) reader.fail(at(path, 'code'), 'duplicate');
  seen.add(code);
}

export function levelCodes(profile: Pick<CountryProfile, 'levels'>): string[] {
  return profile.levels.map((level) => level.code);
}

export function gradeCodes(profile: Pick<CountryProfile, 'levels'>): string[] {
  return profile.levels.flatMap((level) => level.grades.map((grade) => grade.code));
}

/** A zone entry names its zone and a school entry its school. No other entry names either. */
export function placeFits(reader: Reader, raw: Fields, key: 'zone' | 'schoolId', needed: boolean, path: string): void {
  if (needed && raw[key] === undefined) reader.fail(at(path, key), 'required');
  if (!needed && raw[key] !== undefined) reader.fail(at(path, key), 'invalid');
}
