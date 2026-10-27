// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A restore at setup (#247, Restore, R-5.8-10, R-5.8-11, R-5.8-12, R-5.9-02,
// answers 478 and 480): the archive's one file read from the picked ZIP, under
// the old phone's one-time key for a transfer file or the recovery key for a
// backup, both of which must have a password, or under an export's own
// password, if it has one; then checked as a Minhajna archive for this
// country, made into the restored history, and stored, all or none, into
// the empty history on this phone. Each way it can fail is told apart, so
// the screen says what to do; a changed file, which a wrong key also reads
// as once in 65,536, has a page of its own.

import {
  ARCHIVE_FILE,
  HistoryError,
  readArchive,
  readRecoveryKey,
  restoredHistory,
  type Day,
  type HistoryDeps,
  type OpenedArchive,
} from '@minhajna/core';
import type { Spec as Files } from '../native/NativeMinhajnaFiles';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { errorCode } from '../lock/lock-rules';
import { toRow } from '../storage/history';

/** A restore's routes: a transfer file under its one-time key, a backup under the recovery key, or an export. */
export type RestoreRoute = 'phone' | 'backup' | 'archive';

export type RestoreProblem =
  | 'code-form'
  | 'code'
  | 'key-form'
  | 'key'
  | 'password'
  | 'password-needed'
  | 'plain'
  | 'not-archive'
  | 'too-large'
  | 'version'
  | 'country'
  | 'changed'
  | 'unreadable'
  | 'failed'
  | 'not-continued'
  | 'not-handed-over';

export type RestoreResult = { readonly ok: true } | { readonly ok: false; readonly problem: RestoreProblem };

export interface RestoreInput {
  readonly route: RestoreRoute;
  /** The kept archive's token, from `openZip`. */
  readonly token: string;
  /** The one-time key or the recovery key as typed, or the export's password. */
  readonly secret: string;
  /** The country the app is set up for, which the archive must be from. */
  readonly country: string;
  readonly day: Day;
}

export interface RestoreDeps {
  readonly files: Pick<Files, 'readZip'>;
  readonly storage: Pick<Storage, 'restoreHistory'>;
  readonly deps: HistoryDeps;
}

const ZIP_PROBLEMS: Readonly<Record<string, RestoreProblem>> = {
  E_ZIP_CHANGED: 'changed',
  E_ZIP_NOT_ARCHIVE: 'not-archive',
  E_ZIP_TOO_LARGE: 'too-large',
  E_ZIP_PLAIN: 'plain',
};

/** What a refusal of the archive's file means on this route. */
export function zipProblem(code: string | undefined, input: Pick<RestoreInput, 'route' | 'secret'>): RestoreProblem {
  if (code === 'E_ZIP_PASSWORD') {
    if (input.route === 'phone') return 'code';
    if (input.route === 'backup') return 'key';
    return input.secret === '' ? 'password-needed' : 'password';
  }
  return (code !== undefined && ZIP_PROBLEMS[code]) || 'unreadable';
}

/** The picked archive read under its key and checked for this country, or why not. */
export async function openedFile(
  input: RestoreInput,
  { files, deps }: Pick<RestoreDeps, 'files' | 'deps'>,
): Promise<
  { readonly ok: true; readonly opened: Extract<OpenedArchive, { ok: true }> } | Extract<RestoreResult, { ok: false }>
> {
  const keyed = input.route !== 'archive';
  const key = keyed ? readRecoveryKey(input.secret) : input.secret;
  if (key === null) return { ok: false, problem: input.route === 'phone' ? 'code-form' : 'key-form' };
  let text: string;
  try {
    text = await files.readZip(input.token, ARCHIVE_FILE, key, keyed);
  } catch (error: unknown) {
    return { ok: false, problem: zipProblem(errorCode(error), input) };
  }
  const opened = await readArchive(text, deps.digest);
  if (!opened.ok) {
    const problem = { invalid: 'not-archive', version: 'version', chain: 'changed' } as const;
    return { ok: false, problem: problem[opened.problem] };
  }
  if (opened.archive.country !== input.country) return { ok: false, problem: 'country' };
  return { ok: true, opened };
}

/** Restores the picked archive into the empty history, or says why not; nothing is stored unless all of it is. */
export async function restoreFile(input: RestoreInput, { files, storage, deps }: RestoreDeps): Promise<RestoreResult> {
  const read = await openedFile(input, { files, deps });
  if (!read.ok) return read;
  const { opened } = read;
  let restored;
  try {
    restored = await restoredHistory(opened, input.day, deps);
  } catch (error: unknown) {
    return { ok: false, problem: error instanceof HistoryError ? 'changed' : 'failed' };
  }
  try {
    await storage.restoreHistory(JSON.stringify(restored.map(toRow)));
  } catch {
    return { ok: false, problem: 'failed' };
  }
  return { ok: true };
}
