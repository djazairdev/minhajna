// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `npm run migrate`: applies the committed migrations to DATABASE_URL and
// prints the ones it applied. The server does the same when it starts
// with DATABASE_URL.

import process from 'node:process';
import pg from 'pg';
import { applyMigrations } from './migrations.js';

const url = process.env['DATABASE_URL'];
if (!url) {
  process.stderr.write('fatal DATABASE_URL is not set\n');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const applied = await applyMigrations(client);
  process.stdout.write(applied.length ? `applied ${applied.join(', ')}\n` : 'nothing to apply\n');
} finally {
  await client.end();
}
