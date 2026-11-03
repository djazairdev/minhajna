// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the server keeps a world's observatory (#621, answer 676): whether its
// starter opened one, and the insights sendings it took, each by its sending
// ID with its token and never with its school-and-term code, a sending sent
// again with the same ID and token replacing the first in its place, at most
// MAX_SENDINGS a world, every one erased with the world. This store keeps them
// in memory, for tests and development; storage/prisma-insights.ts keeps them
// in PostgreSQL.

import type { KeptSending } from './sending-read.js';

/** The most sendings a world's observatory keeps. */
export const MAX_SENDINGS = 4096;

export type SendingKept = 'added' | 'replaced' | 'taken' | 'full' | 'closed' | 'no-world';

export interface InsightStore {
  /**
   * Opens the world's observatory; true when it is open, false when the world is gone. The memory store marks it open
   * before it asks whether the world exists, so a sweep meanwhile, which forgets it, never leaves it open.
   */
  open(world: string): Promise<boolean>;
  /** Keeps the sendings in order, each replacing its own, until one is refused; answers each one's outcome. */
  put(world: string, sendings: readonly KeptSending[]): Promise<SendingKept[]>;
  /** The world's sendings in the order first kept. */
  sendings(world: string): Promise<KeptSending[]>;
  /** Erases the observatories of these worlds. */
  forget(worlds: readonly string[]): Promise<void>;
}

export const INSIGHT_STORE = Symbol('InsightStore');

/** What one sending does to a world's sendings, given the token its ID holds there, if any, and how many it holds. */
export function outcome(token: string | undefined, held: number, sending: KeptSending): SendingKept {
  if (token !== undefined) return token === sending.token ? 'replaced' : 'taken';
  return held >= MAX_SENDINGS ? 'full' : 'added';
}

export class MemoryInsightStore implements InsightStore {
  private readonly worlds = new Map<string, Map<string, KeptSending>>();

  constructor(private readonly exists: (world: string) => Promise<boolean> = () => Promise.resolve(true)) {}

  async open(world: string): Promise<boolean> {
    const fresh = !this.worlds.has(world);
    if (fresh) this.worlds.set(world, new Map());
    if (await this.exists(world)) return true;
    if (fresh) this.worlds.delete(world);
    return false;
  }

  async put(world: string, sendings: readonly KeptSending[]): Promise<SendingKept[]> {
    const held = this.worlds.get(world);
    if (sendings.length === 0) return [];
    if (held === undefined) return [(await this.exists(world)) ? 'closed' : 'no-world'];
    const outcomes: SendingKept[] = [];
    for (const sending of sendings) {
      const one = outcome(held.get(sending.id)?.token, held.size, sending);
      outcomes.push(one);
      if (one !== 'added' && one !== 'replaced') break;
      held.set(sending.id, sending);
    }
    return outcomes;
  }

  sendings(world: string): Promise<KeptSending[]> {
    return Promise.resolve([...(this.worlds.get(world)?.values() ?? [])]);
  }

  forget(worlds: readonly string[]): Promise<void> {
    for (const id of worlds) this.worlds.delete(id);
    return Promise.resolve();
  }
}
