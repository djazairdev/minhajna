// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory in PostgreSQL (answers 802 to 809), through Prisma's client,
// under the memory store's rules (directory-store.ts). Documents and versions
// are JSON kept as text, which holds any name as it came. A change that depends
// on a document's revision or codes locks its row, so a save and a renewal take
// turns, under inTurn's waits. The newest list is held in memory while it is
// the newest, as each request about a school reads it. No foreign key ties any
// of this to a world.

import type { ReferenceDraft, ReferenceList } from '../directory/core/directory.js';
import type { SchoolBook } from '../directory/core/directory-book.js';
import { EMPTY_BOOK, joinChanges, joiningHash, withCodes, withNewCode } from '../directory/directory-rules.js';
import {
  MAX_DIRECTORY_BOOKS,
  MAX_DIRECTORY_VERSIONS,
  REFERENCE,
  listOf,
  nextVersion,
  schoolDocument,
  type DirectoryStore,
  type Joining,
  type KeptBook,
  type ReferenceVersion,
  type SetCode,
} from '../directory/directory-store.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { toDate, toDay } from './days.js';
import { inTurn, type StoreOptions, type Transaction } from './in-turn.js';

interface Locked {
  readonly revision: number;
  readonly body: string | null;
}

const NEWEST_FIRST = { seq: 'desc' } as const;

const parsed = <T>(text: string): T => JSON.parse(text) as T;

const bookIn = (body: string | null): SchoolBook => (body === null ? EMPTY_BOOK : parsed<SchoolBook>(body));

/** Locks the document's row until the transaction ends. */
async function lock(tx: Transaction, id: string): Promise<Locked | undefined> {
  const rows = await tx.$queryRaw<Locked[]>`
    SELECT revision, body FROM directory_document WHERE id = ${id} FOR NO KEY UPDATE`;
  return rows[0];
}

export class PrismaDirectoryStore implements DirectoryStore {
  private held: ReferenceList | undefined;

  constructor(
    private readonly client: PrismaClient,
    private readonly options: StoreOptions = {},
    private readonly most = MAX_DIRECTORY_BOOKS,
    private readonly versionsKept = MAX_DIRECTORY_VERSIONS,
  ) {}

  async codeHash(id: string): Promise<string | undefined> {
    const row = await this.client.directoryDocument.findUnique({ where: { id }, select: { codeHash: true } });
    return row?.codeHash;
  }

  async setCode(id: string, codeHash: string, old: string | null): Promise<SetCode> {
    if (old !== null) {
      const { count } = await this.client.directoryDocument.updateMany({
        where: { id, codeHash: old },
        data: { codeHash },
      });
      if (count === 1) return 'set';
    }
    if ((await this.codeHash(id)) !== undefined) return 'refused';
    try {
      await this.client.directoryDocument.create({ data: { id, codeHash } });
      return 'set';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'refused';
      throw error;
    }
  }

  async draft(): Promise<{ revision: number; draft: ReferenceDraft | null }> {
    const row = await this.client.directoryDocument.findUnique({ where: { id: REFERENCE } });
    return { revision: row?.revision ?? 0, draft: row?.body ? parsed<ReferenceDraft>(row.body) : null };
  }

  saveDraft(expected: number, draft: ReferenceDraft): Promise<number | 'stale'> {
    return inTurn(this.client, this.options, async (tx) => {
      const row = await lock(tx, REFERENCE);
      if (row === undefined || row.revision !== expected) return 'stale';
      const revision = expected + 1;
      await tx.directoryDocument.update({ where: { id: REFERENCE }, data: { revision, body: JSON.stringify(draft) } });
      return revision;
    });
  }

  publish(expected: number, day: string): Promise<ReferenceVersion | 'stale' | 'empty'> {
    return inTurn(this.client, this.options, async (tx) => {
      const row = await lock(tx, REFERENCE);
      if (row === undefined || row.revision !== expected) return 'stale';
      if (row.body === null) return 'empty';
      return this.add(tx, parsed<ReferenceDraft>(row.body), day);
    });
  }

  republish(version: string, day: string): Promise<ReferenceVersion | 'missing'> {
    return inTurn(this.client, this.options, async (tx) => {
      if ((await lock(tx, REFERENCE)) === undefined) return 'missing';
      const old = await tx.directoryVersion.findUnique({ where: { version } });
      if (old === null) return 'missing';
      const { levels, schools } = parsed<ReferenceList>(old.list);
      const draft = { levels, schools };
      await tx.directoryDocument.update({
        where: { id: REFERENCE },
        data: { revision: { increment: 1 }, body: JSON.stringify(draft) },
      });
      return this.add(tx, draft, day);
    });
  }

  async versions(): Promise<ReferenceVersion[]> {
    const rows = await this.client.directoryVersion.findMany({
      orderBy: NEWEST_FIRST,
      select: { version: true, published: true },
    });
    return rows.map(({ version, published }) => ({ version, published: toDay(published) }));
  }

  async latest(): Promise<ReferenceList | undefined> {
    const newest = await this.client.directoryVersion.findFirst({ orderBy: NEWEST_FIRST, select: { version: true } });
    if (newest === null) return undefined;
    if (this.held?.version !== newest.version) {
      const row = await this.client.directoryVersion.findUnique({ where: { version: newest.version } });
      this.held = row === null ? undefined : parsed<ReferenceList>(row.list);
    }
    return this.held;
  }

  async book(school: string): Promise<KeptBook> {
    const row = await this.client.directoryDocument.findUnique({ where: { id: schoolDocument(school) } });
    return { revision: row?.revision ?? 0, book: bookIn(row?.body ?? null) };
  }

  saveBook(
    school: string,
    expected: number,
    book: SchoolBook,
    mint: () => string,
  ): Promise<KeptBook | 'stale' | 'full'> {
    const id = schoolDocument(school);
    return inTurn(this.client, this.options, async (tx) => {
      const row = await lock(tx, id);
      if (row === undefined || row.revision !== expected) return 'stale';
      if (row.body === null && (await this.booksHeld(tx)) >= this.most) return 'full';
      const before = bookIn(row.body);
      const after = withCodes(book, before, mint);
      const { gone, fresh } = joinChanges(before, after);
      await tx.directoryJoin.deleteMany({ where: { schoolId: school, teacherId: { in: [...gone] } } });
      await tx.directoryJoin.createMany({
        data: fresh.map(({ teacher, hash }) => ({ codeHash: hash, schoolId: school, teacherId: teacher })),
      });
      const revision = expected + 1;
      await tx.directoryDocument.update({ where: { id }, data: { revision, body: JSON.stringify(after) } });
      return { revision, book: after };
    });
  }

  renewCode(school: string, teacher: string, code: string): Promise<boolean> {
    const id = schoolDocument(school);
    return inTurn(this.client, this.options, async (tx) => {
      const row = await lock(tx, id);
      const after = row?.body ? withNewCode(bookIn(row.body), teacher, code) : null;
      if (after === null) return false;
      await tx.directoryJoin.deleteMany({ where: { schoolId: school, teacherId: teacher } });
      await tx.directoryJoin.create({ data: { codeHash: joiningHash(code)!, schoolId: school, teacherId: teacher } });
      await tx.directoryDocument.update({ where: { id }, data: { body: JSON.stringify(after) } });
      return true;
    });
  }

  async joining(codeHash: string): Promise<Joining | undefined> {
    const join = await this.client.directoryJoin.findUnique({ where: { codeHash } });
    if (join === null) return undefined;
    const row = await this.client.directoryDocument.findUnique({ where: { id: schoolDocument(join.schoolId) } });
    return row?.body ? { school: join.schoolId, teacher: join.teacherId, book: bookIn(row.body) } : undefined;
  }

  private booksHeld(tx: Transaction): Promise<number> {
    return tx.directoryDocument.count({ where: { NOT: [{ id: REFERENCE }, { body: null }] } });
  }

  private async add(tx: Transaction, draft: ReferenceDraft, day: string): Promise<ReferenceVersion> {
    const newest = await tx.directoryVersion.findFirst({ orderBy: NEWEST_FIRST, select: { version: true } });
    const version = nextVersion(newest?.version ?? null, day);
    const list = JSON.stringify(listOf(draft, version, day));
    await tx.directoryVersion.create({ data: { version, published: toDate(day), list } });
    const oldestKept = await tx.directoryVersion.findFirst({
      orderBy: NEWEST_FIRST,
      skip: this.versionsKept - 1,
      select: { seq: true },
    });
    if (oldestKept !== null) await tx.directoryVersion.deleteMany({ where: { seq: { lt: oldestKept.seq } } });
    return { version, published: day };
  }
}
