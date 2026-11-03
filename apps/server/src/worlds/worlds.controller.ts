// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds API (#540, choice D3 of the 0.7.0 demo). POST /worlds starts a
// world from the first half of its code, the sealed world and the world's pass,
// and answers the starter token once. With the pass in X-World-Pass, GET
// /worlds/:world joins it and GET /worlds/:world/date reads its date, each with
// its announced days; a wrong pass answers as if no world had the id. POST
// /worlds/:world/date, with the pass too, moves the date to the next announced
// day, only for the starter token's holder, refused when the days changed
// meanwhile. PUT /worlds/:world/announced-days, with the pass, replaces the
// announced days after the date with those a published calendar gives (#608,
// answer 624), keeping the date and the days before it, and refused when the
// date moved meanwhile. Only a start can tell that an id is taken, and starts
// are the most limited requests. No answer may be cached: they carry the
// starter token and sealed worlds.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import type { Limiter } from './limits.js';
import { limitRequest, openWorld } from './world-access.js';
import {
  hashToken,
  holdsStarter,
  newStarterToken,
  nextAnnouncedDay,
  readLaterDays,
  readWorldStart,
} from './world-rules.js';
import { seventhDay, WORLD_STORE, type WorldStore } from './world-store.js';

export const WORLD_LIMITERS = Symbol('WorldLimiters');

export interface WorldLimiters {
  readonly starts: Limiter;
  readonly joins: Limiter;
  readonly relay: Limiter;
  readonly uploads: Limiter;
  readonly trustCloudflare: boolean;
  /** The clock: rate limits, and the day a world starts on and is erased. */
  readonly now: () => number;
}

@Controller('worlds')
export class WorldsController {
  constructor(
    @Inject(WORLD_STORE) private readonly store: WorldStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  async start(@Body() body: unknown, @Req() request: IncomingMessage): Promise<{ starter: string }> {
    this.limit(this.limiters.starts, request);
    const start = readWorldStart(body);
    if (typeof start === 'string') throw new BadRequestException(start);
    const starter = newStarterToken();
    const today = new Date(this.limiters.now()).toISOString().slice(0, 10);
    const world = { ...start, starterHash: hashToken(starter), erasesOn: seventhDay(today) };
    if (!(await this.store.add(world))) {
      throw new ConflictException('a world with this id exists; draw a new code');
    }
    return { starter };
  }

  @Get(':world')
  @Header('Cache-Control', 'no-store')
  async join(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ sealed: string; date: string; announcedDays: readonly string[] }> {
    this.limit(this.limiters.joins, request);
    const world = await openWorld(this.store, id, pass);
    return { sealed: world.sealed, date: world.date, announcedDays: world.announcedDays };
  }

  @Get(':world/date')
  @Header('Cache-Control', 'no-store')
  async date(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ date: string; announcedDays: readonly string[] }> {
    this.limit(this.limiters.joins, request);
    const world = await openWorld(this.store, id, pass);
    return { date: world.date, announcedDays: world.announcedDays };
  }

  @Put(':world/announced-days')
  @Header('Cache-Control', 'no-store')
  async announce(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<{ announcedDays: readonly string[] }> {
    this.limit(this.limiters.joins, request);
    const world = await openWorld(this.store, id, pass);
    const announcedDays = readLaterDays(body, world.date, world.announcedDays);
    if (typeof announcedDays === 'string') throw new BadRequestException(announcedDays);
    if (!(await this.store.setAnnouncedDays(world.id, world.date, announcedDays))) {
      throw new ConflictException("the world's date moved meanwhile; send the days again");
    }
    return { announcedDays };
  }

  @Post(':world/date')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  async move(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ date: string }> {
    this.limit(this.limiters.joins, request);
    const world = await openWorld(this.store, id, pass);
    if (!holdsStarter(authorization, world.starterHash)) {
      throw new ForbiddenException('only the device that started the world moves its date');
    }
    const next = nextAnnouncedDay(world.date, world.announcedDays);
    if (next === null) throw new ConflictException("no announced day is left after the world's date");
    if (!(await this.store.setDate(world.id, next, world))) {
      throw new ConflictException("the world's announced days changed meanwhile; move the date again");
    }
    return { date: next };
  }

  private limit(limiter: Limiter, request: IncomingMessage): void {
    limitRequest(limiter, request, this.limiters.trustCloudflare);
  }
}
