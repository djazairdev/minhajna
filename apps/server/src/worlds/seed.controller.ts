// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Seeding a world, a national one for #548 (answer 625), with the world's pass
// and the starter token alone, since only the device that started the world
// seeds it; the server cannot tell a world's kind. POST
// /worlds/:world/seed/certificates certifies up to 128 signing keys at once, on
// the world's date, counted once with the other world requests. POST
// /worlds/:world/seed/batches opens up to 128 spaces, then adds up to 128
// batches in all to streams of the world's spaces, counted once with the
// relay's requests and by batch against the daily quota. Spaces and streams go
// in order, each stream all or none from its next number; a refusal stops
// there, keeps what came before and names the space or stream refused, unless
// the world itself is gone, so a start that fails is started again rather than
// resumed.

import type { IncomingMessage } from 'node:http';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { SPACE_STORE, type SpaceStore } from '../spaces/space-store.js';
import { clientAddress, type Limiter } from './limits.js';
import { readSeedBatches, readSeedCertificates } from './seed-rules.js';
import { issueCertificate, newCaKey, type Certificate } from './stand-in-ca.js';
import { limitRequest, noWorld, openWorld, tooMany } from './world-access.js';
import { holdsStarter } from './world-rules.js';
import { WORLD_STORE, type World, type WorldStore } from './world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from './worlds.controller.js';

@Controller('worlds/:world/seed')
export class SeedController {
  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(SPACE_STORE) private readonly spaces: SpaceStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Post('certificates')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async certify(
    @Param('world') id: string,
    @Body() body: unknown,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ certificates: Certificate[] }> {
    const world = await this.enter(this.limiters.joins, id, pass, authorization, request);
    const read = readSeedCertificates(body, world.id);
    if (typeof read === 'string') throw new BadRequestException(read);
    const key = await this.worlds.caKey(world.id, newCaKey);
    if (key === undefined) throw noWorld();
    return { certificates: read.map((one) => issueCertificate(one, world.date, key)) };
  }

  @Post('batches')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async add(
    @Param('world') id: string,
    @Body() body: unknown,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ opened: number; added: number }> {
    const world = await this.enter(this.limiters.relay, id, pass, authorization, request);
    const read = readSeedBatches(body);
    if (typeof read === 'string') throw new BadRequestException(read);
    const address = clientAddress(request, this.limiters.trustCloudflare);
    const added = read.streams.reduce((sum, one) => sum + one.batches.length, 0);
    if (!this.limiters.uploads.fits(address, added)) throw tooMany();
    for (const [at, { space, kind }] of read.spaces.entries()) {
      const opened = await this.spaces.addSpace(world.id, space, kind);
      if (opened === 'gone') throw noWorld();
      if (opened === 'other') throw new ConflictException(`space ${at}: it exists with another kind`);
      if (opened === 'full') throw new ConflictException(`space ${at}: the world holds as many spaces as it may`);
    }
    for (const [at, { space, stream, first, batches }] of read.streams.entries()) {
      if (!(await this.spaces.kindOf(world.id, space))) throw new BadRequestException(`stream ${at}: no such space`);
      const put = await this.spaces.addBatches(world.id, space, stream, first, batches);
      if (put === 'added') this.limiters.uploads.charge(address, batches.length);
      if (put === 'gone') throw noWorld();
      if (put === 'taken' || put === 'gap') {
        const next = await this.spaces.nextNumber(world.id, space, stream);
        throw new ConflictException(`stream ${at}: the stream's next batch is number ${next}`);
      }
      if (put === 'full') throw new ConflictException(`stream ${at}: the world holds as many batches as it may`);
      if (put === 'server-full') {
        const full = `stream ${at}: the server holds as many batches as it may`;
        throw new HttpException(full, HttpStatus.INSUFFICIENT_STORAGE);
      }
    }
    return { opened: read.spaces.length, added };
  }

  private async enter(
    limiter: Limiter,
    id: string,
    pass: string | undefined,
    authorization: string | undefined,
    request: IncomingMessage,
  ): Promise<World> {
    limitRequest(limiter, request, this.limiters.trustCloudflare);
    const world = await openWorld(this.worlds, id, pass);
    if (!holdsStarter(authorization, world.starterHash)) {
      throw new ForbiddenException('only the device that started the world seeds it');
    }
    return world;
  }
}
