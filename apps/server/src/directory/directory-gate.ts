// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Who gets into the directory (answer 809), under the worlds' rate limits: a
// read or a save counts with the relay, and setting a code or joining with the
// joins. An edit code refused counts with the joins too, so a guess costs what
// a join does however the guesser asks; holders of the code, who save often,
// count with the relay, and each save also against the daily quota of uploads,
// by its bytes. A refused code answers 403, whether or not any is set.

import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { SEALED_BATCH_BYTES } from '../spaces/space-rules.js';
import { clientAddress } from '../worlds/limits.js';
import { limitRequest, tooMany } from '../worlds/world-access.js';
import { hashToken } from '../worlds/world-rules.js';
import { WORLD_LIMITERS, type WorldLimiters } from '../worlds/worlds.controller.js';
import { bearerCode } from './directory-rules.js';
import { DIRECTORY_STORE, type DirectoryStore } from './directory-store.js';

const STAND_IN = hashToken('no document has this code');

const sameHash = (a: string, b: string): boolean => timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

@Injectable()
export class DirectoryGate {
  constructor(
    @Inject(DIRECTORY_STORE) private readonly store: DirectoryStore,
    @Inject(WORLD_LIMITERS) private readonly limiters: WorldLimiters,
  ) {}

  /** Counts a read or a save. */
  relay(request: IncomingMessage): void {
    limitRequest(this.limiters.relay, request, this.limiters.trustCloudflare);
  }

  /** Counts setting a code or joining. */
  joins(request: IncomingMessage): void {
    limitRequest(this.limiters.joins, request, this.limiters.trustCloudflare);
  }

  /**
   * Checks a save fits the address's daily quota of uploads, counted as the sealed batches its bytes would fill, as a
   * world's uploads are; answers what counts it once it is kept.
   */
  saving(request: IncomingMessage, saved: unknown): () => void {
    const address = clientAddress(request, this.limiters.trustCloudflare);
    const cost = Math.ceil(Buffer.byteLength(JSON.stringify(saved), 'utf8') / SEALED_BATCH_BYTES);
    if (!this.limiters.uploads.fits(address, cost)) throw tooMany();
    return () => this.limiters.uploads.charge(address, cost);
  }

  /** The server's date. */
  now(): number {
    return this.limiters.now();
  }

  /** Lets through the holder of the document's edit code, or refuses. */
  async holds(document: string, authorization: string | undefined, request: IncomingMessage): Promise<void> {
    const address = clientAddress(request, this.limiters.trustCloudflare);
    if (!this.limiters.joins.fits(address)) throw tooMany();
    const code = bearerCode(authorization);
    const kept = await this.store.codeHash(document);
    const fits = sameHash(hashToken(code ?? ''), kept ?? STAND_IN);
    if (code !== undefined && kept !== undefined && fits) return;
    this.limiters.joins.charge(address, 1);
    throw new ForbiddenException('this edit code is refused');
  }
}
