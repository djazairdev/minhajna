// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The committed SQL migrations (#542), applied to a real PostgreSQL named
// by TEST_DATABASE_URL, whose database name must end in _test since every
// test empties it. Without it these tests are skipped; CI always sets it.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { after, before, beforeEach, describe, it } from 'node:test';
import pg from 'pg';
import { applyMigrations, committedMigrations, MIGRATIONS } from '../src/storage/migrations.js';

const url = process.env['TEST_DATABASE_URL'];
const skip = url ? false : 'TEST_DATABASE_URL is not set';

async function tables(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ name: string }>(
    `SELECT table_schema || '.' || table_name AS name FROM information_schema.tables
     WHERE table_schema IN ('public', 'minhajna_meta') ORDER BY 1`,
  );
  return rows.map((row) => row.name);
}

function folderOf(migrations: Record<string, string>): URL {
  const folder = mkdtempSync(join(tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(migrations)) {
    mkdirSync(join(folder, name));
    writeFileSync(join(folder, name, 'migration.sql'), sql);
  }
  return pathToFileURL(`${folder}/`);
}

describe('the committed migrations', { skip }, () => {
  const client = new pg.Client({ connectionString: url });

  before(async () => {
    assert.match(new URL(url!).pathname, /_test$/, 'TEST_DATABASE_URL must name a database ending in _test');
    await client.connect();
  });

  beforeEach(async () => {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS minhajna_meta CASCADE');
    await client.query('CREATE SCHEMA public');
  });

  after(async () => {
    await client.end();
  });

  it('applies every committed migration once, in order of name', async () => {
    const names = committedMigrations().map((one) => one.name);
    assert.deepEqual(names, [...names].sort());
    assert.deepEqual(await applyMigrations(client), names);
    assert.deepEqual(await applyMigrations(client), []);
    assert.deepEqual(await tables(client), ['minhajna_meta.migration', 'public.batch', 'public.space', 'public.world']);
  });

  it('applies each migration once when two servers start together', async () => {
    const other = new pg.Client({ connectionString: url });
    await other.connect();
    try {
      const [mine, theirs] = await Promise.all([applyMigrations(client), applyMigrations(other)]);
      assert.deepEqual(
        [...mine, ...theirs].sort(),
        committedMigrations().map((one) => one.name),
      );
    } finally {
      await other.end();
    }
  });

  it("erases a world's spaces and batches with it, leaving no row", async () => {
    await applyMigrations(client);
    await client.query(
      `INSERT INTO world VALUES ('K7QF3', 'c2VhbGVk', '2026-12-01', '{2026-12-06}', $1, $1, '2026-12-07')`,
      ['0'.repeat(64)],
    );
    await client.query(`INSERT INTO space ("worldId", id, kind) VALUES ('K7QF3', 'national', 'national')`);
    await client.query(
      `INSERT INTO batch ("worldId", "spaceId", seq, stream, number, bytes)
       VALUES ('K7QF3', 'national', 1, 'c3RyZWFtLW9mLWRlbW8', 0, '\\x00')`,
    );
    await client.query(`DELETE FROM world WHERE id = 'K7QF3'`);
    for (const table of ['world', 'space', 'batch']) {
      const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
      assert.equal(rows[0]?.n, 0, table);
    }
  });

  it('leaves the database as it was when a migration fails, and does not record it', async () => {
    const folder = folderOf({
      '0001_good': 'CREATE TABLE made_up (id int);',
      '0002_bad': 'CREATE TABLE half_made (id int); SELECT no_such_function();',
    });
    await assert.rejects(applyMigrations(client, folder));
    assert.deepEqual(await tables(client), ['minhajna_meta.migration', 'public.made_up']);
    const { rows } = await client.query<{ name: string }>('SELECT name FROM minhajna_meta.migration');
    assert.deepEqual(
      rows.map((row) => row.name),
      ['0001_good'],
    );
  });

  it('refuses a migration whose file changed after it was applied', async () => {
    const folder = folderOf({ '0001_good': 'CREATE TABLE made_up (id int);' });
    assert.deepEqual(await applyMigrations(client, folder), ['0001_good']);
    writeFileSync(new URL('0001_good/migration.sql', folder), 'CREATE TABLE made_up (id bigint);');
    await assert.rejects(applyMigrations(client, folder), /changed after it was applied/);
  });
});

describe('the migration files', () => {
  it('each carry their licence and say how they were made', () => {
    for (const { name } of committedMigrations()) {
      const sql = readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS), 'utf8');
      assert.match(sql, /^-- SPDX-FileCopyrightText: /, name);
      assert.match(sql, /prisma migrate diff/, name);
    }
  });

  it('refuses a file that opens or closes its own transaction', () => {
    for (const sql of [
      'BEGIN;\nCREATE TABLE t (id int);\nCOMMIT;',
      'CREATE TABLE t (id int);\n  commit ;',
      'BEGIN WORK;\nCREATE TABLE t (id int);',
      'CREATE TABLE t (id int);\nABORT;',
    ]) {
      assert.throws(() => committedMigrations(folderOf({ '0001_own': sql })), /its own transaction/);
    }
    const body = 'CREATE FUNCTION f() RETURNS int AS $$\nBEGIN\n  RETURN 1;\nEND;\n$$ LANGUAGE plpgsql;';
    assert.equal(committedMigrations(folderOf({ '0001_function': body })).length, 1);
  });
});
