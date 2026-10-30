// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erases worlds on their 7th day (answer 548): when the server starts, and
// every hour after, so a world is gone within the hour its 7th day begins,
// in UTC. A failed sweep is logged and tried again the next hour. When the
// server stops, the sweeper stops and the stores close.

import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { SPACE_STORE, type SpaceStore } from '../spaces/space-store.js';
import { WORLD_STORE, type WorldStore } from './world-store.js';

export const SWEEP_EVERY = 60 * 60 * 1000;
export const WORLD_KEEPING = Symbol('WorldKeeping');

export interface WorldKeeping {
  readonly now: () => number;
  readonly close?: () => Promise<void>;
}

@Injectable()
export class WorldSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Sweeper');
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(SPACE_STORE) private readonly spaces: SpaceStore,
    @Inject(WORLD_KEEPING) private readonly keeping: WorldKeeping,
  ) {}

  /** Erases the worlds whose 7th day has come, and answers how many. */
  async sweep(): Promise<number> {
    const today = new Date(this.keeping.now()).toISOString().slice(0, 10);
    const gone = await this.worlds.sweep(today);
    await this.spaces.forget(gone);
    return gone.length;
  }

  private async sweepQuietly(): Promise<void> {
    try {
      const erased = await this.sweep();
      if (erased > 0) this.logger.log(`erased ${erased} world${erased === 1 ? '' : 's'}`);
    } catch (error) {
      this.logger.error(`sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.sweepQuietly();
    this.timer = setInterval(() => void this.sweepQuietly(), SWEEP_EVERY);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.keeping.close?.();
  }
}
