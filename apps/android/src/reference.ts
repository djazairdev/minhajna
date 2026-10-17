// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  parseBellData,
  parseCountryProfile,
  parsePlanPack,
  parseSchoolCalendar,
  type BellData,
  type CountryProfile,
  type ParseProblem,
  type PlanPack,
  type SchoolCalendar,
} from '@minhajna/core';
import bells from '@minhajna/data/dz/bells.json';
import calendar from '@minhajna/data/dz/calendar-2026-2027.json';
import cem1Math from '@minhajna/data/dz/packs/dz.cem.1am.math.example.json';
import cem4Arabic from '@minhajna/data/dz/packs/dz.cem.4am.arabic.example.json';
import primary5Arabic from '@minhajna/data/dz/packs/dz.primary.5ap.arabic.example.json';
import profile from '@minhajna/data/dz/profile.json';

// Algeria's reference data, bundled from the repository's data folder, so the
// app needs no network for it (PRD §4.8). Even bundled, a file is untrusted:
// it goes through the core's readers like any file that comes in (PRD §5.9).
// A refused plan pack is left out on its own, and the others are kept.

/** The files as parsed JSON, before any check. */
export interface ReferenceFiles {
  readonly profile: unknown;
  readonly calendar: unknown;
  readonly bells: unknown;
  readonly packs: readonly unknown[];
}

export const bundledReference: ReferenceFiles = {
  profile,
  calendar,
  bells,
  packs: [cem1Math, cem4Arabic, primary5Arabic],
};

/** A problem, with the file it was found in. */
export interface ReferenceProblem extends ParseProblem {
  readonly file: Exclude<keyof ReferenceFiles, 'packs'>;
}

export type ReferenceResult =
  | {
      readonly ok: true;
      readonly profile: CountryProfile;
      readonly calendar: SchoolCalendar;
      readonly bells: BellData;
      /** The packs that read; a refused one is left out. */
      readonly packs: readonly PlanPack[];
      /** How many pack files were refused. */
      readonly refusedPacks: number;
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
  const packs = files.packs.map((file) => parsePlanPack(file));
  return {
    ok: true,
    profile: readProfile.value,
    calendar: readCalendar.value,
    bells: readBells.value,
    packs: packs.flatMap((read) => (read.ok ? [read.value] : [])),
    refusedPacks: packs.filter((read) => !read.ok).length,
  };
}
