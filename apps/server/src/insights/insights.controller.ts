// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's observatory (#621, choice D6, answer 676), with the world's pass,
// under the relay's limits. The server cannot tell a world's kind, so a world
// holds an observatory only once its starter opens it, and every other world, a
// national one among them, whose classes are all in school spaces, refuses
// sendings (R-8.4-05). POST /worlds/:world/insights, with the starter token
// too, opens it and keeps up to SEED_SENDINGS made-up sendings at once, for
// seeding a teachers' world, every one checked before any is kept, and a
// refusal stopping there, keeping those before it; it may be sent again to add
// more. PUT /worlds/:world/insights/sendings takes one sending, answered 201
// when new and 200 when it replaced its own, its ID alone sent back, and kept
// only within the daily limit of sendings by address. A sending whose ID is
// another token's, one past MAX_SENDINGS, or one for a world with no
// observatory is refused with 409. Every sending kept costs the daily quota of
// uploads as the sealed batches its bytes would fill, as a school's share does,
// so no address fills the store with sendings either; a refused one costs
// nothing, and requests at the same moment may pass a limit by a few. Each
// sending's school-and-term code is turned into its school's mark for the run
// on receipt (school-marks.ts), then dropped, never stored or logged, and a
// sending is never shown back.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SEALED_BATCH_BYTES } from '../spaces/space-rules.js';
import { clientAddress } from '../worlds/limits.js';
import { limitRequest, noWorld, openWorld, tooMany } from '../worlds/world-access.js';
import { holdsStarter } from '../worlds/world-rules.js';
import { WORLD_STORE, type World, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { INSIGHT_STORE, MAX_SENDINGS, type InsightStore, type SendingKept } from './insight-store.js';
import { SchoolMarks } from './school-marks.js';
import { kept, readSending, type KeptSending, type Sending } from './sending-read.js';

/** The most sendings one opening of an observatory keeps. */
export const SEED_SENDINGS = 256;

const REFUSED: Readonly<Partial<Record<SendingKept, string>>> = {
  taken: 'a sending with this ID was sent with another token',
  full: `a world keeps at most ${MAX_SENDINGS} sendings`,
  closed: 'this world holds no observatory',
};

/** The sealed batches a sending's bytes would fill, as the daily quota of uploads counts it. */
const cost = (sendings: readonly KeptSending[]): number =>
  sendings.reduce(
    (all, one) => all + Math.ceil(Buffer.byteLength(JSON.stringify(one), 'utf8') / SEALED_BATCH_BYTES),
    0,
  );

const isKept = (outcome: SendingKept): boolean => outcome === 'added' || outcome === 'replaced';

function refusal(outcome: SendingKept | undefined, at?: number): Error | null {
  if (outcome === 'no-world') return noWorld();
  const reason = outcome === undefined ? undefined : REFUSED[outcome];
  if (reason === undefined) return null;
  return new ConflictException(at === undefined ? reason : `sending ${at}: ${reason}`);
}

@Controller('worlds/:world/insights')
export class InsightsController {
  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(INSIGHT_STORE) private readonly insights: InsightStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
    @Inject(SchoolMarks) private readonly marks: SchoolMarks,
  ) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async open(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<{ kept: number }> {
    const world = await this.enter(id, pass, request);
    if (!holdsStarter(authorization, world.starterHash)) {
      throw new ForbiddenException('only the device that started the world opens its observatory');
    }
    const sendings = readSeeding(body).map((read) => this.kept(world, read));
    const address = clientAddress(request, this.limiters.trustCloudflare);
    if (!this.limiters.uploads.fits(address, cost(sendings))) throw tooMany();
    if (!(await this.insights.open(world.id))) throw noWorld();
    const outcomes = await this.insights.put(world.id, sendings);
    this.limiters.uploads.charge(address, cost(sendings.filter((_, at) => isKept(outcomes[at] ?? 'closed'))));
    const failed = outcomes.findIndex((outcome) => !isKept(outcome));
    if (failed >= 0) throw refusal(outcomes[failed], failed) ?? new ConflictException('a sending was refused');
    return { kept: outcomes.length };
  }

  @Put('sendings')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  async send(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<{ id: string }> {
    const world = await this.enter(id, pass, request);
    const read = readSending(body);
    if (typeof read === 'string') throw new BadRequestException(read);
    const sending = [this.kept(world, read)];
    const address = clientAddress(request, this.limiters.trustCloudflare);
    if (!this.limiters.sendings.fits(address) || !this.limiters.uploads.fits(address, cost(sending))) throw tooMany();
    const [outcome] = await this.insights.put(world.id, sending);
    const refused = refusal(outcome);
    if (refused !== null) throw refused;
    this.limiters.sendings.charge(address, 1);
    this.limiters.uploads.charge(address, cost(sending));
    if (outcome === 'replaced') response.statusCode = 200;
    return { id: read.id };
  }

  /** The sending as the server keeps it, its code turned into its school's mark and going no further. */
  private kept(world: World, sending: Sending): KeptSending {
    return kept(sending, this.marks.mark(world.id, world.starterHash, sending.schoolTerm));
  }

  private enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<World> {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
    return openWorld(this.worlds, id, pass);
  }
}

/** The made-up sendings of an opening, each read. */
function readSeeding(body: unknown): Sending[] {
  const sendings = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {};
  const list = Object.keys(sendings).length === 1 ? (sendings as { sendings?: unknown }).sendings : undefined;
  if (!Array.isArray(list) || list.length > SEED_SENDINGS) {
    throw new BadRequestException(`an opening holds only its sendings, at most ${SEED_SENDINGS}`);
  }
  const ids = new Set<string>();
  return list.map((one, at) => {
    const read = readSending(one);
    if (typeof read === 'string') throw new BadRequestException(`sending ${at}: ${read}`);
    if (ids.has(read.id)) throw new BadRequestException(`sending ${at}: its ID is given twice`);
    ids.add(read.id);
    return read;
  });
}
