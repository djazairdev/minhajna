// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's problem reports (#619, §6.7, R-6.7-03, answer 656), each request
// with the world's pass, under the limits of the other world requests. POST
// /worlds/:world/problems takes a report as the app shapes it, its part, its
// note of 1 to 1,000 characters, some of them shown, with no control character
// but a new line, no lone surrogate and no bidi embedding, override or isolate,
// which could make the console show it otherwise, and the app's version, and
// answers its ID and the token its sender may delete it with, given once and
// kept only as its hash; GET lists the world's reports, newest first, without
// tokens; POST /worlds/:world/problems/:id/fixed erases a report marked fixed
// and adds a line to the admin log, both or neither; POST
// /worlds/:world/problems/:id/delete, with the token as a Bearer, erases the
// sender's own, a wrong token answered as an unknown report. The client sends
// no DELETE, so neither does this.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { hasOnly } from '../state-standins/term-export-read.js';
import { limitRequest, noWorld, openWorld } from '../worlds/world-access.js';
import { hashToken } from '../worlds/world-rules.js';
import { WORLD_STORE, type World, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import {
  ADMIN_STORE,
  MAX_PROBLEMS,
  NOTE_LIMIT,
  PROBLEM_PARTS,
  type AdminStore,
  type Problem,
  type ProblemPart,
} from './admin-store.js';

const ID = /^[0-9a-f]{32}$/;
const VERSION = /^[0-9A-Za-z.+-]{1,32}$/;
/** Control characters but a new line, lone surrogates, and the bidi embeddings, overrides and isolates. */
const REFUSED = /(?!\n)\p{Cc}|\p{Cs}|[\u202A-\u202E\u2066-\u2069]/u;
/** A character that shows: neither a space nor an invisible format character. */
const SHOWN = /[^\s\p{Cf}]/u;
const NOTE_RULE =
  `a report’s note is 1 to ${NOTE_LIMIT} characters, some shown, with no control character but a new line, ` +
  'no lone surrogate and no bidi embedding, override or isolate';
const TOKEN = /^Bearer +([A-Za-z0-9_-]{43})$/i;

/** A report's fields as the app sends them, or why they are refused. */
export function readProblem(body: unknown): Pick<Problem, 'part' | 'note' | 'version'> | string {
  if (!hasOnly(body, ['part', 'note', 'version'])) return 'a report has a part, a note and a version';
  const { part, note, version } = body;
  if (!PROBLEM_PARTS.includes(part as ProblemPart)) return `a report’s part is one of ${PROBLEM_PARTS.join(', ')}`;
  if (typeof note !== 'string' || !SHOWN.test(note) || [...note].length > NOTE_LIMIT || REFUSED.test(note))
    return NOTE_RULE;
  if (typeof version !== 'string' || !VERSION.test(version)) return 'a report’s version is the app’s version';
  return { part: part as ProblemPart, note, version };
}

@Controller('worlds/:world/problems')
export class ProblemsController {
  constructor(
    @Inject(WORLD_STORE) private readonly store: WorldStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
    @Inject(ADMIN_STORE) private readonly admin: AdminStore,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  async send(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<{ id: string; token: string }> {
    const world = await this.enter(id, pass, request);
    const read = readProblem(body);
    if (typeof read === 'string') throw new BadRequestException(read);
    const token = randomBytes(32).toString('base64url');
    const report = {
      id: randomBytes(16).toString('hex'),
      ...read,
      received: this.today(),
      tokenHash: hashToken(token),
    };
    const added = await this.admin.addProblem(world.id, report);
    if (added === 'no-world') throw noWorld();
    if (added === 'full') throw new ConflictException(`a world keeps at most ${MAX_PROBLEMS} problem reports`);
    return { id: report.id, token };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('world') id: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ problems: Problem[] }> {
    const world = await this.enter(id, pass, request);
    return { problems: await this.admin.problems(world.id) };
  }

  @Post(':id/fixed')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async fixed(
    @Param('world') id: string,
    @Param('id') problem: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ id: string }> {
    const world = await this.enter(id, pass, request);
    const line = { day: this.today(), action: 'problem.fixed', detail: { problem } } as const;
    if (!ID.test(problem) || !(await this.admin.fixProblem(world.id, problem, line))) throw noReport();
    return { id: problem };
  }

  @Post(':id/delete')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async delete(
    @Param('world') id: string,
    @Param('id') problem: string,
    @Headers('x-world-pass') pass: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ id: string }> {
    const world = await this.enter(id, pass, request);
    const token = TOKEN.exec(authorization ?? '')?.[1];
    if (!ID.test(problem) || token === undefined) throw noReport();
    if (!(await this.admin.deleteProblem(world.id, problem, hashToken(token)))) throw noReport();
    return { id: problem };
  }

  private today(): string {
    return new Date(this.limiters.now()).toISOString().slice(0, 10);
  }

  private enter(id: string, pass: string | undefined, request: IncomingMessage): Promise<World> {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
    return openWorld(this.store, id, pass);
  }
}

function noReport(): NotFoundException {
  return new NotFoundException('the world has no such report, or the token is not its own');
}
