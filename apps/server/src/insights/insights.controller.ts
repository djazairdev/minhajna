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
// observatory is refused with 409, as is one for a term whose collection ended,
// or replacing a sending of such a term (figures.controller.ts). The sendings a
// request has kept cost the daily quota of uploads as the sealed batches their
// bytes as sent would fill together, their marks' few bytes left out, as a
// school's share does (a teachers' world's made-up sendings, answer 699, are
// each far under a batch), and an opening's new school marks one more each, so
// no address fills the store with sendings, or the marks' cap, either; a
// refused one costs nothing, and requests at the same moment may pass a limit
// by a few. Each sending's school-and-term code is turned into its school's
// mark for the run on receipt (school-marks.ts), then dropped, never stored or
// logged, and a sending is never shown back.

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
import { SchoolMarks, UNCOUNTED, type Marked } from './school-marks.js';
import { kept, readSending, type KeptSending, type Sending } from './sending-read.js';

/** The most sendings one opening of an observatory keeps. */
export const SEED_SENDINGS = 256;

const REFUSED: Readonly<Partial<Record<SendingKept, string>>> = {
  taken: 'a sending with this ID was sent with another token',
  ended: 'the collection of this sending’s term, or of the one it replaces, has ended',
  full: `a world keeps at most ${MAX_SENDINGS} sendings`,
  closed: 'this world holds no observatory',
};

/** The sealed batches the sendings' bytes together would fill, as the daily quota of uploads counts them. */
const cost = (sendings: readonly KeptSending[]): number =>
  Math.ceil(
    sendings.reduce((all, one) => all + Buffer.byteLength(JSON.stringify(one), 'utf8'), 0) / SEALED_BATCH_BYTES,
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
    const read = readSeeding(body);
    const unmarked = read.map((one) => kept(one, UNCOUNTED));
    const address = clientAddress(request, this.limiters.trustCloudflare);
    const schools = new Set(read.map((one) => one.schoolTerm)).size;
    if (!this.limiters.uploads.fits(address, cost(unmarked) + schools)) throw tooMany();
    if (!(await this.insights.open(world.id))) throw noWorld();
    const { outcomes, newMarks } = await this.keep(world, read);
    const stored = cost(unmarked.filter((_, at) => isKept(outcomes[at] ?? 'closed')));
    this.limiters.uploads.charge(address, stored + newMarks);
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
    const sending = [kept(read, UNCOUNTED)];
    const address = clientAddress(request, this.limiters.trustCloudflare);
    if (!this.limiters.sendings.fits(address) || !this.limiters.uploads.fits(address, cost(sending))) throw tooMany();
    const {
      outcomes: [outcome],
    } = await this.keep(world, [read]);
    const refused = refusal(outcome);
    if (refused !== null) throw refused;
    this.limiters.sendings.charge(address, 1);
    this.limiters.uploads.charge(address, cost(sending));
    if (outcome === 'replaced') response.statusCode = 200;
    return { id: read.id };
  }

  /**
   * Keeps the sendings, each code turned once into its school's mark and going no further; a mark drawn for sendings
   * the store all refuses is given back, unless another call took it meanwhile, and never when the store fails, as it
   * may have kept them all the same. Also says how many new marks its kept sendings hold.
   */
  private async keep(
    world: World,
    sendings: readonly Sending[],
  ): Promise<{ readonly outcomes: SendingKept[]; readonly newMarks: number }> {
    const drawn = new Map<string, Marked>();
    const marked = sendings.map((one) => {
      const known = drawn.get(one.schoolTerm) ?? this.marks.mark(world.id, world.starterHash, one.schoolTerm);
      drawn.set(one.schoolTerm, known);
      return known;
    });
    const outcomes = await this.insights.put(
      world.id,
      sendings.map((one, at) => kept(one, marked[at]!.mark)),
    );
    let newMarks = 0;
    for (const one of drawn.values()) {
      if (!one.fresh) continue;
      if (marked.some((held, at) => held === one && isKept(outcomes[at] ?? 'closed'))) newMarks += 1;
      else this.marks.release(world.id, world.starterHash, one);
    }
    return { outcomes, newMarks };
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
