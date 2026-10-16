// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  parseCountryProfile,
  parseSchoolCalendar,
  type CountryProfile,
  type ParseProblem,
  type SchoolCalendar,
} from '@minhajna/core';
import calendar from '@minhajna/data/dz/calendar-2026-2027.json';
import profile from '@minhajna/data/dz/profile.json';

// Algeria's reference data, bundled from the repository's data folder, so the
// app needs no network for it (PRD §4.8). Even bundled, a file is untrusted:
// it goes through the core's readers like any file that comes in (PRD §5.9).

/** The two files as parsed JSON, before any check. */
export interface ReferenceFiles {
  readonly profile: unknown;
  readonly calendar: unknown;
}

export const bundledReference: ReferenceFiles = { profile, calendar };

/** A problem, with the file it was found in. */
export interface ReferenceProblem extends ParseProblem {
  readonly file: keyof ReferenceFiles;
}

export type ReferenceResult =
  | { readonly ok: true; readonly profile: CountryProfile; readonly calendar: SchoolCalendar }
  | { readonly ok: false; readonly problems: readonly ReferenceProblem[] };

/**
 * Reads the profile, then the calendar against it. A refused profile leaves
 * nothing to check the calendar against, so both are refused together, and
 * no data from either is used.
 */
export function readReference(files: ReferenceFiles): ReferenceResult {
  const readProfile = parseCountryProfile(files.profile);
  if (!readProfile.ok) {
    return { ok: false, problems: readProfile.problems.map((problem) => ({ ...problem, file: 'profile' })) };
  }
  const readCalendar = parseSchoolCalendar(files.calendar, readProfile.value);
  if (!readCalendar.ok) {
    return { ok: false, problems: readCalendar.problems.map((problem) => ({ ...problem, file: 'calendar' })) };
  }
  return { ok: true, profile: readProfile.value, calendar: readCalendar.value };
}
