// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds the server's application, apart from listening, so the tests start
// the same application the server runs. NestJS runs straight on node:http
// through NodeAdapter. No request body is read until a route needs one.

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { LoggerService } from '@nestjs/common';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
import { PlainLogger } from './plain-logger.js';

export async function createApp(logger: LoggerService | false = new PlainLogger()): Promise<NestNodeApplication> {
  const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter(), {
    logger,
    bodyParser: false,
  });
  app.enableShutdownHooks();
  return app;
}
