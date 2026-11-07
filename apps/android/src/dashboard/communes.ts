// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Algeria's communes for the dashboard's pages (answer 809), from the wilayas
// dataset (CC0, data/dz/communes.json): only the dashboard imports them, as a
// teacher's setup reads each school's commune from the published list.

import type { DirectoryCommune } from '@minhajna/core';
import data from '@minhajna/data/dz/communes.json';

const byWilaya: Readonly<Record<string, readonly DirectoryCommune[]>> = data.wilayas;

/** The communes of a wilaya, by code. */
export function communesOf(wilaya: string | null): readonly DirectoryCommune[] {
  return wilaya === null ? [] : (byWilaya[wilaya] ?? []);
}

/** How many communes the country has. */
export const COMMUNE_COUNT = Object.values(byWilaya).reduce((count, communes) => count + communes.length, 0);

/** A commune and its wilaya, by the commune's code. */
export function communeByCode(code: string): { wilaya: string; commune: DirectoryCommune } | null {
  for (const [wilaya, communes] of Object.entries(byWilaya)) {
    const commune = communes.find((one) => one.code === code);
    if (commune !== undefined) return { wilaya, commune };
  }
  return null;
}
