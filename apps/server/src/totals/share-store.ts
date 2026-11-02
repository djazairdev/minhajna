// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the server keeps the schools' shares of the totals (#596, answer 628):
// for each world and announced day, each share by its ID, so a share sent
// again replaces the first, at most MAX_SHARES a day, one for each space a
// world may hold, and every share of a world erased with it. This store keeps
// them in memory, for tests and development; storage/prisma-shares.ts keeps
// them in PostgreSQL, where a day may pass MAX_SHARES by a few shares sent at
// the same moment.

import { MAX_SPACES } from '../spaces/space-store.js';
import type { Share } from './share-read.js';

/** The most shares a world keeps for a day. */
export const MAX_SHARES = MAX_SPACES;

export type ShareKept = 'added' | 'replaced' | 'full' | 'no-world';

export interface ShareStore {
  /** Keeps the share for its world and day, in place of one with its ID; full at MAX_SHARES for the day. */
  put(world: string, share: Share): Promise<ShareKept>;
  /** The world's shares for the day, in the order first kept. */
  shares(world: string, day: string): Promise<Share[]>;
  /** Erases every share of these worlds. */
  forget(worlds: readonly string[]): Promise<void>;
}

export const SHARE_STORE = Symbol('ShareStore');

export class MemoryShareStore implements ShareStore {
  private readonly worlds = new Map<string, Map<string, Map<string, Share>>>();

  put(world: string, share: Share): Promise<ShareKept> {
    const days = this.worlds.get(world) ?? new Map<string, Map<string, Share>>();
    const kept = days.get(share.day) ?? new Map<string, Share>();
    const replaced = kept.has(share.id);
    if (!replaced && kept.size >= MAX_SHARES) return Promise.resolve('full');
    kept.set(share.id, share);
    days.set(share.day, kept);
    this.worlds.set(world, days);
    return Promise.resolve(replaced ? 'replaced' : 'added');
  }

  shares(world: string, day: string): Promise<Share[]> {
    return Promise.resolve([...(this.worlds.get(world)?.get(day)?.values() ?? [])]);
  }

  forget(worlds: readonly string[]): Promise<void> {
    for (const id of worlds) this.worlds.delete(id);
    return Promise.resolve();
  }
}
