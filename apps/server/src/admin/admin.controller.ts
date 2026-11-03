// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The operators' console's view of the server (#618, §6.7, answer 655): GET
// /worlds/:world/admin/system, with the world's pass, under the limits of the
// other world requests, since in the demo the operator is a role like the
// others (choice D11). It answers the server as a whole, never the world it
// is asked through: the package's version and its fingerprint (fingerprint.ts),
// the parts its code runs, where it keeps worlds, and whether the database
// answers and is set to archive its write-ahead log (system-probe.ts). When
// the database fails to check the pass within 2 seconds, it answers 503 with
// the database failing, the same to everyone, so the console still says so.
// Nothing in it names a world, a space or anyone, and the same answer comes
// through every world.

import { Controller, Get, Header, Headers, HttpException, Inject, Param, Req, Res } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { VERSION } from '../version.js';
import { limitRequest, openWorld } from '../worlds/world-access.js';
import { WORLD_STORE, type World, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { FINGERPRINT } from './fingerprint.js';
import { FAILING, PROBE_WAIT, SYSTEM_PROBE, within, type StorageState, type SystemProbe } from './system-probe.js';

/** The parts this package's code runs, in the order the console draws them. */
export const PARTS = ['gateway', 'relay', 'totals', 'standins'] as const;

/** The server as the console shows it. */
export type SystemView = {
  readonly version: string;
  readonly fingerprint: string | null;
  readonly parts: typeof PARTS;
} & StorageState;

@Controller('worlds/:world/admin')
export class AdminController {
  constructor(
    @Inject(WORLD_STORE) private readonly store: WorldStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
    @Inject(SYSTEM_PROBE) private readonly probe: SystemProbe,
  ) {}

  @Get('system')
  @Header('Cache-Control', 'no-store')
  async system(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<SystemView> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    const view = { version: VERSION, fingerprint: FINGERPRINT, parts: PARTS };
    let refused: HttpException | undefined;
    const opening = openWorld(this.store, id, pass).catch((error: unknown): World | null => {
      if (error instanceof HttpException) refused = error;
      return null;
    });
    const world = await within(opening, PROBE_WAIT);
    if (refused !== undefined) throw refused;
    if (world === null && this.probe.storage === 'postgresql') {
      response.statusCode = 503;
      return { ...view, ...FAILING };
    }
    if (world === null) throw new HttpException('the store failed', 500);
    return { ...view, ...(await this.probe.check()) };
  }
}
