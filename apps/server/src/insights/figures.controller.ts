// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world observatory's figures (#626, answer 678), with the world's pass,
// under the relay's limits. Figures are given only for a term whose collection
// the world's starter ended, never live, so reading them before and after one
// sending tells nothing of it. POST /worlds/:world/insights/closed, with the
// starter token too, ends the collection of the term `{year, term}`, its year
// two years in turn, once for good, at most MAX_ENDED_TERMS a world, then forms
// its figures (figures.ts) from the term's sendings, which no sending changes
// after (insight-store.ts), answered 200 when ended, again as well, forming
// them if a first try failed, and 409 when the world holds no observatory or
// ended as many terms as it may. GET
// /worlds/:world/insights/figures?year=&term= answers an ended term's packs,
// those whose nation's figure is shown, by their headings, and with &at= the
// figures of the pack at that place among them, as kept, never worked out
// again, so no answer holds more than one pack's; 409 while the collection is
// open or the figures are being formed.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { limitRequest, noWorld, openWorld } from '../worlds/world-access.js';
import { holdsStarter } from '../worlds/world-rules.js';
import { WORLD_STORE, type World, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { termFigures, type PackFigures } from './figures.js';
import { INSIGHT_STORE, MAX_ENDED_TERMS, type InsightStore, type PackHeading, type Term } from './insight-store.js';
import { YEAR } from './sending-read.js';

/** A term as asked for, or null when not a school year of two years in turn and a term of 1, 2 or 3. */
function termOf(year: unknown, term: unknown): Term | null {
  const years = typeof year === 'string' ? YEAR.exec(year) : null;
  if (years === null || Number(years[2]) !== Number(years[1]) + 1) return null;
  return term === 1 || term === 2 || term === 3 ? { year: year as string, term } : null;
}

const ASKED = 'a term is given as its year, YYYY-YYYY, and its term, 1, 2 or 3';
const IN_QUERY = /^[123]$/;
const AT = /^(0|[1-9]\d{0,3})$/;

@Controller('worlds/:world/insights')
export class FiguresController {
  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(INSIGHT_STORE) private readonly insights: InsightStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Post('closed')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async end(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<Term> {
    const world = await this.enter(id, pass, request);
    if (!holdsStarter(authorization, world.starterHash)) {
      throw new ForbiddenException('only the device that started the world ends a term’s collection');
    }
    const given = typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Partial<Term>) : {};
    const only = Object.keys(given).length === 2 && Object.hasOwn(given, 'year') && Object.hasOwn(given, 'term');
    const asked = only ? termOf(given.year, given.term) : null;
    if (asked === null) throw new BadRequestException(ASKED);
    const ended = await this.insights.end(world.id, asked);
    if (ended === 'no-world') throw noWorld();
    if (ended === 'closed') throw new ConflictException('this world holds no observatory');
    if (ended === 'full') throw new ConflictException(`a world ends at most ${MAX_ENDED_TERMS} terms`);
    await this.insights.form(world.id, asked, (sendings) => termFigures(sendings, asked.year, asked.term));
    return asked;
  }

  @Get('figures')
  @Header('Cache-Control', 'no-store')
  async figures(
    @Param('world') id: string,
    @Query('year') year: unknown,
    @Query('term') term: unknown,
    @Query('at') at: unknown,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<Term & ({ packs: readonly PackHeading[] } | { at: number; figures: PackFigures })> {
    const world = await this.enter(id, pass, request);
    const asked = typeof term === 'string' && IN_QUERY.test(term) ? termOf(year, Number(term)) : null;
    if (asked === null) throw new BadRequestException(ASKED);
    if (at !== undefined && (typeof at !== 'string' || !AT.test(at)))
      throw new BadRequestException('a pack is asked for by its place');
    const packs = await this.insights.figures(world.id, asked);
    if (packs === undefined)
      throw new ConflictException('the term’s collection is still open; its figures come once it ends');
    if (packs === 'forming') throw new ConflictException('the term’s figures are being formed; ask again soon');
    if (at === undefined) return { ...asked, packs };
    const figures = await this.insights.pack(world.id, asked, Number(at));
    if (figures === undefined) throw new BadRequestException(`the term has ${packs.length} packs`);
    return { ...asked, at: Number(at), figures };
  }

  private enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<World> {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
    return openWorld(this.worlds, id, pass);
  }
}
