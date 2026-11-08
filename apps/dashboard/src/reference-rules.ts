// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's list as N-Reference edits it (answers 804 and 805): what a
// level's options are called, adding and hiding them, adding and hiding
// schools, and what changed since the last version. Hiding takes a thing out of
// the draft: the list holds only what teachers see, and an earlier version
// brings it back. A new option never takes a code the level holds, nor one the
// published list gave other subjects. Every name the page holds is made up.

import type { CountryProfile, DirectoryLevel, DirectoryOption, DirectorySchool, ReferenceDraft } from '@minhajna/core';
import { startingLevels } from '@minhajna/core';
import type { DashboardText } from './text';
import { subjectName } from '../../android/src/extra/extra-rules';

export type OptionKind = 'subject' | 'pair' | 'classTeacher' | 'specialist';

/** What a teacher reads for an option; the words for a pair join its two subjects. */
export function optionName(t: DashboardText, profile: CountryProfile, option: DirectoryOption): string {
  if (option.classTeacher === true) return t('dashboard.levels.classTeacher');
  const names = option.subjects.map((code) => subjectName(profile, code));
  return names.length === 2 ? t('dashboard.levels.pairName', { first: names[0], second: names[1] }) : names.join(' · ');
}

/** An option's kind, as the table's badge says it. */
export function optionKind(profile: CountryProfile, level: string, option: DirectoryOption): OptionKind {
  if (option.classTeacher === true) return 'classTeacher';
  if (option.subjects.length > 1) return 'pair';
  const subject = profile.subjects.find((one) => one.code === option.subjects[0]);
  return subject?.specialist?.includes(level) === true ? 'specialist' : 'subject';
}

/** The subjects a level teaches, in the profile's order. */
export const levelSubjects = (profile: CountryProfile, level: string) =>
  profile.subjects.filter((subject) => subject.levels.includes(level));

/** The subjects that could become a new single option of this level. */
export function freeSubjects(profile: CountryProfile, level: DirectoryLevel, except?: DirectoryOption) {
  const taken = new Set(
    level.options
      .filter((option) => option !== except && option.classTeacher !== true && option.subjects.length === 1)
      .flatMap((option) => option.subjects),
  );
  return levelSubjects(profile, level.code).filter((subject) => !taken.has(subject.code));
}

/** An option for one subject, or a pair of two; the pair's code is its subjects in the order given. */
export function makeOption(subjects: readonly string[]): DirectoryOption {
  return { code: subjects.join('+'), subjects };
}

/** Whether a level already has an option of these subjects, in any order, other than the one being edited. */
export function optionExists(level: DirectoryLevel, subjects: readonly string[], except?: DirectoryOption): boolean {
  const key = [...subjects].sort().join('+');
  return level.options.some(
    (option) => option !== except && !option.classTeacher && [...option.subjects].sort().join('+') === key,
  );
}

const onLevel = (draft: ReferenceDraft, code: string, change: (level: DirectoryLevel) => DirectoryLevel) => ({
  ...draft,
  levels: draft.levels.map((level) => (level.code === code ? change(level) : level)),
});

/**
 * A code no other option of the level has, nor one the published list gave other subjects: the published code of
 * these subjects, else the one asked, else it with `-2`, `-3`, as edited options keep theirs and phones still hold a
 * hidden option's code.
 */
function freeCode(level: DirectoryLevel, option: DirectoryOption, published?: DirectoryLevel): string {
  const subjects = [...option.subjects].sort().join('+');
  const held = new Set(level.options.map((one) => one.code));
  const before = published?.options.find(
    (one) => [...one.subjects].sort().join('+') === subjects && !held.has(one.code),
  );
  if (before !== undefined) return before.code;
  const taken = new Set([
    ...level.options.map((one) => one.code),
    ...(published?.options ?? [])
      .filter((one) => [...one.subjects].sort().join('+') !== subjects)
      .map((one) => one.code),
  ]);
  let free = option.code;
  for (let n = 2; taken.has(free); n++) free = `${option.code}-${n}`;
  return free;
}

/** The draft with an option added under a free code, or put in the place of the one edited. */
export function withOption(
  draft: ReferenceDraft,
  levelCode: string,
  option: DirectoryOption,
  replacing?: DirectoryOption,
  published?: DirectoryLevel,
): ReferenceDraft {
  return onLevel(draft, levelCode, (level) => ({
    ...level,
    options:
      replacing === undefined
        ? [...level.options, { ...option, code: freeCode(level, option, published) }]
        : level.options.map((one) => (one.code === replacing.code ? option : one)),
  }));
}

/** The draft without an option. */
export function withoutOption(draft: ReferenceDraft, levelCode: string, code: string): ReferenceDraft {
  return onLevel(draft, levelCode, (level) => ({
    ...level,
    options: level.options.filter((option) => option.code !== code),
  }));
}

/**
 * A new school's code: its commune's, then the first number free in the draft and in the published list, so a school
 * hidden since is never given another's code, as `160103`.
 */
export function newSchoolId(
  schools: readonly DirectorySchool[],
  commune: string,
  published: readonly DirectorySchool[] = [],
): string {
  const taken = new Set([...schools, ...published].map((school) => school.id));
  for (let number = 1; ; number += 1) {
    const id = `${commune}${String(number).padStart(2, '0')}`;
    if (!taken.has(id)) return id;
  }
}

/** The draft with a school added, or changed when its id is there. */
export function withSchool(draft: ReferenceDraft, school: DirectorySchool): ReferenceDraft {
  const known = draft.schools.some((one) => one.id === school.id);
  return {
    ...draft,
    schools: known ? draft.schools.map((one) => (one.id === school.id ? school : one)) : [...draft.schools, school],
  };
}

/** The draft without a school. */
export function withoutSchool(draft: ReferenceDraft, id: string): ReferenceDraft {
  return { ...draft, schools: draft.schools.filter((school) => school.id !== id) };
}

/** A draft before its first save: the profile's options and no school. */
export function startingDraft(profile: CountryProfile): ReferenceDraft {
  return { levels: startingLevels(profile), schools: [] };
}

export interface DraftChanges {
  readonly added: number;
  readonly edited: number;
  readonly hidden: number;
  readonly options: number;
}

const sameSchool = (one: DirectorySchool, other: DirectorySchool) =>
  one.name === other.name &&
  one.level === other.level &&
  one.wilaya === other.wilaya &&
  one.commune.code === other.commune.code;

const optionKeys = (levels: readonly DirectoryLevel[]) =>
  new Set(levels.flatMap((level) => level.options.map((option) => `${level.code}/${option.subjects.join('+')}`)));

/** What changed against the last version, or against the starting draft before any. */
export function draftChanges(draft: ReferenceDraft, base: ReferenceDraft): DraftChanges {
  const before = new Map(base.schools.map((school) => [school.id, school]));
  const now = new Set(draft.schools.map((school) => school.id));
  const kept = draft.schools.filter((school) => before.has(school.id));
  const baseOptions = optionKeys(base.levels);
  const options = optionKeys(draft.levels);
  return {
    added: draft.schools.length - kept.length,
    edited: kept.filter((school) => !sameSchool(school, before.get(school.id)!)).length,
    hidden: base.schools.filter((school) => !now.has(school.id)).length,
    options:
      [...options].filter((key) => !baseOptions.has(key)).length +
      [...baseOptions].filter((key) => !options.has(key)).length,
  };
}

/** How many changes wait to be published. */
export const changeCount = ({ added, edited, hidden, options }: DraftChanges) => added + edited + hidden + options;
