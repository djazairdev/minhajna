// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world and space stores in PostgreSQL (#542, answers 550 and 551),
// through Prisma's client on the pg driver. They keep what the memory
// stores keep, under the same rules and caps, so a world outlives a restart
// of the server. An upload locks its world's row, so uploads to one world
// take turns and its caps and stream numbers hold; uploads to different
// worlds do not wait for each other. The total the whole server holds is
// counted again at most every few seconds and after a sweep, so its cap
// may be passed by a few uploads. An upload that waits too long for its
// turn, which PostgreSQL itself times, is refused as busy, to be tried
// again. Erasing a world erases its spaces and batches with it, in the
// database itself, and the stand-in receiving system's receipts (#590): a
// world may pass MAX_RECEIPTS by a few receipts sent at the same moment. The
// schools' shares of the totals have their own store (prisma-shares.ts).

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import {
  MAX_BATCHES,
  MAX_SPACES,
  StoreBusy,
  type BatchesAdded,
  type SpaceAdded,
  type SpaceKind,
  type SpaceStore,
  type StoredBatch,
} from '../spaces/space-store.js';
import type { ShareStore } from '../totals/share-store.js';
import { MAX_RECEIPTS, type Receipt, type World, type WorldStore } from '../worlds/world-store.js';
import { PrismaShareStore } from './prisma-shares.js';

/** Sealed batches across every world: about 4 GB. */
export const MAX_DATABASE_BATCHES = 1_000_000;
const TOTAL_FRESH_MS = 5_000;

type Transaction = Prisma.TransactionClient;

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

function toDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Locks the world's row until the transaction ends, or answers false when there is no such world. */
async function lockWorld(tx: Transaction, world: string): Promise<boolean> {
  const rows = await tx.$queryRaw<unknown[]>`SELECT 1 FROM world WHERE id = ${world} FOR NO KEY UPDATE`;
  return rows.length > 0;
}

async function heldBy(tx: Transaction, world?: string): Promise<number> {
  const { _sum } = await tx.space.aggregate({ _sum: { count: true }, where: world ? { worldId: world } : {} });
  return _sum.count ?? 0;
}

async function nextIn(tx: Transaction, worldId: string, spaceId: string, stream: string): Promise<number> {
  const { _max } = await tx.batch.aggregate({ _max: { number: true }, where: { worldId, spaceId, stream } });
  return (_max.number ?? -1) + 1;
}

export class PrismaStores {
  readonly client: PrismaClient;
  readonly worlds: WorldStore;
  readonly spaces: SpaceStore;
  readonly shares: ShareStore;

  constructor(url: string, options: StoreOptions = {}) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), errorFormat: 'minimal' });
    this.worlds = new PrismaWorldStore(this.client);
    this.spaces = new PrismaSpaceStore(this.client, options);
    this.shares = new PrismaShareStore(this.client);
  }

  close(): Promise<void> {
    return this.client.$disconnect();
  }
}

export class PrismaWorldStore implements WorldStore {
  constructor(private readonly client: PrismaClient) {}

  async add(world: World): Promise<boolean> {
    try {
      await this.client.world.create({
        data: {
          ...world,
          date: toDate(world.date),
          announcedDays: world.announcedDays.map(toDate),
          erasesOn: toDate(world.erasesOn),
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }

  async get(id: string): Promise<World | undefined> {
    const row = await this.client.world.findUnique({ where: { id }, omit: { caKey: true, receiverKey: true } });
    if (!row) return undefined;
    return {
      ...row,
      date: toDay(row.date),
      announcedDays: row.announcedDays.map(toDay),
      erasesOn: toDay(row.erasesOn),
    };
  }

  async setDate(id: string, date: string, was: Pick<World, 'date' | 'announcedDays'>): Promise<boolean> {
    const where = { id, date: toDate(was.date), announcedDays: { equals: was.announcedDays.map(toDate) } };
    const { count } = await this.client.world.updateMany({ where, data: { date: toDate(date) } });
    return count > 0;
  }

  async setAnnouncedDays(id: string, date: string, announcedDays: readonly string[]): Promise<boolean> {
    const where = { id, date: toDate(date) };
    const { count } = await this.client.world.updateMany({ where, data: { announcedDays: announcedDays.map(toDate) } });
    return count > 0;
  }

  async caKey(id: string, make?: () => string): Promise<string | undefined> {
    const row = await this.client.world.findUnique({ where: { id }, select: { caKey: true } });
    if (!row || row.caKey !== null || !make) return row?.caKey ?? undefined;
    await this.client.world.updateMany({ where: { id, caKey: null }, data: { caKey: make() } });
    return (await this.client.world.findUnique({ where: { id }, select: { caKey: true } }))?.caKey ?? undefined;
  }

  async receiverKey(id: string, make?: () => string): Promise<string | undefined> {
    const row = await this.client.world.findUnique({ where: { id }, select: { receiverKey: true } });
    if (!row || row.receiverKey !== null || !make) return row?.receiverKey ?? undefined;
    await this.client.world.updateMany({ where: { id, receiverKey: null }, data: { receiverKey: make() } });
    const made = await this.client.world.findUnique({ where: { id }, select: { receiverKey: true } });
    return made?.receiverKey ?? undefined;
  }

  async addReceipt(id: string, receipt: Receipt): Promise<'added' | 'kept' | 'full' | 'no-world'> {
    if (await this.client.receipt.findUnique({ where: { worldId_id: { worldId: id, id: receipt.id } } })) return 'kept';
    if ((await this.client.receipt.count({ where: { worldId: id } })) >= MAX_RECEIPTS) return 'full';
    const { id: receiptId, kind, term, subject, rows, signed, received, signer } = receipt;
    const data = { worldId: id, id: receiptId, kind, term, class: receipt.class, subject, rows, signer };
    try {
      await this.client.receipt.create({ data: { ...data, signed: toDate(signed), received: toDate(received) } });
      return 'added';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') return 'no-world';
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 'kept';
      throw error;
    }
  }

  async receipts(id: string): Promise<Receipt[]> {
    const rows = await this.client.receipt.findMany({ where: { worldId: id }, orderBy: { seq: 'desc' } });
    return rows.map((row) => ({
      standIn: true,
      id: row.id,
      kind: 'marks',
      term: row.term,
      class: row.class,
      subject: row.subject,
      rows: row.rows,
      signed: toDay(row.signed),
      received: toDay(row.received),
      signer: row.signer,
    }));
  }

  async sweep(today: string): Promise<string[]> {
    const rows = await this.client.$queryRaw<{ id: string }[]>`
      DELETE FROM world WHERE "erasesOn" <= ${toDate(today)}::date RETURNING id`;
    return rows.map((row) => row.id);
  }
}

export class PrismaSpaceStore implements SpaceStore {
  private total = { count: 0, at: -Infinity };

  constructor(
    private readonly client: PrismaClient,
    private readonly options: StoreOptions = {},
  ) {}

  private async inTurn<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const { maxWait = 5_000, lockWait = 8_000, timeout = 10_000 } = this.options;
    try {
      return await this.client.$transaction(
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

  private async serverTotal(tx: Transaction): Promise<number> {
    if (Date.now() - this.total.at > TOTAL_FRESH_MS) this.total = { count: await heldBy(tx), at: Date.now() };
    return this.total.count;
  }

  addSpace(worldId: string, id: string, kind: SpaceKind): Promise<SpaceAdded> {
    return this.inTurn(async (tx) => {
      if (!(await lockWorld(tx, worldId))) return 'gone';
      const space = await tx.space.findUnique({ where: { worldId_id: { worldId, id } } });
      if (space) return space.kind === kind ? 'same' : 'other';
      if ((await tx.space.count({ where: { worldId } })) >= MAX_SPACES) return 'full';
      await tx.space.create({ data: { worldId, id, kind } });
      return 'added';
    });
  }

  async kindOf(worldId: string, id: string): Promise<SpaceKind | undefined> {
    const space = await this.client.space.findUnique({ where: { worldId_id: { worldId, id } } });
    return space?.kind;
  }

  addBatches(
    worldId: string,
    spaceId: string,
    stream: string,
    first: number,
    batches: readonly Uint8Array[],
  ): Promise<BatchesAdded> {
    return this.inTurn(async (tx) => {
      if (!(await lockWorld(tx, worldId))) return 'gone';
      const space = await tx.space.findUnique({ where: { worldId_id: { worldId, id: spaceId } } });
      if (!space || (await heldBy(tx, worldId)) + batches.length > MAX_BATCHES) return 'full';
      const most = this.options.most ?? MAX_DATABASE_BATCHES;
      if ((await this.serverTotal(tx)) + batches.length > most) return 'server-full';
      const next = await nextIn(tx, worldId, spaceId, stream);
      if (first !== next) return first < next ? 'taken' : 'gap';
      const { count } = await tx.space.update({
        where: { worldId_id: { worldId, id: spaceId } },
        data: { count: { increment: batches.length } },
      });
      await tx.batch.createMany({
        data: batches.map((bytes, index) => ({
          worldId,
          spaceId,
          seq: count - batches.length + 1 + index,
          stream,
          number: first + index,
          bytes: Uint8Array.from(bytes),
        })),
      });
      this.total.count += batches.length;
      return 'added';
    });
  }

  async nextNumber(worldId: string, spaceId: string, stream: string): Promise<number> {
    return nextIn(this.client, worldId, spaceId, stream);
  }

  forget(): Promise<void> {
    this.total = { count: 0, at: -Infinity };
    return Promise.resolve();
  }

  async batchesAfter(worldId: string, spaceId: string, after: number, most: number): Promise<StoredBatch[]> {
    const rows = await this.client.batch.findMany({
      where: { worldId, spaceId, seq: { gt: after } },
      orderBy: { seq: 'asc' },
      take: most,
      select: { seq: true, stream: true, number: true, bytes: true },
    });
    return rows;
  }
}
