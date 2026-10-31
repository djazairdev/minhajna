// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds the server's application, apart from listening, so the tests start
// the same application the server runs. NestJS runs straight on node:http
// through NodeAdapter. The web app's origin may call it (cors.ts). Bodies
// are read as JSON only; the body guard refuses one larger than its route
// takes before it is read.

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { LoggerService } from '@nestjs/common';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
import { BATCH_BODY, bodyGuard } from './body-guard.js';
import { cors } from './cors.js';
import { PlainLogger } from './plain-logger.js';
import type { WorldsOptions } from './worlds/worlds.module.js';

export async function createApp(
  logger: LoggerService | false = new PlainLogger(),
  worlds: WorldsOptions = {},
): Promise<NestNodeApplication> {
  const app = await NestFactory.create<NestNodeApplication>(AppModule.register(worlds), new NodeAdapter(), {
    logger,
    bodyParser: false,
  });
  app.use(cors);
  app.use(bodyGuard);
  app.useBodyParser('json', { limit: BATCH_BODY });
  app.enableShutdownHooks();
  return app;
}
