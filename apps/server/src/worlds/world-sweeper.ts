// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erases worlds on their 7th day (answer 548): when the server starts, and
// every hour after, so a world is gone within the hour its 7th day begins, in
// UTC, with its spaces, the schools' shares of its totals, the days of them
// kept worked out, its observatory with its schools' marks, those of a world
// started meanwhile under the same ID spared (school-marks.ts), and its problem
// reports; the admin log says how many, as soon as they are erased, and loses
// its lines older than 12 months, as problem reports do (#619, answer 656), a
// failure of either logged without failing the sweep. A failed sweep is logged
// and tried again the next hour. When the server stops, the sweeper stops and
// the stores close.

import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ADMIN_STORE, daysBefore, KEPT_DAYS, type AdminStore } from '../admin/admin-store.js';
import { SPACE_STORE, type SpaceStore } from '../spaces/space-store.js';
import { INSIGHT_STORE, type InsightStore } from '../insights/insight-store.js';
import { SchoolMarks } from '../insights/school-marks.js';
import { PACK_STORE, type PackStore } from '../packs/pack-store.js';
import { SHARE_STORE, type ShareStore } from '../totals/share-store.js';
import { TotalsDays } from '../totals/totals-days.js';
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
    @Inject(SHARE_STORE) private readonly shares: ShareStore,
    @Inject(INSIGHT_STORE) private readonly insights: InsightStore,
    @Inject(WORLD_KEEPING) private readonly keeping: WorldKeeping,
    @Inject(TotalsDays) private readonly days: TotalsDays,
    @Inject(SchoolMarks) private readonly marks: SchoolMarks,
    @Inject(ADMIN_STORE) private readonly admin: AdminStore,
    @Inject(PACK_STORE) private readonly packs: PackStore,
  ) {}

  /** Erases the worlds whose 7th day has come, and answers how many. */
  async sweep(): Promise<number> {
    const today = new Date(this.keeping.now()).toISOString().slice(0, 10);
    const turn = this.marks.turn;
    const gone = await this.worlds.sweep(today);
    this.marks.forget(gone, turn);
    if (gone.length > 0) await this.quietly('log', () => this.logErased(today, gone.length));
    await this.spaces.forget(gone);
    await this.shares.forget(gone);
    await this.insights.forget(gone);
    await this.packs.forget(gone);
    this.days.forget(gone);
    await this.quietly('trim', () => this.admin.sweep(daysBefore(today, KEPT_DAYS), gone));
    const looked = this.marks.turn;
    const held = this.marks.holding(gone);
    const now = new Map((await Promise.all(held.map((id) => this.worlds.get(id)))).map((one) => [one?.id, one]));
    this.marks.forget(held, looked, (id) => now.get(id)?.starterHash);
    return gone.length;
  }

  private logErased(day: string, count: number): Promise<void> {
    return this.admin.log({ day, action: 'worlds.erased', detail: { count } });
  }

  /** Runs an admin step whose failure must not undo or hide the sweep itself. */
  private async quietly(step: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error(`admin ${step} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
