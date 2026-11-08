// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory's module (answers 802 to 809): the Ministry's list and the
// schools' books, under the same rate limits as the worlds, whose limiters it
// is given, and outside any world, so no sweep reaches it.

import { Module, type DynamicModule } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { DirectoryGate } from './directory-gate.js';
import { DIRECTORY_STORE, MemoryDirectoryStore, type DirectoryStore } from './directory-store.js';
import { ReferenceController } from './reference.controller.js';
import { SchoolsController } from './schools.controller.js';

const DIRECTORY = /^\/directory(?:[/?]|$)/u;

/** Marks every answer under /directory no-store, a refusal's too, before anything can answer. */
export function directoryNoStore(request: { url?: string }, response: ServerResponse, next: () => void): void {
  if (DIRECTORY.test(request.url ?? '')) response.setHeader('Cache-Control', 'no-store');
  next();
}

@Module({})
export class DirectoryModule {
  static register(store: DirectoryStore = new MemoryDirectoryStore(), limiters: WorldLimiters): DynamicModule {
    return {
      module: DirectoryModule,
      controllers: [ReferenceController, SchoolsController],
      providers: [
        { provide: DIRECTORY_STORE, useValue: store },
        { provide: WORLD_LIMITERS, useValue: limiters },
        DirectoryGate,
      ],
    };
  }
}
