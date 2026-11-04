// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' logs (#619, §6.7, answer 656), with any world's pass, under
// the limits of the other world requests: GET /worlds/:world/admin/log
// answers the admin log's newest 200 lines, newest first, by day, action and
// detail, naming nobody; GET /worlds/:world/admin/security answers the
// security log's counts by day and kind, newest first, with how many days it
// keeps. Both describe the server as a whole, the same through every world.

import { Controller, Get, Header, Headers, Inject, Param, Req } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { limitRequest, openWorld } from '../worlds/world-access.js';
import { WORLD_STORE, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { ADMIN_SHOWN, ADMIN_STORE, type AdminLine, type AdminStore } from './admin-store.js';
import { SECURITY_DAYS, SECURITY_LOG, type SecurityDay, type SecurityLog } from './security-log.js';

@Controller('worlds/:world/admin')
export class LogsController {
  constructor(
    @Inject(WORLD_STORE) private readonly store: WorldStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
    @Inject(ADMIN_STORE) private readonly admin: AdminStore,
    @Inject(SECURITY_LOG) private readonly security: SecurityLog,
  ) {}

  @Get('log')
  @Header('Cache-Control', 'no-store')
  async log(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ lines: AdminLine[] }> {
    await this.enter(id, pass, request);
    return { lines: await this.admin.lines(ADMIN_SHOWN) };
  }

  @Get('security')
  @Header('Cache-Control', 'no-store')
  async securityLog(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ keptDays: number; days: SecurityDay[] }> {
    await this.enter(id, pass, request);
    return { keptDays: SECURITY_DAYS, days: this.security.days() };
  }

  private async enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<void> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    await openWorld(this.store, id, pass);
  }
}
