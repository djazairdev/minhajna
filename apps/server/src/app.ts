// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds the server's application, apart from listening, so the tests start
// the same application the server runs. NestJS runs straight on node:http
// through NodeAdapter. Bodies are read as JSON only, up to 64 KB, since a
// sealed world is small; anything larger is refused before a route runs.

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { LoggerService } from '@nestjs/common';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
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
  app.useBodyParser('json', { limit: '64kb' });
  app.enableShutdownHooks();
  return app;
}
