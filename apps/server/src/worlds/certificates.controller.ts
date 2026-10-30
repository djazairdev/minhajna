// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The stand-in CA's API (#554, answer 564), with the world's pass, under the
// limits of the other world requests. GET /worlds/:world/ca answers the
// public key devices check the world's certificates against, and POST
// /worlds/:world/certificates certifies the signing key a request names,
// on the world's date. The first of them makes the world's CA key.

import { BadRequestException, Body, Controller, Get, Header, Headers, Inject, Param, Post, Req } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { caPublicKey, issueCertificate, newCaKey, readCertificateRequest, type Certificate } from './stand-in-ca.js';
import { limitRequest, noWorld, openWorld } from './world-access.js';
import { WORLD_STORE, type World, type WorldStore } from './world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from './worlds.controller.js';

@Controller('worlds/:world')
export class CertificatesController {
  constructor(
    @Inject(WORLD_STORE) private readonly store: WorldStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Get('ca')
  @Header('Cache-Control', 'no-store')
  async ca(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ publicKey: string }> {
    const world = await this.enter(id, pass, request);
    return { publicKey: caPublicKey(await this.keyOf(world)) };
  }

  @Post('certificates')
  @Header('Cache-Control', 'no-store')
  async certify(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<Certificate> {
    const world = await this.enter(id, pass, request);
    const read = readCertificateRequest(body, world.id);
    if (typeof read === 'string') throw new BadRequestException(read);
    return issueCertificate(read, world.date, await this.keyOf(world));
  }

  private enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<World> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    return openWorld(this.store, id, pass);
  }

  private async keyOf(world: World): Promise<string> {
    const key = await this.store.caKey(world.id, newCaKey);
    if (key === undefined) throw noWorld();
    return key;
  }
}
