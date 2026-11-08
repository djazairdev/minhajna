// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up reference list and school book for the directory's tests, and the
// server to try them on. Every name here is made up.

import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import type { ReferenceDraft } from '../src/directory/core/directory.js';
import type { SchoolBook } from '../src/directory/core/directory-book.js';
import { MemoryDirectoryStore } from '../src/directory/directory-store.js';

export const SCHOOL = 'sch-01';

const commune = { code: '1601', name: { ar: 'بلدية مثال', fr: 'Commune Exemple' } };

export const DRAFT: ReferenceDraft = {
  levels: [{ code: 'cem', options: [{ code: 'math', subjects: ['math'] }] }],
  schools: [
    { id: SCHOOL, name: 'متوسطة مثال', level: 'cem', wilaya: '16', commune },
    { id: 'sch-02', name: 'متوسطة أخرى', level: 'cem', wilaya: '16', commune },
  ],
};

export const BOOK: SchoolBook = {
  format: 1,
  teachers: [
    { id: 't-1', name: 'أستاذ مثال', option: 'math' },
    { id: 't-2', name: 'أستاذة مثال', option: 'arabic' },
  ],
  classes: [
    {
      id: 'c-1',
      grade: '1am',
      name: '1م1',
      pupils: [{ id: 'p-1', name: 'تلميذ مثال', sex: 'm', registration: 'R-0001' }],
      teachers: { math: 't-1', arabic: 't-2' },
    },
    {
      id: 'c-2',
      grade: '1am',
      name: '1م2',
      pupils: [{ id: 'p-2', name: 'تلميذة مثال', sex: 'f' }],
      teachers: { arabic: 't-2' },
    },
  ],
  week: [
    { id: 's-1', classId: 'c-1', subject: 'math', weekday: 0, slot: { half: 'morning', index: 1 } },
    { id: 's-2', classId: 'c-1', subject: 'arabic', weekday: 0, slot: { half: 'morning', index: 2 } },
    { id: 's-3', classId: 'c-2', subject: 'arabic', weekday: 1, slot: { half: 'afternoon', index: 1 } },
  ],
};

/** The book with only the first teacher left. */
export const withoutSecond = (book: SchoolBook): SchoolBook => ({
  ...book,
  teachers: book.teachers.slice(0, 1),
});

export const OPEN = { perAddress: 1000, total: 1000, windowMs: 60_000 };
const NOW = Date.UTC(2026, 10, 7, 12);

export const LIST_CODE = 'made-up-list-code';
export const SCHOOL_CODE = 'made-up-school-code';

export interface Answer {
  status: number;
  body: Record<string, unknown>;
  noStore: boolean;
}

/** The server with a directory of its own, and how a test talks to it. */
export class DirectoryServer {
  base = '';
  private app: NestNodeApplication | undefined;

  async open(options: Parameters<typeof createApp>[1] = {}): Promise<void> {
    await this.close();
    this.app = await createApp(false, {
      directory: new MemoryDirectoryStore(),
      joins: OPEN,
      relay: OPEN,
      now: () => NOW,
      ...options,
    });
    await this.app.listen(0, '127.0.0.1');
    this.base = await this.app.getUrl();
  }

  async close(): Promise<void> {
    await this.app?.close();
    this.app = undefined;
  }

  ask = async (method: string, path: string, body?: unknown, code?: string): Promise<Answer> => {
    const res = await fetch(`${this.base}/directory/${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(code === undefined ? {} : { authorization: `Bearer ${code}` }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: res.status,
      body: (await res.json()) as Record<string, unknown>,
      noStore: res.headers.get('cache-control') === 'no-store',
    };
  };

  /** A list published and a school claimed. */
  published = async (): Promise<void> => {
    await this.ask('POST', 'reference/code', { code: LIST_CODE });
    await this.ask('PUT', 'reference/draft', { expected: 0, draft: DRAFT }, LIST_CODE);
    await this.ask('POST', 'reference/publish', { expected: 1 }, LIST_CODE);
    await this.ask('POST', `schools/${SCHOOL}/code`, { code: SCHOOL_CODE });
  };

  /** That, with a book saved; answers the teachers' joining codes. */
  saved = async (): Promise<string[]> => {
    await this.published();
    const { body } = await this.ask('PUT', `schools/${SCHOOL}/book`, { expected: 0, book: BOOK }, SCHOOL_CODE);
    return (body['book'] as typeof BOOK).teachers.map(({ code }) => code!);
  };
}
