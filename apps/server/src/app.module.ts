// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The server's root module. The demo's worlds, spaces and storage join it
// in the issues that follow #538.

import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';

@Module({ controllers: [HealthController] })
export class AppModule {}
