// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A record's versions: corrections add versions, and every version stays
// (PRD §3.1, rule 4). The last one is the record as it is now.

import type { Day } from './day.ts';
import type { Entry } from './history.ts';

/** One version of a record. Corrections add versions, and every version stays (PRD §3.1, rule 4). */
export interface Version<T> {
  readonly entry: string;
  readonly day: Day;
  readonly value: T;
  readonly reason?: string;
}

/** The version an entry holds, on its own day or, for a restated one, the day of the entry it replaced. */
export function versionOf<T>(entry: Entry, value: T, reason?: string, day: Day = entry.day): Version<T> {
  return { entry: entry.id, day, value, ...(reason !== undefined && { reason }) };
}

/** The current version of a record, or null. */
export function current<T>(versions: readonly Version<T>[] | undefined): T | null {
  return versions?.at(-1)?.value ?? null;
}
