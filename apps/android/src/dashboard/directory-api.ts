// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the dashboard asks of the directory (answer 809), through the one client
// that calls it (directory-network.ts), each answer read strictly: what the
// server sends that does not read is said as the network's fault, and nothing
// of it is shown. Edit codes pass through here on their way to the bearer
// header, and stay with the page that typed them.

import {
  isDay,
  readReferenceDraft,
  readReferenceList,
  readSchoolBook,
  type Day,
  type ReferenceDraft,
  type ReferenceList,
  type SchoolBook,
} from '@minhajna/core';
import { directoryGet, directoryPost, directoryPut, type DirectoryOptions } from '../network/directory-network';

/** The Ministry's list as its page edits it. */
export interface ReferenceState {
  readonly revision: number;
  readonly draft: ReferenceDraft | null;
  readonly published: string | null;
  readonly versions: readonly { readonly version: string; readonly published: Day }[];
}

/** A school's book with the revision it was read at. */
export interface SavedBook {
  readonly revision: number;
  readonly book: SchoolBook;
}

function misread(): Error {
  return Object.assign(new Error('The answer does not read'), { code: 'E_DIRECTORY_NETWORK' });
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw misread();
  return value as Record<string, unknown>;
};

function revisionOf(value: Record<string, unknown>): number {
  if (typeof value.revision !== 'number') throw misread();
  return value.revision;
}

function readDocument<T>(read: (value: unknown) => T | string, value: unknown): T {
  const result = read(value);
  if (typeof result === 'string') throw misread();
  return result;
}

function readVersion(value: unknown): { version: string; published: Day } {
  const { version, published } = asRecord(value);
  if (typeof version !== 'string' || typeof published !== 'string' || !isDay(published)) throw misread();
  return { version, published };
}

const claimedOf = async (answer: Promise<unknown>) => asRecord(await answer).claimed === true;

const schoolPath = (school: string) => `/directory/schools/${encodeURIComponent(school)}`;

/** The published list, or null while nothing is published. */
export async function publishedList(options?: DirectoryOptions): Promise<ReferenceList | null> {
  try {
    return readDocument(readReferenceList, await directoryGet('/directory/reference', undefined, options));
  } catch (error) {
    if ((error as { code?: unknown }).code === 'E_DIRECTORY_MISSING') return null;
    throw error;
  }
}

/** Whether the Ministry's list has its edit code yet. */
export const referenceClaimed = (options?: DirectoryOptions) =>
  claimedOf(directoryGet('/directory/reference/claimed', undefined, options));

/** Sets the Ministry's list's first edit code. */
export const claimReference = (code: string, options?: DirectoryOptions) =>
  directoryPost('/directory/reference/code', { code }, undefined, options);

/** The draft, what is published and every version, for the holder of the code. */
export async function referenceState(code: string, options?: DirectoryOptions): Promise<ReferenceState> {
  const answer = asRecord(await directoryGet('/directory/reference/state', code, options));
  const { draft, published, versions } = answer;
  if (published !== null && typeof published !== 'string') throw misread();
  if (!Array.isArray(versions)) throw misread();
  return {
    revision: revisionOf(answer),
    draft: draft === null ? null : readDocument(readReferenceDraft, draft),
    published,
    versions: versions.map(readVersion),
  };
}

/** Saves the draft over the revision read last, and answers the new one. */
export async function saveDraft(
  code: string,
  expected: number,
  draft: ReferenceDraft,
  options?: DirectoryOptions,
): Promise<number> {
  return revisionOf(asRecord(await directoryPut('/directory/reference/draft', { expected, draft }, code, options)));
}

/** Publishes the draft saved at that revision, and answers the version it became. */
export async function publishDraft(code: string, expected: number, options?: DirectoryOptions) {
  return readVersion(await directoryPost('/directory/reference/publish', { expected }, code, options));
}

/** Publishes an old version again, as a new one and as the draft. */
export async function republish(code: string, version: string, options?: DirectoryOptions) {
  return readVersion(await directoryPost('/directory/reference/republish', { version }, code, options));
}

/** Whether a school has its edit code yet. */
export const schoolClaimed = (school: string, options?: DirectoryOptions) =>
  claimedOf(directoryGet(`${schoolPath(school)}/claimed`, undefined, options));

/** Sets a school's first edit code. */
export const claimSchool = (school: string, code: string, options?: DirectoryOptions) =>
  directoryPost(`${schoolPath(school)}/code`, { code }, undefined, options);

function readSaved(value: unknown): SavedBook {
  const answer = asRecord(value);
  return { revision: revisionOf(answer), book: readDocument(readSchoolBook, answer.book) };
}

/** A school's book, for the holder of its code. */
export async function schoolBook(school: string, code: string, options?: DirectoryOptions): Promise<SavedBook> {
  return readSaved(await directoryGet(`${schoolPath(school)}/book`, code, options));
}

/** Saves a school's book over the revision read last; the answer carries each teacher's joining code. */
export async function saveBook(
  school: string,
  code: string,
  expected: number,
  book: SchoolBook,
  options?: DirectoryOptions,
): Promise<SavedBook> {
  return readSaved(await directoryPut(`${schoolPath(school)}/book`, { expected, book }, code, options));
}

/** A new joining code for a teacher; the old one stops working. */
export async function renewJoiningCode(
  school: string,
  teacher: string,
  code: string,
  options?: DirectoryOptions,
): Promise<string> {
  const path = `${schoolPath(school)}/teachers/${encodeURIComponent(teacher)}/code`;
  const answer = asRecord(await directoryPost(path, {}, code, options));
  if (typeof answer.code !== 'string') throw misread();
  return answer.code;
}
