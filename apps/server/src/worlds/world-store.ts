// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the server keeps its worlds. A world is its id (the first half of
// its code), the sealed world the starting device sent, which the server
// cannot open, the world's date, the announced days the date moves through,
// and a hash of the starter token. This store keeps them in memory; #542
// keeps them in PostgreSQL behind the same interface.

export interface World {
  readonly id: string;
  readonly sealed: string;
  readonly date: string;
  readonly announcedDays: readonly string[];
  readonly starterHash: string;
}

export interface WorldStore {
  /** Adds the world, or answers false when its id is taken. */
  add(world: World): Promise<boolean>;
  get(id: string): Promise<World | undefined>;
  setDate(id: string, date: string): Promise<void>;
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
}
