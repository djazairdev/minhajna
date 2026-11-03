// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' view is made of (#618, answer 655): the fingerprint,
// exactly as the README describes its bytes, following every file's path and
// bytes and nothing else, null for a folder it cannot read or one holding a
// link, and the running server's worked out as it loaded; and the PostgreSQL
// probe: the archive setting read in one transaction with PostgreSQL's own
// statement timeout, a database that refuses, answers oddly or is too slow
// said to be failing, and, with TEST_DATABASE_URL, a real database.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { BUILT, FINGERPRINT, fingerprintOf, readFingerprint } from '../src/admin/fingerprint.js';
import { PostgresProbe } from '../src/admin/system-probe.js';
import { PrismaStores } from '../src/storage/prisma-stores.js';
import { emptyDatabase, url } from './store-kinds.js';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe("the server's fingerprint", () => {
  let folder: string;

  before(() => {
    folder = mkdtempSync(join(tmpdir(), 'minhajna-fingerprint-'));
    mkdirSync(join(folder, 'admin'));
    writeFileSync(join(folder, 'main.js'), 'export {};\n');
    writeFileSync(join(folder, 'admin', 'a.js'), 'export const a = 1;\n');
  });

  after(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  const of = () => fingerprintOf(pathToFileURL(`${folder}/`));

  it('is the SHA-256 of each path and its bytes, as the README says', () => {
    const list = `admin/a.js\n${sha256('export const a = 1;\n')}\nmain.js\n${sha256('export {};\n')}\n`;
    assert.equal(of(), sha256(list));
  });

  it("follows every file's path and bytes, and nothing else", () => {
    const first = of();
    assert.equal(of(), first);
    writeFileSync(join(folder, 'admin', 'a.js'), 'export const a = 2;\n');
    const changed = of();
    assert.notEqual(changed, first);
    rmSync(join(folder, 'admin', 'a.js'));
    writeFileSync(join(folder, 'admin', 'b.js'), 'export const a = 2;\n');
    const moved = of();
    assert.notEqual(moved, changed);
    mkdirSync(join(folder, 'empty'));
    assert.equal(of(), moved);
  });

  it('is null for a folder it cannot read, or one holding a link', () => {
    assert.equal(readFingerprint(pathToFileURL(`${folder}/nowhere/`)), null);
    symlinkSync(join(folder, 'main.js'), join(folder, 'linked.js'));
    try {
      assert.equal(readFingerprint(pathToFileURL(`${folder}/`)), null);
    } finally {
      rmSync(join(folder, 'linked.js'));
    }
  });

  it("is the running server's own, worked out as it loaded", () => {
    assert.equal(FINGERPRINT, fingerprintOf(BUILT));
  });
});

describe('the PostgreSQL probe', () => {
  /** A made-up client whose transaction gives the rows, recording what it was asked. */
  function client(answer: () => Promise<unknown>) {
    const asked: string[] = [];
    const batched: unknown[] = [];
    const query = (parts: TemplateStringsArray, ...values: unknown[]) => {
      const text = String.raw(parts, ...values.map(() => '?'));
      asked.push(text);
      return text;
    };
    const transaction = (queries: unknown) => {
      batched.push(queries);
      return answer();
    };
    return { asked, batched, made: { $queryRaw: query, $transaction: transaction } as never };
  }

  it("reads the database's archive setting in one transaction, under PostgreSQL's own timeout", async () => {
    for (const [mode, archive] of [
      ['on', 'on'],
      ['always', 'on'],
      ['off', 'off'],
    ] as const) {
      const { asked, batched, made } = client(() => Promise.resolve([[{ set_config: '50' }], [{ archive: mode }]]));
      assert.deepEqual(await new PostgresProbe(made, 50).check(), { storage: 'postgresql', database: 'ok', archive });
      assert.deepEqual(asked, [
        "SELECT set_config('statement_timeout', ?, true)",
        "SELECT current_setting('archive_mode') AS archive",
      ]);
      assert.deepEqual(batched, [asked]);
    }
  });

  it('says the database is failing when it refuses, answers oddly or is too slow', async () => {
    const failing = { storage: 'postgresql', database: 'failing' };
    for (const answer of [
      () => Promise.reject(new Error('down')),
      () => Promise.resolve([[], []]),
      () => Promise.resolve([[], [{ archive: 1 }]]),
      () => new Promise(() => undefined),
    ]) {
      assert.deepEqual(await new PostgresProbe(client(answer).made, 50).check(), failing);
    }
  });

  it('reads a real database', { skip: url === undefined }, async () => {
    await emptyDatabase();
    const stores = new PrismaStores(url!);
    try {
      const state = await new PostgresProbe(stores.client).check();
      assert.equal(state.storage, 'postgresql');
      assert.equal(state.storage === 'postgresql' && state.database, 'ok');
      assert.ok(state.storage === 'postgresql' && state.database === 'ok' && ['on', 'off'].includes(state.archive));
    } finally {
      await stores.close();
    }
  });
});
