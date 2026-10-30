// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starts the server. It listens on this computer only unless HOST says
// otherwise, as the container does; PORT defaults to 3000 and must be a
// port number. TRUST_PROXY=cloudflare reads the client's address from
// Cloudflare's header, for the rate limits. With DATABASE_URL, it first
// applies any committed migration the database lacks, then keeps its worlds
// there; without it, in memory, lost when it stops.

import pg from 'pg';
import { createApp } from './app.js';
import { applyMigrations } from './storage/migrations.js';
import { PrismaStores } from './storage/prisma-stores.js';
import type { WorldsOptions } from './worlds/worlds.module.js';

const host = process.env['HOST'] ?? '127.0.0.1';
const port = Number(process.env['PORT'] ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('fatal PORT must be a whole number from 1 to 65535\n');
  process.exit(1);
}

const url = process.env['DATABASE_URL'];
if (url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const applied = await applyMigrations(client);
    if (applied.length > 0) process.stdout.write(`log [Migrations] applied ${applied.join(', ')}\n`);
  } finally {
    await client.end();
  }
}

const stores = url ? new PrismaStores(url) : undefined;
const worlds: WorldsOptions = {
  trustCloudflare: process.env['TRUST_PROXY'] === 'cloudflare',
  ...(stores ? { store: stores.worlds, spaces: stores.spaces, close: () => stores.close() } : {}),
};
const app = await createApp(undefined, worlds);
await app.listen(port, host);
