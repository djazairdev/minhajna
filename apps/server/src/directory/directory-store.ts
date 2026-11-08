// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the server keeps of the directory (answers 802 to 809), outside any
// world, so the sweeper never touches it: the Ministry's list and each school's
// book as documents with a revision and their edit code's hash, each published
// version of the list, and a joining code's hash with the school and teacher it
// opens. A document exists once its code is set, and only a school in the
// published list may set one, so each version of the list bounds them. At most
// MAX_DIRECTORY_BOOKS schools have a saved book, about 1 GB at their largest,
// and a school's first save past that is refused; the newest
// MAX_DIRECTORY_VERSIONS versions are kept, the oldest dropped, so the
// Ministry can always publish. In memory here, and in PostgreSQL in
// prisma-directory.ts, where books saved at the same moment may pass the cap by
// a few. A joining code has 80 random bits, so two are never drawn alike.

import { nextReferenceVersion, type ReferenceDraft, type ReferenceList } from './core/directory.js';
import type { SchoolBook } from './core/directory-book.js';
import { DIRECTORY_FORMAT } from './core/directory.js';
import { EMPTY_BOOK, joinChanges, joiningHash, withCodes, withNewCode } from './directory-rules.js';

export const DIRECTORY_STORE = Symbol('DirectoryStore');
export const MAX_DIRECTORY_BOOKS = 1000;
export const MAX_DIRECTORY_VERSIONS = 100;

/** The Ministry's list's document; a school's is schoolDocument's. */
export const REFERENCE = 'reference';
export const schoolDocument = (school: string): string => `school:${school}`;

export interface ReferenceVersion {
  readonly version: string;
  readonly published: string;
}

export interface KeptBook {
  readonly revision: number;
  readonly book: SchoolBook;
}

export interface Joining {
  readonly school: string;
  readonly teacher: string;
  readonly book: SchoolBook;
}

export type SetCode = 'set' | 'refused';

export interface DirectoryStore {
  /** The hash of a document's edit code, with none set yet undefined. */
  codeHash(document: string): Promise<string | undefined>;
  /** Sets the code, if none is set or the hash of the one set is `old`. */
  setCode(document: string, hash: string, old: string | null): Promise<SetCode>;
  draft(): Promise<{ revision: number; draft: ReferenceDraft | null }>;
  saveDraft(expected: number, draft: ReferenceDraft): Promise<number | 'stale'>;
  /** Publishes the draft as the next version on this day, leaving the revision as it was. */
  publish(expected: number, day: string): Promise<ReferenceVersion | 'stale' | 'empty'>;
  /** Publishes an old version as the next one on this day, and makes it the draft, in a new revision. */
  republish(version: string, day: string): Promise<ReferenceVersion | 'missing'>;
  /** The versions, newest first. */
  versions(): Promise<ReferenceVersion[]>;
  /** The newest version. */
  latest(): Promise<ReferenceList | undefined>;
  /** The school's book, an empty one at revision 0 before its first save. */
  book(school: string): Promise<KeptBook>;
  /** Saves the book, each teacher keeping their code or given one from `mint`; a teacher gone loses theirs. */
  saveBook(
    school: string,
    expected: number,
    book: SchoolBook,
    mint: () => string,
  ): Promise<KeptBook | 'stale' | 'full'>;
  /** Replaces a teacher's joining code, leaving the revision as it was; false with no such teacher. */
  renewCode(school: string, teacher: string, code: string): Promise<boolean>;
  /** The school, teacher and book a joining code's hash opens. */
  joining(hash: string): Promise<Joining | undefined>;
}

/** The list a version of it is published as. */
export function listOf(draft: ReferenceDraft, version: string, published: string): ReferenceList {
  return { format: DIRECTORY_FORMAT, version, published, levels: draft.levels, schools: draft.schools };
}

/** The next version after the newest one, on this day. */
export const nextVersion = (newest: string | null, day: string): string =>
  nextReferenceVersion(newest, Number(day.slice(0, 4)));

interface Held {
  codeHash: string;
  revision: number;
  body: ReferenceDraft | SchoolBook | null;
}

export class MemoryDirectoryStore implements DirectoryStore {
  private readonly documents = new Map<string, Held>();
  private readonly lists: ReferenceList[] = [];
  private readonly joins = new Map<string, { school: string; teacher: string }>();

  constructor(
    private readonly most = MAX_DIRECTORY_BOOKS,
    private readonly versionsKept = MAX_DIRECTORY_VERSIONS,
  ) {}

  codeHash(document: string): Promise<string | undefined> {
    return Promise.resolve(this.documents.get(document)?.codeHash);
  }

  setCode(document: string, hash: string, old: string | null): Promise<SetCode> {
    const held = this.documents.get(document);
    if (held !== undefined) {
      if (held.codeHash !== old) return Promise.resolve('refused');
      held.codeHash = hash;
      return Promise.resolve('set');
    }
    this.documents.set(document, { codeHash: hash, revision: 0, body: null });
    return Promise.resolve('set');
  }

  draft(): Promise<{ revision: number; draft: ReferenceDraft | null }> {
    const held = this.documents.get(REFERENCE);
    return Promise.resolve({ revision: held?.revision ?? 0, draft: (held?.body as ReferenceDraft | null) ?? null });
  }

  saveDraft(expected: number, draft: ReferenceDraft): Promise<number | 'stale'> {
    const held = this.documents.get(REFERENCE);
    if (held === undefined || held.revision !== expected) return Promise.resolve('stale');
    held.revision += 1;
    held.body = draft;
    return Promise.resolve(held.revision);
  }

  publish(expected: number, day: string): Promise<ReferenceVersion | 'stale' | 'empty'> {
    const held = this.documents.get(REFERENCE);
    if (held === undefined || held.revision !== expected) return Promise.resolve('stale');
    if (held.body === null) return Promise.resolve('empty');
    return Promise.resolve(this.add(held.body as ReferenceDraft, day));
  }

  republish(version: string, day: string): Promise<ReferenceVersion | 'missing'> {
    const old = this.lists.find((list) => list.version === version);
    const held = this.documents.get(REFERENCE);
    if (old === undefined || held === undefined) return Promise.resolve('missing');
    held.revision += 1;
    held.body = { levels: old.levels, schools: old.schools };
    return Promise.resolve(this.add(old, day));
  }

  versions(): Promise<ReferenceVersion[]> {
    const newestFirst = [...this.lists].reverse();
    return Promise.resolve(newestFirst.map(({ version, published }) => ({ version, published })));
  }

  latest(): Promise<ReferenceList | undefined> {
    return Promise.resolve(this.lists.at(-1));
  }

  book(school: string): Promise<KeptBook> {
    const held = this.documents.get(schoolDocument(school));
    return Promise.resolve({ revision: held?.revision ?? 0, book: (held?.body as SchoolBook | null) ?? EMPTY_BOOK });
  }

  saveBook(
    school: string,
    expected: number,
    book: SchoolBook,
    mint: () => string,
  ): Promise<KeptBook | 'stale' | 'full'> {
    const held = this.documents.get(schoolDocument(school));
    if (held === undefined || held.revision !== expected) return Promise.resolve('stale');
    const books = [...this.documents].filter(([id, one]) => id !== REFERENCE && one.body !== null).length;
    if (held.body === null && books >= this.most) return Promise.resolve('full');
    const before = (held.body as SchoolBook | null) ?? EMPTY_BOOK;
    const after = withCodes(book, before, mint);
    const { gone, fresh } = joinChanges(before, after);
    for (const [hash, join] of this.joins) {
      if (join.school === school && gone.includes(join.teacher)) this.joins.delete(hash);
    }
    for (const { teacher, hash } of fresh) this.joins.set(hash, { school, teacher });
    held.revision += 1;
    held.body = after;
    return Promise.resolve({ revision: held.revision, book: after });
  }

  renewCode(school: string, teacher: string, code: string): Promise<boolean> {
    const held = this.documents.get(schoolDocument(school));
    const after = held?.body ? withNewCode(held.body as SchoolBook, teacher, code) : null;
    if (held === undefined || after === null) return Promise.resolve(false);
    for (const [hash, join] of this.joins) {
      if (join.school === school && join.teacher === teacher) this.joins.delete(hash);
    }
    this.joins.set(joiningHash(code)!, { school, teacher });
    held.body = after;
    return Promise.resolve(true);
  }

  joining(hash: string): Promise<Joining | undefined> {
    const join = this.joins.get(hash);
    const book = join && (this.documents.get(schoolDocument(join.school))?.body as SchoolBook | null);
    return Promise.resolve(join && book ? { ...join, book } : undefined);
  }

  private add(draft: ReferenceDraft, day: string): ReferenceVersion {
    const version = nextVersion(this.lists.at(-1)?.version ?? null, day);
    this.lists.push(listOf(draft, version, day));
    this.lists.splice(0, Math.max(0, this.lists.length - this.versionsKept));
    return { version, published: day };
  }
}
