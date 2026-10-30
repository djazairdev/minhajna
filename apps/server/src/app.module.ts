// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The server's root module: the health check and the demo's worlds. Spaces
// and storage join it in the issues that follow.

import { Module, type DynamicModule } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { WorldsModule, type WorldsOptions } from './worlds/worlds.module.js';

@Module({})
export class AppModule {
  static register(worlds: WorldsOptions = {}): DynamicModule {
    return { module: AppModule, imports: [WorldsModule.register(worlds)], controllers: [HealthController] };
  }
}
