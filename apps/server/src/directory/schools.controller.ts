// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each school's book over HTTP (answers 807 to 809), outside any world, and
// only for a school in the published list: the first code set on the school
// guards its book, and only that code changes it. A teacher's phone reaches a
// book only through POST /directory/join, with the joining code the school gave
// it, and then only that teacher's classes and sessions; any code that opens
// nothing answers the same 404. A school since dropped from the list keeps its
// book, and its teachers still join, with no school named in what they get.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { isCode } from './core/directory-read.js';
import type { DirectorySchool } from './core/directory.js';
import { deliveryFor, readSchoolBook, type TeacherDelivery } from './core/directory-book.js';
import { DirectoryGate } from './directory-gate.js';
import { bookProblem, joiningHash, newJoiningCode, withoutCodes } from './directory-rules.js';
import { DIRECTORY_STORE, schoolDocument, type DirectoryStore, type KeptBook } from './directory-store.js';
import { answerSetCode, editCodesOf, expectedOf } from './reference.controller.js';

const UNKNOWN_CODE = 'no teacher has this joining code';

@Controller('directory')
export class SchoolsController {
  constructor(
    @Inject(DIRECTORY_STORE) private readonly store: DirectoryStore,
    private readonly gate: DirectoryGate,
  ) {}

  @Get('schools/:id/claimed')
  async claimed(@Param('id') id: string, @Req() request: IncomingMessage): Promise<{ claimed: boolean }> {
    this.gate.relay(request);
    await this.listed(id);
    return { claimed: (await this.store.codeHash(schoolDocument(id))) !== undefined };
  }

  @Post('schools/:id/code')
  @HttpCode(200)
  async setCode(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<{ claimed: true }> {
    this.gate.joins(request);
    await this.listed(id);
    const { hash, old } = editCodesOf(body);
    return answerSetCode(await this.store.setCode(schoolDocument(id), hash, old));
  }

  @Get('schools/:id/book')
  async book(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<KeptBook> {
    await this.enter(id, authorization, request);
    return this.store.book(id);
  }

  @Put('schools/:id/book')
  async saveBook(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() request: IncomingMessage,
  ): Promise<KeptBook> {
    await this.enter(id, authorization, request);
    const expected = expectedOf(body);
    const book = readSchoolBook(withoutCodes((body as { book?: unknown }).book));
    if (typeof book === 'string') throw new BadRequestException(book);
    const problem = bookProblem(book);
    if (problem !== null) throw new BadRequestException(problem);
    const saving = this.gate.saving(request, book);
    const kept = await this.store.saveBook(id, expected, book, newJoiningCode);
    if (kept === 'stale') throw new ConflictException('someone else saved first; read it again');
    if (kept === 'full')
      throw new HttpException('the directory holds all the books it can', HttpStatus.INSUFFICIENT_STORAGE);
    saving();
    return kept;
  }

  @Post('schools/:id/teachers/:teacher/code')
  @HttpCode(200)
  async renew(
    @Param('id') id: string,
    @Param('teacher') teacher: string,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: IncomingMessage,
  ): Promise<{ code: string }> {
    await this.enter(id, authorization, request);
    const code = newJoiningCode();
    if (!(await this.store.renewCode(id, teacher, code))) throw new NotFoundException('this book has no such teacher');
    return { code };
  }

  @Post('join')
  @HttpCode(200)
  async join(@Body() body: unknown, @Req() request: IncomingMessage): Promise<TeacherDelivery> {
    this.gate.joins(request);
    const code = (body as { code?: unknown } | null | undefined)?.code;
    if (typeof code !== 'string') throw new BadRequestException('code must be text');
    const hash = joiningHash(code);
    const joining = hash === null ? undefined : await this.store.joining(hash);
    if (joining === undefined) throw new NotFoundException(UNKNOWN_CODE);
    const list = await this.store.latest();
    const school = list?.schools.find((one) => one.id === joining.school) ?? null;
    const delivery = deliveryFor(joining.book, joining.teacher, school);
    if (delivery === null) throw new NotFoundException(UNKNOWN_CODE);
    return delivery;
  }

  /** Counts a read or a save, then lets through the holder of a listed school's code. */
  private async enter(id: string, authorization: string | undefined, request: IncomingMessage): Promise<void> {
    this.gate.relay(request);
    await this.listed(id);
    await this.gate.holds(schoolDocument(id), authorization, request);
  }

  /** The school in the published list, or 404. */
  private async listed(id: string): Promise<DirectorySchool> {
    const school = isCode(id) ? (await this.store.latest())?.schools.find((one) => one.id === id) : undefined;
    if (school === undefined) throw new NotFoundException('the published list has no such school');
    return school;
  }
}
