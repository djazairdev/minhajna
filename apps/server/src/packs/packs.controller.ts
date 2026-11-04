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
// 'revision' when no such revision was taken. GET /worlds/:world/packs/steps
// answers each release's latest step. Making an account and signing in count
// under the limit on joins; steps, which come with every save, under the
// relay's.

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
import { sign } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { newCaKey, privateKeyOf } from '../worlds/stand-in-ca.js';
import { limitRequest, noWorld, openWorld } from '../worlds/world-access.js';
import { hashToken, holdsStarter, newStarterToken } from '../worlds/world-rules.js';
import { WORLD_STORE, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { PACK_ROLES, packStepText, readStepRequest, refusal, type PackRole, type PackStep } from './pack-rules.js';
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
    const read = readStepRequest(body);
    if (typeof read === 'string') throw new BadRequestException(read);
    if (read.day !== world.date) throw new ConflictException({ problem: 'date', message: "the world's date moved" });
    const at =
      read.expected === 0 ? undefined : await this.packs.stepAt(world.id, read.id, read.release, read.expected);
    if (read.expected > 0 && at === undefined) {
      throw new ConflictException({ problem: 'revision', message: 'no such revision of this release was taken' });
    }
    const successor = read.by === null ? undefined : await this.packs.latestStep(world.id, read.id, read.by);
    const latest = await this.packs.latestStep(world.id, read.id, read.release);
    const problem = refusal(read, role, at, latest, successor);
    if (problem !== null) throw new ForbiddenException(problem);
    const caKey = await this.worlds.caKey(world.id, newCaKey);
    if (caKey === undefined) throw noWorld();
    const { expected, ...fields } = read;
    const unsigned = { ...fields, revision: expected + 1, role };
    const text = Buffer.from(packStepText(world.id, unsigned), 'utf8');
    const step = { ...unsigned, signature: sign('sha256', text, privateKeyOf(caKey)).toString('base64') };
    const kept = await this.packs.putStep(world.id, step);
    if (kept === 'no-world') throw noWorld();
    if (kept === 'full')
      throw new HttpException('this world has taken all the steps it may', HttpStatus.INSUFFICIENT_STORAGE);
    return step;
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
