// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes the server's start into the admin log (#619, answer 656), by the UTC
// day, with its version, its fingerprint, or none, and the migrations it
// applied as it started, if any, as the module starts, before the first sweep
// can log an erasure. A failure to write it is logged without stopping the
// server, since serving matters more than the line.

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { VERSION } from '../version.js';
import { ADMIN_STORE, type AdminStore } from './admin-store.js';
import { FINGERPRINT } from './fingerprint.js';

export const ADMIN_START = Symbol('AdminStart');

/** What the server did as it started, before the application existed. */
export interface AdminStart {
  readonly now: () => number;
  readonly migrations: readonly string[];
}

@Injectable()
export class AdminJournal implements OnModuleInit {
  private readonly logger = new Logger('Admin');

  constructor(
    @Inject(ADMIN_STORE) private readonly admin: AdminStore,
    @Inject(ADMIN_START) private readonly start: AdminStart,
  ) {}

  async onModuleInit(): Promise<void> {
    const day = new Date(this.start.now()).toISOString().slice(0, 10);
    const detail = {
      version: VERSION,
      fingerprint: FINGERPRINT ?? 'none',
      ...(this.start.migrations.length > 0 ? { migrations: this.start.migrations } : {}),
    };
    try {
      await this.admin.log({ day, action: 'server.started', detail });
    } catch (error) {
      this.logger.error(`the start was not logged: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
