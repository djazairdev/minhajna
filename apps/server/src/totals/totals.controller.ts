// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The schools' shares of the totals (#596, answer 628), with the world's pass,
// under the relay's limits, each share kept charged to the daily quota of
// uploads as the sealed batches its bytes would fill, so no address fills the
// store with shares either. PUT /worlds/:world/totals/:day/shares takes a
// school's share for one of the world's announced days that the world's date
// has reached, the day in the path and the share's own, and keeps it by its
// ID, answered 201 when new and 200 when it replaced one, its ID alone sent
// back; a share is never shown back. A day not announced, or not reached yet,
// is refused, so no series of totals forms between announced days.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Put,
  Req,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SEALED_BATCH_BYTES } from '../spaces/space-rules.js';
import { clientAddress } from '../worlds/limits.js';
import { limitRequest, noWorld, openWorld, tooMany } from '../worlds/world-access.js';
import { isDay } from '../worlds/world-rules.js';
import { WORLD_STORE, type World, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { readShare, shareBytes } from './share-read.js';
import { MAX_SHARES, SHARE_STORE, type ShareStore } from './share-store.js';

@Controller('worlds/:world/totals')
export class TotalsController {
  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(SHARE_STORE) private readonly shares: ShareStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Put(':day/shares')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  async share(
    @Param('world') id: string,
    @Param('day') day: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<{ id: string }> {
    const world = await this.enter(id, pass, request);
    announced(world, day);
    const share = readShare(body);
    if (typeof share === 'string') throw new BadRequestException(share);
    if (share.day !== day) throw new BadRequestException('the share is for another day');
    const address = clientAddress(request, this.limiters.trustCloudflare);
    const cost = Math.ceil(shareBytes(share) / SEALED_BATCH_BYTES);
    if (!this.limiters.uploads.fits(address, cost)) throw tooMany();
    const kept = await this.shares.put(world.id, share);
    if (kept === 'added' || kept === 'replaced') this.limiters.uploads.charge(address, cost);
    if (kept === 'no-world') throw noWorld();
    if (kept === 'full') throw new ConflictException(`a world keeps at most ${MAX_SHARES} shares a day`);
    if (kept === 'replaced') response.statusCode = 200;
    return { id: share.id };
  }

  private enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<World> {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
    return openWorld(this.worlds, id, pass);
  }
}

/** Refuses a day that is not one of the world's announced days, or that its date has not reached. */
export function announced(world: World, day: string): void {
  if (!isDay(day)) throw new BadRequestException('the day is written YYYY-MM-DD');
  if (!world.announcedDays.includes(day)) throw new UnprocessableEntityException('the day is not an announced day');
  if (day > world.date) throw new UnprocessableEntityException('the world’s date has not reached the day');
}
