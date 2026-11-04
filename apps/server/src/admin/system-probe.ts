// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' console asks of the server's storage (#618, answer 655):
// where worlds are kept, PostgreSQL or memory; whether the database answers
// within 2 seconds, its statements cancelled by PostgreSQL itself after that;
// and, from the database's own settings, whether it is set to archive its
// write-ahead log, which is what keeps a backup (#633). It reads too, and
// answers only while the database archives, whether archiving works, from
// PostgreSQL's own counters (pg_stat_archiver), never when a file was archived,
// since files are archived as worlds are written (#620, answer 658); and the
// newest restore test the container logged in the admin log, by its day and
// result. Nothing it reads names a world, a space or anyone.

import type { PrismaClient } from '../generated/prisma/client.js';

export const SYSTEM_PROBE = Symbol('SystemProbe');
/** How long the database has to answer before it is said to be failing. */
export const PROBE_WAIT = 2000;

/** Whether archiving works: a file archived and no failure since, the last failure newer, or none archived yet. */
export type Archiving = 'ok' | 'failing' | 'waiting';
/** The newest restore test, by its UTC day and result. */
export type RestoreTest = { readonly day: string; readonly result: 'passed' | 'failed' };

/** The storage's state: memory, or PostgreSQL answering with its archive setting, or failing. */
export type StorageState =
  | { readonly storage: 'memory' }
  | { readonly storage: 'postgresql'; readonly database: 'ok'; readonly archive: 'off' }
  | {
      readonly storage: 'postgresql';
      readonly database: 'ok';
      readonly archive: 'on';
      readonly archiving: Archiving;
      readonly restore: RestoreTest | null;
    }
  | { readonly storage: 'postgresql'; readonly database: 'failing' };

const ARCHIVING: readonly unknown[] = ['ok', 'failing', 'waiting'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

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
      this.client.$queryRaw<{ archiving: unknown }[]>`
        SELECT CASE
          WHEN last_failed_time IS NOT NULL AND (last_archived_time IS NULL OR last_failed_time > last_archived_time)
            THEN 'failing'
          WHEN archived_count = 0 THEN 'waiting'
          ELSE 'ok' END AS archiving
        FROM pg_stat_archiver`,
      this.client.$queryRaw<{ day: unknown; result: unknown }[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, detail->>'result' AS result FROM admin_line
        WHERE action = 'restore.tested' ORDER BY seq DESC LIMIT 1`,
    ]);
    const rows = await within(asked, this.wait);
    const mode = rows?.[1]?.[0]?.archive;
    const archiving = rows?.[2]?.[0]?.archiving;
    if (rows === null || typeof mode !== 'string' || !ARCHIVING.includes(archiving)) return FAILING;
    if (mode === 'off') return { storage: 'postgresql', database: 'ok', archive: 'off' };
    const { day, result } = rows[3]?.[0] ?? {};
    const restore: RestoreTest | null =
      typeof day === 'string' && DAY.test(day) && (result === 'passed' || result === 'failed') ? { day, result } : null;
    return { storage: 'postgresql', database: 'ok', archive: 'on', archiving: archiving as Archiving, restore };
  }
}
