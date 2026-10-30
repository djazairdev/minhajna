// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The worlds API (#540, choice D3 of the 0.7.0 demo). POST /worlds starts a
// world from the first half of its code and the sealed world, and answers
// the starter token once. GET /worlds/:world joins it, GET
// /worlds/:world/date reads its date, and POST /worlds/:world/date moves
// the date to the next announced day, only for the starter token's holder.
// No answer may be cached: they carry the starter token and sealed worlds.

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
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { clientAddress, type Limiter } from './limits.js';
import {
  hashToken,
  holdsStarter,
  isWorldId,
  newStarterToken,
  nextAnnouncedDay,
  readWorldStart,
} from './world-rules.js';
import { WORLD_STORE, type World, type WorldStore } from './world-store.js';

export const WORLD_LIMITERS = Symbol('WorldLimiters');

export interface WorldLimiters {
  readonly starts: Limiter;
  readonly joins: Limiter;
  readonly trustCloudflare: boolean;
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
    if (!(await this.store.add({ ...start, starterHash: hashToken(starter) }))) {
      throw new ConflictException('a world with this id exists; draw a new code');
    }
    return { starter };
  }

  @Get(':world')
  @Header('Cache-Control', 'no-store')
  async join(@Param('world') id: string, @Req() request: IncomingMessage): Promise<{ sealed: string; date: string }> {
    this.limit(this.limiters.joins, request);
    const world = await this.find(id);
    return { sealed: world.sealed, date: world.date };
  }

  @Get(':world/date')
  @Header('Cache-Control', 'no-store')
  async date(@Param('world') id: string, @Req() request: IncomingMessage): Promise<{ date: string }> {
    this.limit(this.limiters.joins, request);
    return { date: (await this.find(id)).date };
  }

  @Post(':world/date')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  async move(
    @Param('world') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ date: string }> {
    this.limit(this.limiters.joins, request);
    const world = await this.find(id);
    if (!holdsStarter(authorization, world.starterHash)) {
      throw new ForbiddenException('only the device that started the world moves its date');
    }
    const next = nextAnnouncedDay(world.date, world.announcedDays);
    if (next === null) throw new ConflictException("no announced day is left after the world's date");
    await this.store.setDate(world.id, next);
    return { date: next };
  }

  private limit(limiter: Limiter, request: IncomingMessage): void {
    if (!limiter.take(clientAddress(request, this.limiters.trustCloudflare))) {
      throw new HttpException('too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async find(id: string): Promise<World> {
    const world = isWorldId(id) ? await this.store.get(id) : undefined;
    if (!world) throw new NotFoundException('no world has this id');
    return world;
  }
}
