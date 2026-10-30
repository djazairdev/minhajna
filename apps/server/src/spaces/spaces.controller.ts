// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The encrypted relay (#541, PRD §5.8). Inside a world, entered with its
// pass: PUT /worlds/:world/spaces/:space opens a space of a kind, POST
// .../batches adds a stream's next sealed batches, all or none,
// and GET .../batches?after=n reads them back in the order they arrived.
// The server stores the ciphertext and the minimum it needs to hand it on.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { limitRequest, openWorld } from '../worlds/world-access.js';
import { WORLD_STORE, type WorldStore } from '../worlds/world-store.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { isSpaceId, MAX_PAGE, readSpace, readUpload } from './space-rules.js';
import { SPACE_STORE, type SpaceKind, type SpaceStore } from './space-store.js';

interface BatchOut {
  readonly seq: number;
  readonly stream: string;
  readonly number: number;
  readonly bytes: string;
}

@Controller('worlds/:world/spaces')
export class SpacesController {
  constructor(
    @Inject(WORLD_STORE) private readonly worlds: WorldStore,
    @Inject(SPACE_STORE) private readonly spaces: SpaceStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  @Put(':space')
  @Header('Cache-Control', 'no-store')
  async open(
    @Param('world') world: string,
    @Param('space') space: string,
    @Body() body: unknown,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ kind: SpaceKind }> {
    await this.enter(world, pass, request);
    const read = readSpace(space, body);
    if ('problem' in read) throw new BadRequestException(read.problem);
    const added = await this.spaces.addSpace(world, space, read.kind);
    if (added === 'other') throw new ConflictException('this space exists with another kind');
    if (added === 'full') throw new ConflictException('the world holds as many spaces as it may');
    return { kind: read.kind };
  }

  @Post(':space/batches')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async add(
    @Param('world') world: string,
    @Param('space') space: string,
    @Body() body: unknown,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ added: number }> {
    await this.enter(world, pass, request);
    await this.findSpace(world, space);
    const upload = readUpload(body);
    if (typeof upload === 'string') throw new BadRequestException(upload);
    const added = await this.spaces.addBatches(world, space, upload.stream, upload.first, upload.batches);
    if (added === 'taken' || added === 'gap') {
      const next = await this.spaces.nextNumber(world, space, upload.stream);
      throw new ConflictException(`the stream's next batch is number ${next}`);
    }
    if (added === 'full') throw new ConflictException('the world holds as many batches as it may');
    if (added === 'server-full') {
      throw new HttpException('the server holds as many batches as it may', HttpStatus.INSUFFICIENT_STORAGE);
    }
    return { added: upload.batches.length };
  }

  @Get(':space/batches')
  @Header('Cache-Control', 'no-store')
  async read(
    @Param('world') world: string,
    @Param('space') space: string,
    @Query('after') after: string | undefined,
    @Headers('x-world-pass') pass: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ batches: BatchOut[]; more: boolean }> {
    await this.enter(world, pass, request);
    await this.findSpace(world, space);
    const from = after === undefined ? 0 : Number(after);
    if (!Number.isSafeInteger(from) || from < 0) throw new BadRequestException('after must be a whole number from 0');
    const batches = await this.spaces.batchesAfter(world, space, from, MAX_PAGE + 1);
    return {
      batches: batches.slice(0, MAX_PAGE).map(({ seq, stream, number, bytes }) => ({
        seq,
        stream,
        number,
        bytes: Buffer.from(bytes).toString('base64url'),
      })),
      more: batches.length > MAX_PAGE,
    };
  }

  private async enter(world: string, pass: string | undefined, request: IncomingMessage): Promise<void> {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
    await openWorld(this.worlds, world, pass);
  }

  private async findSpace(world: string, space: string): Promise<void> {
    if (!isSpaceId(space) || !(await this.spaces.kindOf(world, space))) {
      throw new NotFoundException('no space has this id in the world');
    }
  }
}
