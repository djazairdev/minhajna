// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// GET /health answers the package's version and nothing else, so the host
// check can compare it with the release's tag.

import { Controller, Get } from '@nestjs/common';
import { VERSION } from '../version.js';

@Controller('health')
export class HealthController {
  @Get()
  health(): { version: string } {
    return { version: VERSION };
  }
}
