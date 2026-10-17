// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  parseBellData,
  parseCountryProfile,
  parseSchoolCalendar,
  type BellData,
  type CountryProfile,
  type ParseProblem,
  type SchoolCalendar,
} from '@minhajna/core';
import bells from '@minhajna/data/dz/bells.json';
import calendar from '@minhajna/data/dz/calendar-2026-2027.json';
import profile from '@minhajna/data/dz/profile.json';

// Algeria's reference data, bundled from the repository's data folder, so the
// app needs no network for it (PRD §4.8). Even bundled, a file is untrusted:
// it goes through the core's readers like any file that comes in (PRD §5.9).

/** The three files as parsed JSON, before any check. */
export interface ReferenceFiles {
  readonly profile: unknown;
  readonly calendar: unknown;
  readonly bells: unknown;
}

export const bundledReference: ReferenceFiles = { profile, calendar, bells };

/** A problem, with the file it was found in. */
export interface ReferenceProblem extends ParseProblem {
  readonly file: keyof ReferenceFiles;
}

export type ReferenceResult =
  | {
      readonly ok: true;
      readonly profile: CountryProfile;
      readonly calendar: SchoolCalendar;
      readonly bells: BellData;
    }
  | { readonly ok: false; readonly problems: readonly ReferenceProblem[] };

/**
 * Reads the profile, then the calendar and the bell times against it. A
 * refused profile leaves nothing to check the others against, so all are
 * refused together, and no data from any is used.
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
  const readBells = parseBellData(files.bells, readProfile.value);
  if (!readBells.ok) {
    return { ok: false, problems: readBells.problems.map((problem) => ({ ...problem, file: 'bells' })) };
  }
  return { ok: true, profile: readProfile.value, calendar: readCalendar.value, bells: readBells.value };
}
