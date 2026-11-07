// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up schools for the dashboard's tests.

import type { DirectoryCommune, DirectorySchool } from '@minhajna/core';

/** A made-up middle school in wilaya 16. */
export function schoolIn(id: string, commune: DirectoryCommune, name: string): DirectorySchool {
  return { id, name, level: 'cem', wilaya: '16', commune };
}

/** A made-up commune of wilaya 16. */
export const COMMUNE: DirectoryCommune = { code: '1601', name: { ar: 'بلدية مثال', fr: 'Commune exemple' } };

/** Chooses a value in a dashboard select. */
export async function choose(press: (testID: string) => Promise<void>, field: string, value: string) {
  await press(field);
  await press(`${field}-${value}`);
}
