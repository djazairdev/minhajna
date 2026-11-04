// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pack desk's API (#612, R-4.3-09, R-6.7-02, answer 767), each request with
// the world's pass. POST /worlds/:world/packs/accounts, with the starter token,
// makes a role's account, and answers its token once, kept only as its hash; a
// second one for the role replaces the first. GET /worlds/:world/packs/account,
// with an account's token, answers its role, to sign in. POST
// /worlds/:world/packs/steps, with an account's token, takes one step of a
// release under pack-rules.ts and answers it signed by the world's stand-in CA,
// on the world's date, refused with a problem of 'date' when that moved, or of
// 'revision' when the signed step it follows doesn't hold. GET
// /worlds/:world/packs/steps answers each release's latest step. Making an
// account and signing in count under the limit on joins; steps, which come with
// every save, under the relay's.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Param,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { newCaKey } from '../worlds/stand-in-ca.js';
import { limitRequest, noWorld, openWorld } from '../worlds/world-access.js';
import { hashToken, holdsStarter, newStarterToken } from '../worlds/world-rules.js';
import { WORLD_STORE, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { takePackStep } from './pack-desk.js';
import { PACK_ROLES, type PackRole, type PackStep } from './pack-rules.js';
import { PACK_STORE, type PackStore } from './pack-store.js';

const BEARER = /^Bearer +([A-Za-z0-9_-]{1,128})$/i;

@Controller('worlds/:world/packs')
export class PacksController {
  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(PACK_STORE) private readonly packs: PackStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Post('accounts')
  @Header('Cache-Control', 'no-store')
  async makeAccount(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<{ role: PackRole; token: string }> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    const world = await openWorld(this.worlds, id, pass);
    if (!holdsStarter(authorization, world.starterHash)) {
      throw new ForbiddenException('only the device that started the world makes its pack-editor accounts');
    }
    const role = (body as { role?: unknown } | null)?.role;
    if (!PACK_ROLES.includes(role as PackRole)) throw new BadRequestException('role must be curator or ministry');
    const token = newStarterToken();
    if (!(await this.packs.setAccount(world.id, role as PackRole, hashToken(token)))) throw noWorld();
    return { role: role as PackRole, token };
  }

  @Get('account')
  @Header('Cache-Control', 'no-store')
  async signIn(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ role: PackRole }> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    const world = await openWorld(this.worlds, id, pass);
    return { role: await this.roleOf(world.id, authorization) };
  }

  @Post('steps')
  @Header('Cache-Control', 'no-store')
  async takeStep(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<PackStep> {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
    const world = await openWorld(this.worlds, id, pass);
    const role = await this.roleOf(world.id, authorization);
    const caKey = await this.worlds.caKey(world.id, newCaKey);
    if (caKey === undefined) throw noWorld();
    const taken = await takePackStep(this.packs, { world: world.id, date: world.date, caKey }, role, body);
    if ('step' in taken) return taken.step;
    if (taken.refused === 'shape') throw new BadRequestException(taken.message);
    if (taken.refused === 'role') throw new ForbiddenException(taken.message);
    if (taken.refused === 'gone') throw noWorld();
    if (taken.refused === 'full') throw new HttpException(taken.message, HttpStatus.INSUFFICIENT_STORAGE);
    throw new ConflictException({ problem: taken.refused, message: taken.message });
  }

  @Get('steps')
  @Header('Cache-Control', 'no-store')
  async readSteps(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ steps: PackStep[] }> {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
    const world = await openWorld(this.worlds, id, pass);
    return { steps: await this.packs.latestSteps(world.id) };
  }

  /** The role of the account whose token this is, or refused. */
  private async roleOf(world: string, authorization: string | undefined): Promise<PackRole> {
    const token = BEARER.exec(authorization ?? '')?.[1];
    const role = token === undefined ? undefined : await this.packs.accountRole(world, hashToken(token));
    if (role === undefined) throw new ForbiddenException('no pack-editor account has this token');
    return role;
  }
}
