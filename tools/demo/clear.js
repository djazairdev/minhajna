// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `npm run demo -- --fresh` in the dev container (#634): empties the demo
// database that DATABASE_URL names, whose PostgreSQL the dev container runs,
// so the server applies its migrations to an empty database. It uses the
// server's own PostgreSQL driver, and refuses any database but minhajna_demo
// on this machine.

import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

/** The statement that empties the demo database, or an Error when the URL names another, or one elsewhere. */
export function clearing(url) {
  const { hostname, pathname, search } = new URL(url);
  const here = ['127.0.0.1', 'localhost'].includes(hostname) && search === '';
  if (!here || pathname !== '/minhajna_demo') return new Error(`only minhajna_demo here is cleared, not ${url}`);
  return 'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS minhajna_meta CASCADE; CREATE SCHEMA public';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sql = clearing(process.env.DATABASE_URL ?? '');
  if (sql instanceof Error) {
    process.stderr.write(`${sql.message}\n`);
    process.exit(1);
  }
  const pg = createRequire(new URL('../../apps/server/package.json', import.meta.url))('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
