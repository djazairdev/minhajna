// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds module: worlds, their spaces, the relay, the stand-in CA, the
// stand-in receiving system (#590), the schools' shares of the totals (#596),
// the operators' view of the server (#618), the observatory (#621), the admin
// log, problem reports and security logs (#619), and the pack desk's accounts
// and release steps (#612), with their stores, rate limits and sweeper. The
// server runs it with the memory stores, or PostgreSQL's when it has a
// database; tests pass their own stores, probe, limits, clock and schools'
// marks.

import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { DirectoryStore } from '../directory/directory-store.js';
import { AdminController } from '../admin/admin.controller.js';
import { AdminJournal, ADMIN_START } from '../admin/admin-journal.js';
import { ADMIN_STORE, MemoryAdminStore, type AdminStore } from '../admin/admin-store.js';
import { LogsController } from '../admin/logs.controller.js';
import { ProblemsController } from '../admin/problems.controller.js';
import { SECURITY_LOG, SecurityFilter, SecurityLog } from '../admin/security-log.js';
import { MemoryProbe, SYSTEM_PROBE, type SystemProbe } from '../admin/system-probe.js';
import { MemoryPackStore, PACK_STORE, type PackStore } from '../packs/pack-store.js';
import { PacksController } from '../packs/packs.controller.js';
import { SpacesController } from '../spaces/spaces.controller.js';
import { StoreBusyFilter } from '../spaces/store-busy.filter.js';
import { MemorySpaceStore, SPACE_STORE, type SpaceStore } from '../spaces/space-store.js';
import { StateController } from '../state-standins/state.controller.js';
import { INSIGHT_STORE, MemoryInsightStore, type InsightStore } from '../insights/insight-store.js';
import { FiguresController } from '../insights/figures.controller.js';
import { InsightsController } from '../insights/insights.controller.js';
import { SchoolMarks } from '../insights/school-marks.js';
import { MemoryShareStore, SHARE_STORE, type ShareStore } from '../totals/share-store.js';
import { TotalsDays } from '../totals/totals-days.js';
import { TotalsController } from '../totals/totals.controller.js';
import { CertificatesController } from './certificates.controller.js';
import { JOIN_LIMIT, Limiter, RELAY_LIMIT, SENDING_LIMIT, START_LIMIT, UPLOAD_LIMIT, type Limit } from './limits.js';
import { SeedController } from './seed.controller.js';
import { WORLD_LIMITERS, WorldsController, type WorldLimiters } from './worlds.controller.js';
import { MemoryWorldStore, WORLD_STORE, type WorldStore } from './world-store.js';
import { WORLD_KEEPING, WorldSweeper, type WorldKeeping } from './world-sweeper.js';

export interface WorldsOptions {
  readonly store?: WorldStore;
  readonly spaces?: SpaceStore;
  readonly shares?: ShareStore;
  /** What the operators' console asks of the storage. */
  readonly probe?: SystemProbe;
  readonly insights?: InsightStore;
  readonly marks?: SchoolMarks;
  /** The admin log and the problem reports. */
  readonly admin?: AdminStore;
  readonly packs?: PackStore;
  /** The directory, which stands outside any world and only shares these options. */
  readonly directory?: DirectoryStore;
  /** The migrations applied as the server started, for the admin log. */
  readonly migrations?: readonly string[];
  readonly starts?: Limit;
  readonly joins?: Limit;
  readonly relay?: Limit;
  readonly uploads?: Limit;
  readonly sendings?: Limit;
  readonly now?: () => number;
  readonly trustCloudflare?: boolean;
  /** Closes the stores when the server stops. */
  readonly close?: () => Promise<void>;
}

/** The rate limits these options set. */
export function worldLimiters(options: WorldsOptions = {}): WorldLimiters {
  const now = options.now ?? Date.now;
  return {
    starts: new Limiter(options.starts ?? START_LIMIT, now),
    joins: new Limiter(options.joins ?? JOIN_LIMIT, now),
    relay: new Limiter(options.relay ?? RELAY_LIMIT, now),
    uploads: new Limiter(options.uploads ?? UPLOAD_LIMIT, now),
    sendings: new Limiter(options.sendings ?? SENDING_LIMIT, now),
    trustCloudflare: options.trustCloudflare ?? false,
    now,
  };
}

@Module({})
export class WorldsModule {
  static register(options: WorldsOptions = {}, limiters = worldLimiters(options)): DynamicModule {
    const now = options.now ?? Date.now;
    const store = options.store ?? new MemoryWorldStore();
    const exists = async (id: string) => (await store.get(id)) !== undefined;
    const keeping: WorldKeeping = { now, ...(options.close ? { close: options.close } : {}) };
    const admin = options.admin ?? new MemoryAdminStore(exists);
    return {
      module: WorldsModule,
      controllers: [
        WorldsController,
        SpacesController,
        CertificatesController,
        SeedController,
        StateController,
        TotalsController,
        AdminController,
        InsightsController,
        LogsController,
        ProblemsController,
        FiguresController,
        PacksController,
      ],
      providers: [
        { provide: WORLD_STORE, useValue: store },
        { provide: SPACE_STORE, useValue: options.spaces ?? new MemorySpaceStore() },
        { provide: SHARE_STORE, useValue: options.shares ?? new MemoryShareStore() },
        { provide: SYSTEM_PROBE, useValue: options.probe ?? new MemoryProbe() },
        { provide: INSIGHT_STORE, useValue: options.insights ?? new MemoryInsightStore(exists) },
        { provide: ADMIN_STORE, useValue: admin },
        { provide: PACK_STORE, useValue: options.packs ?? new MemoryPackStore(exists) },
        { provide: ADMIN_START, useValue: { now, migrations: options.migrations ?? [] } },
        { provide: SECURITY_LOG, useValue: new SecurityLog(now) },
        AdminJournal,
        { provide: WORLD_LIMITERS, useValue: limiters },
        { provide: WORLD_KEEPING, useValue: keeping },
        TotalsDays,
        { provide: SchoolMarks, useValue: options.marks ?? new SchoolMarks() },
        WorldSweeper,
        { provide: APP_FILTER, useClass: SecurityFilter },
        { provide: APP_FILTER, useClass: StoreBusyFilter },
      ],
    };
  }
}
