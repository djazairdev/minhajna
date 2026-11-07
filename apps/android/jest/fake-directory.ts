// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up directory on a made-up demo server, for the dashboard's tests: the
// routes the dashboard calls, as the shared spec has them, in memory, reached
// through the global fetch. It can wake slowly, answering 503 for its first
// requests. Every school and name is made up.

import {
  nextReferenceVersion,
  readReferenceDraft,
  readSchoolBook,
  type ReferenceDraft,
  type ReferenceList,
  type SchoolBook,
} from '@minhajna/core';

type Answer = readonly [status: number, body: unknown];

const EMPTY_BOOK: SchoolBook = { format: 1, teachers: [], classes: [], week: [] };

/** The directory the tests read and change. */
export class FakeDirectory {
  referenceCode: string | null = null;
  revision = 0;
  draft: ReferenceDraft | null = null;
  versions: ReferenceList[] = [];
  readonly schoolCodes = new Map<string, string>();
  readonly books = new Map<string, { revision: number; book: SchoolBook }>();
  /** How many requests still answer 503. */
  asleep = 0;
  /** A status every request answers until cleared. */
  failing: number | null = null;
  /** Each request's method and path, in order. */
  readonly seen: string[] = [];
  private issued = 0;

  /** Answers the global fetch from now on. */
  install() {
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => this.answer(input as string, init));
  }

  private latest() {
    return this.versions.at(-1) ?? null;
  }

  private async answer(address: string, init?: RequestInit): Promise<Response> {
    const path = address.replace('https://minhajna-demo.djazair.dev', '');
    const method = init?.method ?? 'GET';
    this.seen.push(`${method} ${path}`);
    await Promise.resolve();
    if (this.failing !== null) return this.reply([this.failing, {}]);
    if (this.asleep > 0) {
      this.asleep -= 1;
      return new Response('{}', { status: 503, headers: { 'Retry-After': '0' } });
    }
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const bearer = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? null;
    return this.reply(
      path.startsWith('/directory/reference')
        ? this.reference(path, method, body, bearer)
        : this.school(path, method, body, bearer),
    );
  }

  private reply([status, body]: Answer) {
    return new Response(JSON.stringify(body), { status });
  }

  private reference(path: string, method: string, body: Record<string, unknown>, bearer: string | null): Answer {
    if (path === '/directory/reference') return this.latest() === null ? [404, {}] : [200, this.latest()];
    if (path.endsWith('/claimed')) return [200, { claimed: this.referenceCode !== null }];
    if (path.endsWith('/code') && method === 'POST') {
      if (this.referenceCode !== null && body.old !== this.referenceCode) return [403, {}];
      this.referenceCode = String(body.code);
      return [200, { claimed: true }];
    }
    if (bearer !== this.referenceCode) return [403, {}];
    if (path.endsWith('/state')) {
      const versions = [...this.versions].reverse().map(({ version, published }) => ({ version, published }));
      const published = this.latest()?.version ?? null;
      return [200, { revision: this.revision, draft: this.draft, published, versions }];
    }
    if (path.endsWith('/draft')) {
      if (body.expected !== this.revision) return [409, {}];
      const draft = readReferenceDraft(body.draft);
      if (typeof draft === 'string') return [400, { message: draft }];
      this.draft = draft;
      this.revision += 1;
      return [200, { revision: this.revision }];
    }
    if (path.endsWith('/publish')) {
      if (body.expected !== this.revision) return [409, {}];
      if (this.draft === null) return [400, { message: 'nothing to publish' }];
      return this.publishing(this.draft);
    }
    const old = this.versions.find((one) => one.version === body.version);
    if (old === undefined) return [404, {}];
    this.draft = { levels: old.levels, schools: old.schools };
    this.revision += 1;
    return this.publishing(this.draft);
  }

  private publishing(draft: ReferenceDraft): Answer {
    const version = nextReferenceVersion(this.latest()?.version ?? null, 2029);
    const published = '2029-11-12' as ReferenceList['published'];
    this.versions.push({ format: 1, version, published, ...draft });
    return [200, { version, published }];
  }

  private school(path: string, method: string, body: Record<string, unknown>, bearer: string | null): Answer {
    const [, , , id, rest, teacher] = path.split('/');
    if (id === undefined || this.latest()?.schools.some((one) => one.id === id) !== true) return [404, {}];
    if (rest === 'claimed') return [200, { claimed: this.schoolCodes.has(id) }];
    if (rest === 'code') {
      if (this.schoolCodes.has(id) && body.old !== this.schoolCodes.get(id)) return [403, {}];
      this.schoolCodes.set(id, String(body.code));
      return [200, { claimed: true }];
    }
    if (bearer !== this.schoolCodes.get(id)) return [403, {}];
    const held = this.books.get(id) ?? { revision: 0, book: EMPTY_BOOK };
    if (rest === 'teachers') return this.renew(id, held, teacher ?? '');
    if (method === 'GET') return [200, held];
    if (body.expected !== held.revision) return [409, {}];
    const book = readSchoolBook(body.book);
    if (typeof book === 'string') return [400, { message: book }];
    const teachers = book.teachers.map((one) => ({
      ...one,
      code: held.book.teachers.find((other) => other.id === one.id)?.code ?? this.newCode(),
    }));
    const saved = { revision: held.revision + 1, book: { ...book, teachers } };
    this.books.set(id, saved);
    return [200, saved];
  }

  private renew(id: string, held: { revision: number; book: SchoolBook }, teacher: string): Answer {
    if (!held.book.teachers.some((one) => one.id === teacher)) return [404, {}];
    const code = this.newCode();
    const teachers = held.book.teachers.map((one) => (one.id === teacher ? { ...one, code } : one));
    this.books.set(id, { ...held, book: { ...held.book, teachers } });
    return [200, { code }];
  }

  private newCode() {
    this.issued += 1;
    return `ABCD2345EFGH${String(this.issued).padStart(4, '7')}`;
  }
}
