// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds module: worlds, their spaces, the relay, the stand-in CA, the
// stand-in receiving system (#590) and the schools' shares of the totals
// (#596), with their stores, rate limits and sweeper. The server runs it with
// the memory stores, or PostgreSQL's when it has a database; tests pass their
// own stores, limits and clock.

import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SpacesController } from '../spaces/spaces.controller.js';
import { StoreBusyFilter } from '../spaces/store-busy.filter.js';
import { MemorySpaceStore, SPACE_STORE, type SpaceStore } from '../spaces/space-store.js';
import { StateController } from '../state-standins/state.controller.js';
import { MemoryShareStore, SHARE_STORE, type ShareStore } from '../totals/share-store.js';
import { TotalsController } from '../totals/totals.controller.js';
import { CertificatesController } from './certificates.controller.js';
import { JOIN_LIMIT, Limiter, RELAY_LIMIT, START_LIMIT, UPLOAD_LIMIT, type Limit } from './limits.js';
import { SeedController } from './seed.controller.js';
import { WORLD_LIMITERS, WorldsController, type WorldLimiters } from './worlds.controller.js';
import { MemoryWorldStore, WORLD_STORE, type WorldStore } from './world-store.js';
import { WORLD_KEEPING, WorldSweeper, type WorldKeeping } from './world-sweeper.js';

export interface WorldsOptions {
  readonly store?: WorldStore;
  readonly spaces?: SpaceStore;
  readonly shares?: ShareStore;
  readonly starts?: Limit;
  readonly joins?: Limit;
  readonly relay?: Limit;
  readonly uploads?: Limit;
  readonly now?: () => number;
  readonly trustCloudflare?: boolean;
  /** Closes the stores when the server stops. */
  readonly close?: () => Promise<void>;
}

@Module({})
export class WorldsModule {
  static register(options: WorldsOptions = {}): DynamicModule {
    const now = options.now ?? Date.now;
    const limiters: WorldLimiters = {
      starts: new Limiter(options.starts ?? START_LIMIT, now),
      joins: new Limiter(options.joins ?? JOIN_LIMIT, now),
      relay: new Limiter(options.relay ?? RELAY_LIMIT, now),
      uploads: new Limiter(options.uploads ?? UPLOAD_LIMIT, now),
      trustCloudflare: options.trustCloudflare ?? false,
      now,
    };
    const keeping: WorldKeeping = { now, ...(options.close ? { close: options.close } : {}) };
    return {
      module: WorldsModule,
      controllers: [
        WorldsController,
        SpacesController,
        CertificatesController,
        SeedController,
        StateController,
        TotalsController,
      ],
      providers: [
        { provide: WORLD_STORE, useValue: options.store ?? new MemoryWorldStore() },
        { provide: SPACE_STORE, useValue: options.spaces ?? new MemorySpaceStore() },
        { provide: SHARE_STORE, useValue: options.shares ?? new MemoryShareStore() },
        { provide: WORLD_LIMITERS, useValue: limiters },
        { provide: WORLD_KEEPING, useValue: keeping },
        WorldSweeper,
        { provide: APP_FILTER, useClass: StoreBusyFilter },
      ],
    };
  }
}
