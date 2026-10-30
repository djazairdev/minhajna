// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Applies the committed SQL migrations (#542, answer 551): every
// prisma/migrations/<name>/migration.sql not yet applied, in the order of
// their names, each in its own transaction with its name and its SHA-256
// recorded in minhajna_meta.migration. That table sits outside the public
// schema, so a diff of the public schema against schema.prisma never sees
// it. A migration already applied whose file has since changed is refused,
// as is a file that opens or closes its own transaction. An advisory lock
// keeps two servers, or a server and psql, from applying the same one. No
// Prisma tool runs here, so a server with no internet applies them, and
// psql alone can too (README.md).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { ClientBase } from 'pg';

export const MIGRATIONS = new URL('../../../prisma/migrations/', import.meta.url);
export const MIGRATION_LOCK = 7_042_542;

const TRANSACTION = /^\s*(BEGIN(\s+(WORK|TRANSACTION))?|COMMIT|ROLLBACK|ABORT|START\s+TRANSACTION)\s*;/im;

export interface Migration {
  readonly name: string;
  readonly sql: string;
  readonly sha256: string;
}

/** The migrations committed in the folder, by name, in order. */
export function committedMigrations(folder: URL = MIGRATIONS): Migration[] {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const sql = readFileSync(new URL(`${name}/migration.sql`, folder), 'utf8');
      if (TRANSACTION.test(sql)) throw new Error(`migration ${name} opens or closes its own transaction`);
      return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') };
    });
}

async function quietly(client: ClientBase, sql: string, values: unknown[] = []): Promise<void> {
  await client.query(sql, values).catch(() => undefined);
}

async function applyOne(client: ClientBase, { name, sql, sha256 }: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO minhajna_meta.migration (name, sha256) VALUES ($1, $2)', [name, sha256]);
    await client.query('COMMIT');
  } catch (error) {
    await quietly(client, 'ROLLBACK');
    throw error;
  }
}

/** Applies the migrations the database lacks, and answers their names. */
export async function applyMigrations(client: ClientBase, folder: URL = MIGRATIONS): Promise<string[]> {
  const migrations = committedMigrations(folder);
  await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS minhajna_meta');
    await client.query('CREATE TABLE IF NOT EXISTS minhajna_meta.migration (name text PRIMARY KEY, sha256 char(64))');
    const { rows } = await client.query<{ name: string; sha256: string | null }>(
      'SELECT name, sha256 FROM minhajna_meta.migration',
    );
    const done = new Map(rows.map((row) => [row.name, row.sha256]));
    const applied: string[] = [];
    for (const migration of migrations) {
      if (done.has(migration.name)) {
        const kept = done.get(migration.name);
        if (kept && kept !== migration.sha256)
          throw new Error(`migration ${migration.name} changed after it was applied`);
        continue;
      }
      await applyOne(client, migration);
      applied.push(migration.name);
    }
    return applied;
  } finally {
    await quietly(client, 'SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]);
  }
}
