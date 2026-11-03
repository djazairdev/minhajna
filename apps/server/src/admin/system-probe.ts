// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' console asks of the server's storage (#618, answer 655):
// where worlds are kept, PostgreSQL or memory; whether the database answers
// within 2 seconds, its statements cancelled by PostgreSQL itself after that;
// and, from the database's own settings, whether it is set to archive its
// write-ahead log, which is what keeps a backup (#633). Nothing it reads names
// a world, a space or anyone.

import type { PrismaClient } from '../generated/prisma/client.js';

export const SYSTEM_PROBE = Symbol('SystemProbe');
/** How long the database has to answer before it is said to be failing. */
export const PROBE_WAIT = 2000;

/** The storage's state: memory, or PostgreSQL answering with its archive setting, or failing. */
export type StorageState =
  | { readonly storage: 'memory' }
  | { readonly storage: 'postgresql'; readonly database: 'ok'; readonly archive: 'on' | 'off' }
  | { readonly storage: 'postgresql'; readonly database: 'failing' };

export interface SystemProbe {
  /** Where worlds are kept, known without asking. */
  readonly storage: 'memory' | 'postgresql';
  check(): Promise<StorageState>;
}

/** The state of a database that failed to answer. */
export const FAILING: StorageState = { storage: 'postgresql', database: 'failing' };

/** Worlds kept in memory, lost when the server stops. */
export class MemoryProbe implements SystemProbe {
  readonly storage = 'memory';

  check(): Promise<StorageState> {
    return Promise.resolve({ storage: 'memory' });
  }
}

/** Resolves to what a promise gives within the wait, or to null when it fails or is late. */
export async function within<T>(promise: Promise<T>, wait: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), wait);
  });
  try {
    return await Promise.race([promise.catch(() => null), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Worlds kept in PostgreSQL, asked through the server's own client. */
export class PostgresProbe implements SystemProbe {
  readonly storage = 'postgresql';

  constructor(
    private readonly client: Pick<PrismaClient, '$queryRaw' | '$transaction'>,
    private readonly wait = PROBE_WAIT,
  ) {}

  async check(): Promise<StorageState> {
    const asked = this.client.$transaction([
      this.client.$queryRaw`SELECT set_config('statement_timeout', ${String(this.wait)}, true)`,
      this.client.$queryRaw<{ archive: unknown }[]>`SELECT current_setting('archive_mode') AS archive`,
    ]);
    const mode = (await within(asked, this.wait))?.[1]?.[0]?.archive;
    if (typeof mode !== 'string') return FAILING;
    return { storage: 'postgresql', database: 'ok', archive: mode === 'off' ? 'off' : 'on' };
  }
}
