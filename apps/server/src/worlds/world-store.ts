// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the server keeps its worlds. A world is its id (the first half of
// its code), the sealed world the starting device sent, which the server
// cannot open, the world's date, the announced days the date moves through,
// hashes of the starter token and of the world's pass, and the day it is
// erased, its 7th (answer 548). This store keeps them in memory, for tests
// and development; storage/prisma-stores.ts keeps them in PostgreSQL.

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
  /** Erases every world whose erasure day has come, with everything in it, and answers their ids. */
  sweep(today: string): Promise<string[]>;
}

export const WORLD_STORE = Symbol('WorldStore');

export class MemoryWorldStore implements WorldStore {
  private readonly worlds = new Map<string, World>();

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

  sweep(today: string): Promise<string[]> {
    const gone = [...this.worlds.values()].filter((world) => world.erasesOn <= today).map((world) => world.id);
    for (const id of gone) this.worlds.delete(id);
    return Promise.resolve(gone);
  }
}
