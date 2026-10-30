// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Answers 503 with Retry-After when the store was too busy to answer in
// time, as when uploads to one world queue longer than a transaction may
// wait, so clients try again shortly instead of seeing a server error.

import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { StoreBusy } from './space-store.js';

export const RETRY_AFTER_SECONDS = 5;

@Catch(StoreBusy)
export class StoreBusyFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(_busy: StoreBusy, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const response: unknown = host.switchToHttp().getResponse();
    httpAdapter.setHeader(response, 'Retry-After', String(RETRY_AFTER_SECONDS));
    httpAdapter.setHeader(response, 'Cache-Control', 'no-store');
    const body = { statusCode: HttpStatus.SERVICE_UNAVAILABLE, message: 'the server is busy; try again shortly' };
    httpAdapter.reply(response, body, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
