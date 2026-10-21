// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a signed update (#223, R-4.8-03 to R-4.8-05, answers 326 to 328):
// the signature is checked with a key the app trusts before anything in the
// file is read, then the payload must be a calendar update for this country
// and school year, or a plan pack's release for this country, of a kind the
// key may sign. A calendar update weighs what a QR code carries; a pack, up
// to 1 MB. Only the outcome is kept: the file's text goes into the record
// when the teacher applies it, and nowhere else.

import {
  keySigns,
  openSigned,
  PACK_BYTES,
  parseCalendarUpdate,
  parsePackUpdate,
  signedKindOf,
  SIGNED_BYTES,
  utf8Length,
  type CalendarUpdate,
  type CountryProfile,
  type PackUpdate,
  type ParseProblem,
  type SchoolYear,
  type SignedProblem,
  type TrustedKey,
  type Verifier,
} from '@minhajna/core';

/** Why a file was refused: its signature, its key's kinds, or what it holds once it checks. */
export type UpdateProblem = SignedProblem | 'kind' | 'key-kind' | 'update-version' | 'country' | 'year' | 'content';

export type ReadUpdate =
  | {
      readonly ok: true;
      readonly kind: 'calendar';
      readonly update: CalendarUpdate;
      readonly key: TrustedKey;
      readonly file: string;
    }
  | {
      readonly ok: true;
      readonly kind: 'packs';
      readonly pack: PackUpdate;
      readonly key: TrustedKey;
      readonly file: string;
    }
  | { readonly ok: false; readonly problem: UpdateProblem; readonly key?: TrustedKey };

function problemOf(problems: readonly ParseProblem[]): UpdateProblem {
  const paths = problems.map((one) => one.path);
  const foreign = problems.some((one) => one.path === 'pack.id' && one.problem === 'unknown-reference');
  return paths.includes('version')
    ? 'update-version'
    : paths.includes('country') || foreign
      ? 'country'
      : paths.includes('year')
        ? 'year'
        : 'content';
}

/** Checks a signed file and reads the calendar update or the plan pack it holds. */
export async function readUpdate(
  text: string,
  keys: readonly TrustedKey[],
  verify: Verifier,
  profile: CountryProfile,
  year: SchoolYear,
): Promise<ReadUpdate> {
  const opened = await openSigned(text, keys, verify, PACK_BYTES);
  if (!opened.ok) return opened;
  const { key, payload } = opened;
  const kind = signedKindOf(payload);
  if (kind === null) return { ok: false, problem: 'kind', key };
  if (!keySigns(key, kind)) return { ok: false, problem: 'key-kind', key };
  if (kind === 'packs') {
    const read = parsePackUpdate(payload, profile);
    return read.ok
      ? { ok: true, kind, pack: read.value, key, file: text }
      : { ok: false, problem: problemOf(read.problems), key };
  }
  if ((utf8Length(text) ?? Infinity) > SIGNED_BYTES) return { ok: false, problem: 'invalid', key };
  const read = parseCalendarUpdate(payload, profile, year);
  return read.ok
    ? { ok: true, kind, update: read.value, key, file: text }
    : { ok: false, problem: problemOf(read.problems), key };
}
