// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's reference list over HTTP (answers 802 to 809), outside any
// world: GET /directory/reference answers the newest version to anyone, as a
// phone reads it during setup; the first code set on the list guards its draft,
// its publishing and its versions, and only that code changes it.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { hashToken } from '../worlds/world-rules.js';
import { readReferenceDraft, type ReferenceDraft, type ReferenceList } from './core/directory.js';
import { DirectoryGate } from './directory-gate.js';
import { dayOf, readEditCodes, readExpected } from './directory-rules.js';
import { DIRECTORY_STORE, REFERENCE, type DirectoryStore, type ReferenceVersion } from './directory-store.js';

const STALE = 'someone else saved first; read it again';
const VERSION = /^\d{4}\.\d{1,6}$/u;

/** What a request to set a code asks, or refused. */
export function editCodesOf(body: unknown): { hash: string; old: string | null } {
  const codes = readEditCodes(body);
  if (typeof codes === 'string') throw new BadRequestException(codes);
  return { hash: hashToken(codes.code), old: codes.old === null ? null : hashToken(codes.old) };
}

/** Answers what a store did to a code. */
export function answerSetCode(result: 'set' | 'refused'): { claimed: true } {
  if (result === 'refused') throw new ForbiddenException('this edit code is refused');
  return { claimed: true };
}

/** The revision a save follows, or refused. */
export function expectedOf(body: unknown): number {
  const expected = readExpected(body);
  if (typeof expected === 'string') throw new BadRequestException(expected);
  return expected;
}

@Controller('directory/reference')
export class ReferenceController {
  constructor(
    @Inject(DIRECTORY_STORE) private readonly store: DirectoryStore,
    private readonly gate: DirectoryGate,
  ) {}

  @Get()
  async list(@Req() request: IncomingMessage): Promise<ReferenceList> {
    this.gate.relay(request);
    const list = await this.store.latest();
    if (list === undefined) throw new NotFoundException('no list is published yet');
    return list;
  }

  @Get('claimed')
  async claimed(@Req() request: IncomingMessage): Promise<{ claimed: boolean }> {
    this.gate.relay(request);
    return { claimed: (await this.store.codeHash(REFERENCE)) !== undefined };
  }

  @Post('code')
  @HttpCode(200)
  async setCode(@Body() body: unknown, @Req() request: IncomingMessage): Promise<{ claimed: true }> {
    this.gate.joins(request);
    const { hash, old } = editCodesOf(body);
    return answerSetCode(await this.store.setCode(REFERENCE, hash, old));
  }

  @Get('state')
  async state(
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{
    revision: number;
    draft: ReferenceDraft | null;
    published: string | null;
    versions: ReferenceVersion[];
  }> {
    this.gate.relay(request);
    await this.gate.holds(REFERENCE, authorization, request);
    const versions = await this.store.versions();
    return { ...(await this.store.draft()), published: versions[0]?.version ?? null, versions };
  }

  @Put('draft')
  async saveDraft(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<{ revision: number }> {
    this.gate.relay(request);
    await this.gate.holds(REFERENCE, authorization, request);
    const expected = expectedOf(body);
    const draft = readReferenceDraft((body as { draft?: unknown }).draft);
    if (typeof draft === 'string') throw new BadRequestException(draft);
    const saving = this.gate.saving(request, draft);
    const revision = await this.store.saveDraft(expected, draft);
    if (revision !== 'stale') saving();
    if (revision === 'stale') throw new ConflictException(STALE);
    return { revision };
  }

  @Post('publish')
  @HttpCode(200)
  async publish(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<ReferenceVersion> {
    this.gate.relay(request);
    await this.gate.holds(REFERENCE, authorization, request);
    const done = await this.store.publish(expectedOf(body), dayOf(this.gate.now()));
    if (done === 'stale') throw new ConflictException(STALE);
    if (done === 'empty') throw new BadRequestException('save a draft before publishing');
    return done;
  }

  @Post('republish')
  @HttpCode(200)
  async republish(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<ReferenceVersion> {
    this.gate.relay(request);
    await this.gate.holds(REFERENCE, authorization, request);
    const version = (body as { version?: unknown } | null | undefined)?.version;
    if (typeof version !== 'string') throw new BadRequestException('version must name a published version');
    const done = VERSION.test(version) ? await this.store.republish(version, dayOf(this.gate.now())) : 'missing';
    if (done === 'missing') throw new NotFoundException('no version has this name');
    return done;
  }
}
