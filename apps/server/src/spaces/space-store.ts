// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the relay keeps a world's spaces and their sealed batches (PRD
// §5.8, §5.10). A space is an id the clients chose and its kind; a batch is
// the stream a client named, its number, the order it arrived in and its
// sealed bytes, all one size. Nothing else: no names, no times, no
// addresses. A stream's batches are numbered from 0 with no gap. This
// store keeps them in memory, within caps per world and in all; #542 keeps
// them in PostgreSQL behind the same interface.

export type SpaceKind = 'school' | 'directorate' | 'national';

export interface StoredBatch {
  readonly seq: number;
  readonly stream: string;
  readonly number: number;
  readonly bytes: Uint8Array;
}

export type SpaceAdded = 'added' | 'same' | 'other' | 'full';
/** 'taken' or 'gap' when `first` is before or after the stream's next number; 'full' for the world or 'server-full'. */
export type BatchesAdded = 'added' | 'taken' | 'gap' | 'full' | 'server-full';

export interface SpaceStore {
  addSpace(world: string, space: string, kind: SpaceKind): Promise<SpaceAdded>;
  kindOf(world: string, space: string): Promise<SpaceKind | undefined>;
  /** Adds all the batches or none, numbered on from the stream's next number, which starts at 0. */
  addBatches(
    world: string,
    space: string,
    stream: string,
    first: number,
    batches: readonly Uint8Array[],
  ): Promise<BatchesAdded>;
  nextNumber(world: string, space: string, stream: string): Promise<number>;
  batchesAfter(world: string, space: string, after: number, most: number): Promise<StoredBatch[]>;
}

export const SPACE_STORE = Symbol('SpaceStore');
export const MAX_SPACES = 2000;
/** About 41 MB of sealed batches per world: room for a seeded national world's term. */
export const MAX_BATCHES = 10_000;
/** About 206 MB across every world the memory store holds. */
export const MAX_SERVER_BATCHES = 50_000;

interface Space {
  readonly kind: SpaceKind;
  readonly batches: StoredBatch[];
  readonly next: Map<string, number>;
}

export class MemorySpaceStore implements SpaceStore {
  private readonly worlds = new Map<string, { spaces: Map<string, Space>; batches: number }>();
  private held = 0;

  constructor(private readonly most = MAX_SERVER_BATCHES) {}

  private world(id: string): { spaces: Map<string, Space>; batches: number } {
    let world = this.worlds.get(id);
    if (!world) this.worlds.set(id, (world = { spaces: new Map(), batches: 0 }));
    return world;
  }

  addSpace(worldId: string, id: string, kind: SpaceKind): Promise<SpaceAdded> {
    const world = this.world(worldId);
    const space = world.spaces.get(id);
    if (space) return Promise.resolve(space.kind === kind ? 'same' : 'other');
    if (world.spaces.size >= MAX_SPACES) return Promise.resolve('full');
    world.spaces.set(id, { kind, batches: [], next: new Map() });
    return Promise.resolve('added');
  }

  kindOf(world: string, space: string): Promise<SpaceKind | undefined> {
    return Promise.resolve(this.worlds.get(world)?.spaces.get(space)?.kind);
  }

  addBatches(
    worldId: string,
    id: string,
    stream: string,
    first: number,
    batches: readonly Uint8Array[],
  ): Promise<BatchesAdded> {
    const world = this.world(worldId);
    const space = world.spaces.get(id);
    if (!space || world.batches + batches.length > MAX_BATCHES) return Promise.resolve('full');
    if (this.held + batches.length > this.most) return Promise.resolve('server-full');
    const next = space.next.get(stream) ?? 0;
    if (first !== next) return Promise.resolve(first < next ? 'taken' : 'gap');
    batches.forEach((bytes, index) => {
      space.batches.push({ seq: space.batches.length + 1, stream, number: first + index, bytes });
    });
    space.next.set(stream, first + batches.length);
    world.batches += batches.length;
    this.held += batches.length;
    return Promise.resolve('added');
  }

  nextNumber(world: string, space: string, stream: string): Promise<number> {
    return Promise.resolve(this.worlds.get(world)?.spaces.get(space)?.next.get(stream) ?? 0);
  }

  batchesAfter(world: string, space: string, after: number, most: number): Promise<StoredBatch[]> {
    const batches = this.worlds.get(world)?.spaces.get(space)?.batches ?? [];
    return Promise.resolve(batches.slice(Math.max(0, after), Math.max(0, after) + most));
  }
}
