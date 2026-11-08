// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the dashboard reads of Algeria's reference data (answer 855): the
// country profile and the bell times, bundled from the repository's data
// folder and read with the core's readers like any file that comes in (PRD
// §5.9), as the teacher app reads them. The calendar, the plan packs and the
// keys stay out of this app.

import { parseBellData, parseCountryProfile, type BellData, type CountryProfile } from '@minhajna/core';
import bells from '@minhajna/data/dz/bells.json';
import profile from '@minhajna/data/dz/profile.json';

/** The files as parsed JSON, before any check. */
export type DashboardFiles = { readonly profile: unknown; readonly bells: unknown };

export const bundledFiles: DashboardFiles = { profile, bells };

/** The profile and the bell times, or null when either is refused. */
export function readDashboardReference(
  files: DashboardFiles,
): { readonly profile: CountryProfile; readonly bells: BellData } | null {
  const readProfile = parseCountryProfile(files.profile);
  if (!readProfile.ok) return null;
  const readBells = parseBellData(files.bells, readProfile.value);
  return readBells.ok ? { profile: readProfile.value, bells: readBells.value } : null;
}
