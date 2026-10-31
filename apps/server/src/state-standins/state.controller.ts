// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The stand-in receiving system's API (#590, answer 618), with the world's
// pass, under the limits of the other world requests. GET
// /worlds/:world/state/receiver answers the public half devices seal for,
// marked a stand-in's; POST /worlds/:world/state/deliveries takes a delivery's
// kind and what is sealed, in base64, opens it, reads the signed export and
// keeps its receipt, which it answers, the same receipt for the same export
// sent again, answered 200 then, not 201, or refuses with the reason, keeping
// nothing and making no key; absences are refused in 0.7.0, since a world
// records no roll call; and GET /worlds/:world/state/deliveries answers the
// world's receipts, newest first. Class lists come in from the sealed world
// itself, so the server never sees a pupil.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { limitRequest, noWorld, openWorld } from '../worlds/world-access.js';
import { MAX_RECEIPTS, WORLD_STORE, type Receipt, type World, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import {
  deliveryInfo,
  KINDS,
  newReceiverKey,
  openDelivery,
  receiverPoint,
  type DeliveryKind,
} from './receiving-system.js';
import { hasOnly, readDelivery } from './term-export-read.js';

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

@Controller('worlds/:world/state')
export class StateController {
  constructor(
    @Inject(WORLD_STORE) private readonly store: WorldStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Get('receiver')
  @Header('Cache-Control', 'no-store')
  async receiver(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ standIn: true; publicKey: string }> {
    const world = await this.enter(id, pass, request);
    const key = await this.store.receiverKey(world.id, newReceiverKey);
    if (key === undefined) throw noWorld();
    return { standIn: true, publicKey: receiverPoint(key) };
  }

  @Post('deliveries')
  @Header('Cache-Control', 'no-store')
  async deliver(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<Receipt> {
    const world = await this.enter(id, pass, request);
    if (!hasOnly(body, ['kind', 'sealed'])) throw new BadRequestException('a delivery has a kind and what is sealed');
    const { kind, sealed } = body;
    if (!KINDS.includes(kind as DeliveryKind)) throw new BadRequestException('a delivery’s kind is marks or absences');
    if (kind === 'absences') {
      throw new UnprocessableEntityException('a world records no roll call, so its stand-in takes no absences yet');
    }
    if (typeof sealed !== 'string' || !BASE64.test(sealed)) throw new BadRequestException('what is sealed is base64');
    const key = await this.store.receiverKey(world.id);
    const info = deliveryInfo(world.id, kind as DeliveryKind);
    const opened = key === undefined ? null : openDelivery(Buffer.from(sealed, 'base64'), key, info);
    if (key === undefined || opened === null) {
      throw new BadRequestException('the delivery is not sealed for this world’s stand-in');
    }
    const ca = await this.store.caKey(world.id);
    if (ca === undefined) throw new BadRequestException('the signing key is not certified by the world’s stand-in CA');
    const read = readDelivery(opened, world, { ca, receiver: key });
    if (typeof read === 'string') throw new BadRequestException(read);
    const added = await this.store.addReceipt(world.id, read);
    if (added === 'no-world') throw noWorld();
    if (added === 'full') throw new ConflictException(`the stand-in keeps at most ${MAX_RECEIPTS} receipts a world`);
    if (added === 'added') return read;
    response.statusCode = 200;
    return (await this.store.receipts(world.id)).find((one) => one.id === read.id) ?? read;
  }

  @Get('deliveries')
  @Header('Cache-Control', 'no-store')
  async receipts(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ receipts: Receipt[] }> {
    const world = await this.enter(id, pass, request);
    return { receipts: await this.store.receipts(world.id) };
  }

  private enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<World> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    return openWorld(this.store, id, pass);
  }
}
