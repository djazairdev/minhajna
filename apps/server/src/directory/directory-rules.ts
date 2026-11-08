// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the directory accepts and how its codes work (answers 802 to 809). An
// edit code guards the Ministry's list or one school's book: 8 to 64 visible
// ASCII characters, since it travels in an Authorization header, kept only as
// its hash. A joining code is 16 random characters of an alphabet with no I, L,
// O or U, written in groups of 4, and a teacher may type it in lower case, with
// spaces or without hyphens. The book keeps each teacher's joining code, so the
// school's page can print it again; finding a teacher by a code goes through
// its hash. Every name in the directory is made up.

import { randomBytes } from 'node:crypto';
import { DIRECTORY_FORMAT } from './core/directory.js';
import { MAX_SLOT_INDEX, readJoiningCode, type SchoolBook } from './core/directory-book.js';
import { hashToken } from '../worlds/world-rules.js';

const EDIT_CODE = /^[\x21-\x7E]{8,64}$/u;
const BEARER = /^Bearer +([\x21-\x7E]{8,64})$/iu;
const JOINING_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const JOINING_GROUP = /.{4}/gu;
/** The largest revision PostgreSQL's integer holds. */
const MAX_REVISION = 2_147_483_647;

export const EMPTY_BOOK: SchoolBook = { format: DIRECTORY_FORMAT, teachers: [], classes: [], week: [] };

export interface EditCodes {
  readonly code: string;
  readonly old: string | null;
}

export interface JoinChanges {
  /** The teachers whose codes stop working. */
  readonly gone: readonly string[];
  /** The teachers with a new code, each with its hash. */
  readonly fresh: readonly { readonly teacher: string; readonly hash: string }[];
}

const isBody = (body: unknown): body is Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body);

/** The codes a request to set an edit code holds, or why it is refused. */
export function readEditCodes(body: unknown): EditCodes | string {
  if (!isBody(body)) return 'the request must be a JSON object';
  const { code, old } = body;
  if (typeof code !== 'string' || !EDIT_CODE.test(code)) {
    return 'an edit code is 8 to 64 Latin letters, digits or signs, with no spaces';
  }
  if (old !== undefined && old !== null && typeof old !== 'string') return 'the old edit code must be text';
  return { code, old: old ?? null };
}

/** The edit code an Authorization header carries. */
export function bearerCode(authorization: string | undefined): string | undefined {
  return BEARER.exec(authorization ?? '')?.[1];
}

/** The revision a save says it follows, or why it is refused. */
export function readExpected(body: unknown): number | string {
  const expected = isBody(body) ? body['expected'] : undefined;
  if (!Number.isSafeInteger(expected) || (expected as number) < 0 || (expected as number) > MAX_REVISION) {
    return `expected must be a whole number from 0 to ${MAX_REVISION}`;
  }
  return expected as number;
}

/** A book as sent, with any joining code a teacher carries dropped, as the server issues them. */
export function withoutCodes(book: unknown): unknown {
  if (!isBody(book) || !Array.isArray(book['teachers'])) return book;
  const teachers = book['teachers'].map((one: unknown) =>
    isBody(one) ? Object.fromEntries(Object.entries(one).filter(([key]) => key !== 'code')) : one,
  );
  return { ...book, teachers };
}

/** A new joining code, written in its groups. */
export function newJoiningCode(): string {
  const letters = Array.from(randomBytes(16), (byte) => JOINING_ALPHABET.charAt(byte & 31)).join('');
  return letters.match(JOINING_GROUP)!.join('-');
}

/** A joining code's hash however it was typed, or null when it can't be one. */
export function joiningHash(typed: string): string | null {
  const letters = readJoiningCode(typed);
  return letters === null ? null : hashToken(letters);
}

function repeated(ids: readonly string[]): string | undefined {
  const seen = new Set<string>();
  return ids.find((id) => seen.size === seen.add(id).size);
}

/**
 * What the core's book reader leaves to the server, and its delivery reader refuses: each id once, as a teacher's code
 * and a phone's records follow it, and no session past the day's last slot.
 */
export function bookProblem(book: SchoolBook): string | null {
  const teacher = repeated(book.teachers.map(({ id }) => id));
  if (teacher !== undefined) return `teacher ${teacher} appears twice`;
  const klass = repeated(book.classes.map(({ id }) => id));
  if (klass !== undefined) return `class ${klass} appears twice`;
  const session = repeated(book.week.map(({ id }) => id));
  if (session !== undefined) return `session ${session} appears twice`;
  for (const { id, pupils } of book.classes) {
    const pupil = repeated(pupils.map((one) => one.id));
    if (pupil !== undefined) return `pupil ${pupil} appears twice in class ${id}`;
  }
  const late = book.week.find(({ slot }) => slot.index > MAX_SLOT_INDEX);
  return late === undefined ? null : `session ${late.id} is past the day's last slot`;
}

/** The book as it is kept: each teacher keeps the code they have, or gets a new one; a code sent along is ignored. */
export function withCodes(book: SchoolBook, before: SchoolBook, mint: () => string): SchoolBook {
  const held = new Map(before.teachers.map((teacher) => [teacher.id, teacher.code]));
  return { ...book, teachers: book.teachers.map((one) => ({ ...one, code: held.get(one.id) ?? mint() })) };
}

/** The book with one teacher's code replaced, or null with no such teacher. */
export function withNewCode(book: SchoolBook, teacher: string, code: string): SchoolBook | null {
  if (!book.teachers.some(({ id }) => id === teacher)) return null;
  return { ...book, teachers: book.teachers.map((one) => (one.id === teacher ? { ...one, code } : one)) };
}

/** Which codes a saved book ends and which it starts. */
export function joinChanges(before: SchoolBook, after: SchoolBook): JoinChanges {
  const kept = new Set(before.teachers.map(({ id }) => id));
  const staying = new Set(after.teachers.map(({ id }) => id));
  return {
    gone: [...kept].filter((id) => !staying.has(id)),
    fresh: after.teachers
      .filter(({ id }) => !kept.has(id))
      .map(({ id, code }) => ({ teacher: id, hash: joiningHash(code!)! })),
  };
}

/** The server's date. */
export const dayOf = (now: number): string => new Date(now).toISOString().slice(0, 10);
