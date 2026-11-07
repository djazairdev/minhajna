// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory the server keeps outside any demo world (answers 802 to 808):
// the Ministry's reference list that setup reads, each level's teaching options
// and the schools. Every name in it is made up until the national system
// exists. An option is what a teacher picks in setup: one subject, a bivalent
// pair, or the primary's class teacher, whose words come from the app's
// catalogues. The readers answer the value, or a sentence saying what is wrong
// with it. A school's book is in directory-book.ts.

import { isDay, type Day } from './day.ts';
import { isCode, isObject, isText } from './directory-read.ts';
import type { CountryProfile, LocalizedText } from './reference.ts';

export const DIRECTORY_FORMAT = 1;
export const MAX_DIRECTORY_SCHOOLS = 20_000;

export interface DirectoryOption {
  readonly code: string;
  readonly subjects: readonly string[];
  readonly classTeacher?: true;
}

export interface DirectoryLevel {
  readonly code: string;
  readonly options: readonly DirectoryOption[];
}

export interface DirectoryCommune {
  readonly code: string;
  readonly name: LocalizedText;
}

export interface DirectorySchool {
  readonly id: string;
  readonly name: string;
  readonly level: string;
  readonly wilaya: string;
  readonly commune: DirectoryCommune;
}

export interface ReferenceDraft {
  readonly levels: readonly DirectoryLevel[];
  readonly schools: readonly DirectorySchool[];
}

export interface ReferenceList extends ReferenceDraft {
  readonly format: typeof DIRECTORY_FORMAT;
  readonly version: string;
  readonly published: Day;
}

function readOption(value: unknown): DirectoryOption | string {
  if (!isObject(value) || !isCode(value.code)) return 'an option needs a code';
  const { subjects } = value;
  if (!Array.isArray(subjects) || subjects.length === 0 || !subjects.every(isCode)) {
    return `option ${value.code} needs its subjects`;
  }
  return {
    code: value.code,
    subjects: subjects,
    ...(value.classTeacher === true && { classTeacher: true as const }),
  };
}

function readLevel(value: unknown): DirectoryLevel | string {
  if (!isObject(value) || !isCode(value.code) || !Array.isArray(value.options))
    return 'a level needs a code and options';
  const options: DirectoryOption[] = [];
  for (const one of value.options) {
    const option = readOption(one);
    if (typeof option === 'string') return option;
    if (options.some((other) => other.code === option.code)) return `option ${option.code} appears twice`;
    options.push(option);
  }
  return { code: value.code, options };
}

function readNames(value: unknown): LocalizedText | null {
  if (!isObject(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0 || !entries.every(([key, text]) => isCode(key) && isText(text))) return null;
  return Object.fromEntries(entries) as LocalizedText;
}

function readSchool(value: unknown): DirectorySchool | string {
  if (!isObject(value) || !isCode(value.id)) return 'a school needs an id';
  if (!isText(value.name)) return `school ${value.id} needs a name`;
  if (!isCode(value.level) || !isCode(value.wilaya)) return `school ${value.id} needs a level and a wilaya`;
  const commune = isObject(value.commune) ? value.commune : null;
  const names = readNames(commune?.name);
  if (commune === null || !isCode(commune.code) || names === null) return `school ${value.id} needs a commune`;
  return {
    id: value.id,
    name: value.name.trim(),
    level: value.level,
    wilaya: value.wilaya,
    commune: { code: commune.code, name: names },
  };
}

/** A draft of the reference list, as the Ministry's page keeps it. */
export function readReferenceDraft(value: unknown): ReferenceDraft | string {
  if (!isObject(value) || !Array.isArray(value.levels) || !Array.isArray(value.schools)) {
    return 'a reference list needs levels and schools';
  }
  if (value.schools.length > MAX_DIRECTORY_SCHOOLS) return 'too many schools';
  const levels: DirectoryLevel[] = [];
  for (const one of value.levels) {
    const level = readLevel(one);
    if (typeof level === 'string') return level;
    if (levels.some((other) => other.code === level.code)) return `level ${level.code} appears twice`;
    levels.push(level);
  }
  const schools: DirectorySchool[] = [];
  const seen = new Set<string>();
  for (const one of value.schools) {
    const school = readSchool(one);
    if (typeof school === 'string') return school;
    if (seen.has(school.id)) return `school ${school.id} appears twice`;
    if (!levels.some((level) => level.code === school.level)) return `school ${school.id} has an unknown level`;
    seen.add(school.id);
    schools.push(school);
  }
  return { levels, schools };
}

/** A published list, as a phone receives it. */
export function readReferenceList(value: unknown): ReferenceList | string {
  if (!isObject(value) || value.format !== DIRECTORY_FORMAT) return 'not a reference list of this format';
  if (!isText(value.version, 32)) return 'a reference list needs a version';
  if (typeof value.published !== 'string' || !isDay(value.published)) return 'a reference list needs its day';
  const draft = readReferenceDraft(value);
  if (typeof draft === 'string') return draft;
  return { format: DIRECTORY_FORMAT, version: value.version, published: value.published, ...draft };
}

/**
 * The options a new list starts with, from the country profile: each subject of a level; for a level with specialists,
 * the class teacher, who teaches all the others, then each specialist.
 */
export function startingLevels(profile: CountryProfile): DirectoryLevel[] {
  return profile.levels.map((level) => {
    const subjects = profile.subjects.filter((subject) => subject.levels.includes(level.code));
    const specialists = subjects.filter((subject) => subject.specialist?.includes(level.code) === true);
    const single = (codes: readonly string[]) => codes.map((code) => ({ code, subjects: [code] }));
    if (specialists.length === 0) return { code: level.code, options: single(subjects.map(({ code }) => code)) };
    const own = subjects.filter((subject) => !specialists.includes(subject)).map(({ code }) => code);
    return {
      code: level.code,
      options: [
        { code: 'class', subjects: own, classTeacher: true as const },
        ...single(specialists.map(({ code }) => code)),
      ],
    };
  });
}

/** The next version after this one, as year.number; the first of a year is number 1. */
export function nextReferenceVersion(last: string | null, year: number): string {
  const match = last === null ? null : /^(\d{4})\.(\d+)$/u.exec(last);
  return match !== null && Number(match[1]) === year ? `${year}.${Number(match[2]) + 1}` : `${year}.1`;
}
