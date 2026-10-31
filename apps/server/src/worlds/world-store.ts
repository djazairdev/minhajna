// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the server keeps its worlds. A world is its id (the first half of its
// code), the sealed world the starting device sent, which the server cannot
// open, the world's date, the announced days the date moves through, hashes of
// the starter token and of the world's pass, and the day it is erased, its 7th
// (answer 548). It keeps too the key of the world's stand-in CA (#554), apart
// from the world, made the first time the world needs it, and the key of its
// stand-in receiving system with the receipts of what that system took (#590,
// answer 618), each kept once, at most MAX_RECEIPTS, erased with the world.
// This store keeps them in memory, for tests and development;
// storage/prisma-stores.ts keeps them in PostgreSQL.

/** What the stand-in receiving system keeps of a delivery it took: never the export, only what it was. */
export interface Receipt {
  readonly standIn: true;
  /** Keyed from the signing device and the export's text, so the same export sent again has the same receipt. */
  readonly id: string;
  readonly kind: 'marks';
  readonly term: number;
  readonly class: string;
  readonly subject: string;
  readonly rows: number;
  /** The day the export was signed on the device. */
  readonly signed: string;
  /** The world's date the delivery arrived on. */
  readonly received: string;
  /** The device the signing key's certificate names. */
  readonly signer: string;
}

/** The receipts the stand-in receiving system keeps for a world. */
export const MAX_RECEIPTS = 1000;

export interface World {
  readonly id: string;
  readonly sealed: string;
  readonly date: string;
  readonly announcedDays: readonly string[];
  readonly starterHash: string;
  readonly passHash: string;
  readonly erasesOn: string;
}

/** A world's 7th day, counting the day it starts as its 1st. */
export function seventhDay(start: string): string {
  const day = new Date(`${start}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 6);
  return day.toISOString().slice(0, 10);
}

export interface WorldStore {
  /** Adds the world, or answers false when its id is taken. */
  add(world: World): Promise<boolean>;
  get(id: string): Promise<World | undefined>;
  setDate(id: string, date: string): Promise<void>;
  /** The world's stand-in CA key, made with `make` the first time; undefined without it or the world. */
  caKey(id: string, make?: () => string): Promise<string | undefined>;
  /** The world's stand-in receiving key, made with `make` the first time; undefined without it or the world. */
  receiverKey(id: string, make?: () => string): Promise<string | undefined>;
  /** Keeps a receipt for the world, unless it is kept already, the world has MAX_RECEIPTS or no longer exists. */
  addReceipt(id: string, receipt: Receipt): Promise<'added' | 'kept' | 'full' | 'no-world'>;
  /** The world's receipts, newest first. */
  receipts(id: string): Promise<Receipt[]>;
  /** Erases every world whose erasure day has come, with everything in it, and answers their ids. */
  sweep(today: string): Promise<string[]>;
}

export const WORLD_STORE = Symbol('WorldStore');

export class MemoryWorldStore implements WorldStore {
  private readonly worlds = new Map<string, World>();
  private readonly caKeys = new Map<string, string>();
  private readonly receiverKeys = new Map<string, string>();
  private readonly kept = new Map<string, Receipt[]>();

  add(world: World): Promise<boolean> {
    if (this.worlds.has(world.id)) return Promise.resolve(false);
    this.worlds.set(world.id, world);
    return Promise.resolve(true);
  }

  get(id: string): Promise<World | undefined> {
    return Promise.resolve(this.worlds.get(id));
  }

  setDate(id: string, date: string): Promise<void> {
    const world = this.worlds.get(id);
    if (world) this.worlds.set(id, { ...world, date });
    return Promise.resolve();
  }

  caKey(id: string, make?: () => string): Promise<string | undefined> {
    if (!this.worlds.has(id)) return Promise.resolve(undefined);
    if (!this.caKeys.has(id) && make) this.caKeys.set(id, make());
    return Promise.resolve(this.caKeys.get(id));
  }

  receiverKey(id: string, make?: () => string): Promise<string | undefined> {
    if (!this.worlds.has(id)) return Promise.resolve(undefined);
    if (!this.receiverKeys.has(id) && make) this.receiverKeys.set(id, make());
    return Promise.resolve(this.receiverKeys.get(id));
  }

  addReceipt(id: string, receipt: Receipt): Promise<'added' | 'kept' | 'full' | 'no-world'> {
    if (!this.worlds.has(id)) return Promise.resolve('no-world');
    const list = this.kept.get(id) ?? [];
    if (list.some((one) => one.id === receipt.id)) return Promise.resolve('kept');
    if (list.length >= MAX_RECEIPTS) return Promise.resolve('full');
    this.kept.set(id, [receipt, ...list]);
    return Promise.resolve('added');
  }

  receipts(id: string): Promise<Receipt[]> {
    return Promise.resolve([...(this.kept.get(id) ?? [])]);
  }

  sweep(today: string): Promise<string[]> {
    const gone = [...this.worlds.values()].filter((world) => world.erasesOn <= today).map((world) => world.id);
    for (const id of gone) {
      this.worlds.delete(id);
      this.caKeys.delete(id);
      this.receiverKeys.delete(id);
      this.kept.delete(id);
    }
    return Promise.resolve(gone);
  }
}
