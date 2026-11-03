// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Transactions that take their turn (#542, #621): each sets PostgreSQL's own
// lock timeout, so work that waits too long for a world's row, or for its
// observatory's, is refused as busy (StoreBusy), which the server answers with
// 503 and Retry-After, rather than failing; and the waits the stores are given.

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { StoreBusy } from '../spaces/space-store.js';

export type Transaction = Prisma.TransactionClient;

export interface StoreOptions {
  /** The most batches across every world. */
  readonly most?: number;
  /** How long a transaction may wait for a connection, for its world's turn, and in all, in milliseconds. */
  readonly maxWait?: number;
  readonly lockWait?: number;
  readonly timeout?: number;
}

function isBusy(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2028') return true;
  const driver = error.meta?.['driverAdapterError'] as { cause?: { code?: unknown } } | undefined;
  return error.code === 'P2010' && driver?.cause?.code === '55P03';
}

/** Runs the work in a transaction that waits its turn for the locks it takes, refused as busy past its waits. */
export async function inTurn<T>(
  client: PrismaClient,
  options: StoreOptions,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const { maxWait = 5_000, lockWait = 8_000, timeout = 10_000 } = options;
  try {
    return await client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('lock_timeout', ${`${lockWait}ms`}, true)`;
        return work(tx);
      },
      { maxWait, timeout },
    );
  } catch (error) {
    if (isBusy(error)) throw new StoreBusy();
    throw error;
  }
}
