// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind Setup-2-Teaching (#25): which subjects a school's levels
// offer, which show before «مواد أخرى», and when a school is complete. The
// levels and subjects come from the country profile (#22); the five subjects
// shown first are the ones the design draws, which most teachers teach.

import type { CountryProfile, School, Subject } from '@minhajna/core';

const FIRST_SUBJECTS: readonly string[] = ['arabic', 'islamic', 'french', 'english', 'math'];

/** A school with nothing chosen yet. */
export function blankSchool(id: string): School {
  return { id, name: '', levels: [], subjects: [] };
}

/** The subjects taught at any of these levels, or every subject while no level is chosen. */
export function offeredSubjects(profile: CountryProfile, levels: readonly string[]): Subject[] {
  if (levels.length === 0) return [...profile.subjects];
  return profile.subjects.filter((subject) => subject.levels.some((level) => levels.includes(level)));
}

/**
 * The subjects to show: the first five, then any already chosen, or every
 * offered subject once the teacher asks for the others. The first five keep
 * the design's order; the rest keep the profile's.
 */
export function shownSubjects(
  profile: CountryProfile,
  school: School,
  all: boolean,
): { readonly shown: Subject[]; readonly hidden: number } {
  const offered = offeredSubjects(profile, school.levels);
  const rank = (subject: Subject) => {
    const at = FIRST_SUBJECTS.indexOf(subject.code);
    return at === -1 ? FIRST_SUBJECTS.length : at;
  };
  const ordered = [...offered].sort((a, b) => rank(a) - rank(b));
  const shown = all
    ? ordered
    : ordered.filter((subject) => FIRST_SUBJECTS.includes(subject.code) || school.subjects.includes(subject.code));
  return { shown, hidden: offered.length - shown.length };
}

/** New levels, dropping any chosen subject that none of them offers. */
export function withLevels(profile: CountryProfile, school: School, levels: readonly string[]): School {
  const offered = offeredSubjects(profile, levels).map((subject) => subject.code);
  return { ...school, levels, subjects: school.subjects.filter((code) => offered.includes(code)) };
}

/** A name, at least one level and at least one subject. */
export function isComplete(school: School): boolean {
  return school.name.trim() !== '' && school.levels.length > 0 && school.subjects.length > 0;
}

/** The school as it is saved: the name without spaces around it. */
export function tidy(school: School): School {
  return { ...school, name: school.name.trim() };
}
