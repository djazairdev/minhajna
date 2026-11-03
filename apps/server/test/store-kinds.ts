// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two kinds of store the store tests run against (#541, #542, #590, #596):
// the memory stores, and PostgreSQL's on the database TEST_DATABASE_URL names,
// emptied and migrated before each test and skipped without it; and a made-up
// world to keep in them.

import assert from 'node:assert/strict';
import process from 'node:process';
import pg from 'pg';
import { MemorySpaceStore, type SpaceStore } from '../src/spaces/space-store.js';
import { applyMigrations } from '../src/storage/migrations.js';
import { PrismaStores } from '../src/storage/prisma-stores.js';
import { MemoryShareStore, type ShareStore } from '../src/totals/share-store.js';
import { MemoryWorldStore, type World, type WorldStore } from '../src/worlds/world-store.js';

export const url = process.env['TEST_DATABASE_URL'];

export interface Stores {
  readonly worlds: WorldStore;
  readonly spaces: SpaceStore;
  readonly shares: ShareStore;
  close(): Promise<void>;
}

/** Empties the test database and applies the migrations. */
export async function emptyDatabase(): Promise<void> {
  assert.match(new URL(url!).pathname, /_test$/, 'TEST_DATABASE_URL must name a database ending in _test');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS minhajna_meta CASCADE');
    await client.query('CREATE SCHEMA public');
    await applyMigrations(client);
  } finally {
    await client.end();
  }
}

export function madeUpWorld(id: string, erasesOn = '2026-12-07'): World {
  return {
    id,
    sealed: 'c2VhbGVkLXdvcmxk',
    date: '2026-12-01',
    announcedDays: ['2026-12-06', '2026-12-20'],
    starterHash: 'a'.repeat(64),
    passHash: 'b'.repeat(64),
    erasesOn,
  };
}

export const KINDS = [
  {
    name: 'in memory',
    skip: false as const,
    reset: (): Promise<void> => Promise.resolve(),
    open: (most?: number): Stores => ({
      worlds: new MemoryWorldStore(),
      spaces: new MemorySpaceStore(most),
      shares: new MemoryShareStore(),
      close: () => Promise.resolve(),
    }),
  },
  {
    name: 'in PostgreSQL',
    skip: url ? (false as const) : 'TEST_DATABASE_URL is not set',
    reset: emptyDatabase,
    open: (most?: number): Stores => {
      const stores = new PrismaStores(url!, most === undefined ? {} : { most });
      return { worlds: stores.worlds, spaces: stores.spaces, shares: stores.shares, close: () => stores.close() };
    },
  },
];
