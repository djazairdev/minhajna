// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The server's root module: the health check, the demo's worlds, and the
// directory outside them, which shares their rate limits.

import { Module, type DynamicModule } from '@nestjs/common';
import { DirectoryModule } from './directory/directory.module.js';
import { HealthController } from './health/health.controller.js';
import { WorldsModule, worldLimiters, type WorldsOptions } from './worlds/worlds.module.js';

@Module({})
export class AppModule {
  static register(worlds: WorldsOptions = {}): DynamicModule {
    const limiters = worldLimiters(worlds);
    return {
      module: AppModule,
      imports: [WorldsModule.register(worlds, limiters), DirectoryModule.register(worlds.directory, limiters)],
      controllers: [HealthController],
    };
  }
}
