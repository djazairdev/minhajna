// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds module, with its store and rate limits. The server runs it with
// the defaults; tests pass their own store, limits and clock.

import { Module, type DynamicModule } from '@nestjs/common';
import { JOIN_LIMIT, Limiter, START_LIMIT, type Limit } from './limits.js';
import { WORLD_LIMITERS, WorldsController, type WorldLimiters } from './worlds.controller.js';
import { MemoryWorldStore, WORLD_STORE, type WorldStore } from './world-store.js';

export interface WorldsOptions {
  readonly store?: WorldStore;
  readonly starts?: Limit;
  readonly joins?: Limit;
  readonly now?: () => number;
  readonly trustCloudflare?: boolean;
}

@Module({})
export class WorldsModule {
  static register(options: WorldsOptions = {}): DynamicModule {
    const limiters: WorldLimiters = {
      starts: new Limiter(options.starts ?? START_LIMIT, options.now),
      joins: new Limiter(options.joins ?? JOIN_LIMIT, options.now),
      trustCloudflare: options.trustCloudflare ?? false,
    };
    return {
      module: WorldsModule,
      controllers: [WorldsController],
      providers: [
        { provide: WORLD_STORE, useValue: options.store ?? new MemoryWorldStore() },
        { provide: WORLD_LIMITERS, useValue: limiters },
      ],
    };
  }
}
