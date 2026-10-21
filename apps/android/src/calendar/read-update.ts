// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a signed calendar update (#223, R-4.8-03 to R-4.8-05): the
// signature is checked with a key the app trusts before anything in the
// file is read, then the payload must be a calendar update for this
// country and school year. Only the outcome is kept: the file's text goes
// into the record when the teacher applies it, and nowhere else.

import {
  CALENDAR_UPDATE_FORMAT,
  openSigned,
  parseCalendarUpdate,
  type CalendarUpdate,
  type CountryProfile,
  type SchoolYear,
  type SignedProblem,
  type TrustedKey,
  type Verifier,
} from '@minhajna/core';

/** Why a file was refused: its signature, or what it holds once it checks, such as a newer update format. */
export type UpdateProblem = SignedProblem | 'kind' | 'update-version' | 'country' | 'year' | 'content';

export type ReadUpdate =
  | { readonly ok: true; readonly update: CalendarUpdate; readonly key: TrustedKey; readonly file: string }
  | { readonly ok: false; readonly problem: UpdateProblem; readonly key?: TrustedKey };

/** Checks a signed file and reads the calendar update it holds. */
export async function readUpdate(
  text: string,
  keys: readonly TrustedKey[],
  verify: Verifier,
  profile: CountryProfile,
  year: SchoolYear,
): Promise<ReadUpdate> {
  const opened = await openSigned(text, keys, verify);
  if (!opened.ok) return opened;
  const { key, payload } = opened;
  const format = typeof payload === 'object' && payload !== null ? (payload as { format?: unknown }).format : undefined;
  if (format !== CALENDAR_UPDATE_FORMAT) return { ok: false, problem: 'kind', key };
  const read = parseCalendarUpdate(payload, profile, year);
  if (read.ok) return { ok: true, update: read.value, key, file: text };
  const paths = read.problems.map((one) => one.path);
  const problem = paths.includes('version')
    ? 'update-version'
    : paths.includes('country')
      ? 'country'
      : paths.includes('year')
        ? 'year'
        : 'content';
  return { ok: false, problem, key };
}
