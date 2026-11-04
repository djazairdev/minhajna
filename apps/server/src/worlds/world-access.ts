// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Entering a world on the server: its id and its pass, or nothing. A wrong pass
// answers exactly as an unknown id does, and takes as long, since an unknown id
// is checked against a stand-in hash, so a guesser learns nothing; that refusal
// is a PassRefused, which the security log counts (#619). Requests over the
// rate limits answer 429.

import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { clientAddress, type Limiter } from './limits.js';
import { hashToken, holdsPass, isWorldId } from './world-rules.js';
import type { World, WorldStore } from './world-store.js';

const STAND_IN = hashToken('no world has this id');
const NO_WORLD = 'no world has this id and pass';

/** A world id and pass that opened nothing, answered exactly as any unknown world. */
export class PassRefused extends NotFoundException {
  constructor() {
    super(NO_WORLD);
  }
}

export async function openWorld(store: WorldStore, id: string, pass: string | undefined): Promise<World> {
  const world = isWorldId(id) ? await store.get(id) : undefined;
  const fits = holdsPass(pass, world?.passHash ?? STAND_IN);
  if (!world || !fits) throw new PassRefused();
  return world;
}

export function tooMany(): HttpException {
  return new HttpException('too many requests; try again later', HttpStatus.TOO_MANY_REQUESTS);
}

export function limitRequest(limiter: Limiter, request: IncomingMessage, trustCloudflare: boolean): void {
  if (!limiter.take(clientAddress(request, trustCloudflare))) throw tooMany();
}

export function noWorld(): NotFoundException {
  return new NotFoundException(NO_WORLD);
}
