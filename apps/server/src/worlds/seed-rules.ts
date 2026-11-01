// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the seeding requests take (#548, answer 625): the device that started a
// world, a national one for #548 though the server cannot tell a world's kind,
// certifies its seeded teachers' signing keys, up to MAX_SEED_CERTIFICATES at
// once, each request read as the CA reads one; and opens spaces, then adds
// batches to streams of any space open in the world, up to MAX_SEED_SPACES
// spaces and MAX_BATCHES_PER_REQUEST batches in all, each space and stream read
// as the relay reads one, with nothing else. A refusal names the first item
// refused, counted from 0.

import { isSpaceId, MAX_BATCHES_PER_REQUEST, readSpace, readUpload, type BatchUpload } from '../spaces/space-rules.js';
import type { SpaceKind } from '../spaces/space-store.js';
import { readCertificateRequest, type CertificateRequest } from './stand-in-ca.js';

export const MAX_SEED_CERTIFICATES = 128;
export const MAX_SEED_SPACES = 128;

export interface SeedSpace {
  readonly space: string;
  readonly kind: SpaceKind;
}

export interface SeedUpload extends BatchUpload {
  readonly space: string;
}

export interface SeedBatches {
  readonly spaces: readonly SeedSpace[];
  readonly streams: readonly SeedUpload[];
}

/** Whether a body is an object with exactly these fields. */
function hasFields(body: unknown, fields: readonly string[]): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === fields.length && fields.every((field) => keys.includes(field));
}

/** The certificate requests a seeding sends, or why they are refused. */
export function readSeedCertificates(body: unknown, world: string): CertificateRequest[] | string {
  if (!hasFields(body, ['requests'])) return 'the request is an object with requests and nothing else';
  const { requests } = body;
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > MAX_SEED_CERTIFICATES) {
    return `requests must list 1 to ${MAX_SEED_CERTIFICATES} certificate requests`;
  }
  const read: CertificateRequest[] = [];
  for (const [at, one] of requests.entries()) {
    const request = readCertificateRequest(one, world);
    if (typeof request === 'string') return `request ${at}: ${request}`;
    read.push(request);
  }
  return read;
}

/** The spaces a seeding opens and the streams it adds to, or why they are refused. */
export function readSeedBatches(body: unknown): SeedBatches | string {
  if (!hasFields(body, ['spaces', 'streams'])) return 'the request is an object with spaces and streams';
  const { spaces, streams } = body;
  if (!Array.isArray(spaces)) return 'spaces must be a list';
  if (spaces.length > MAX_SEED_SPACES) return `spaces must list at most ${MAX_SEED_SPACES} spaces`;
  if (!Array.isArray(streams)) return 'streams must be a list';
  if (streams.length > MAX_BATCHES_PER_REQUEST) {
    return `a seeding adds at most ${MAX_BATCHES_PER_REQUEST} batches in all`;
  }
  if (spaces.length + streams.length < 1) return 'a seeding opens or adds something';
  const opened: SeedSpace[] = [];
  for (const [at, one] of spaces.entries()) {
    if (!hasFields(one, ['space', 'kind']) || typeof one['space'] !== 'string') {
      return `space ${at}: a space has an id and a kind`;
    }
    const read = readSpace(one['space'], one);
    if ('problem' in read) return `space ${at}: ${read.problem}`;
    opened.push({ space: one['space'], kind: read.kind });
  }
  const added: SeedUpload[] = [];
  for (const [at, one] of streams.entries()) {
    if (!hasFields(one, ['space', 'stream', 'first', 'batches']) || typeof one['space'] !== 'string') {
      return `stream ${at}: a stream has a space, a name, its first number and batches`;
    }
    const { space, ...rest } = one;
    const upload = readUpload(rest);
    if (typeof upload === 'string') return `stream ${at}: ${upload}`;
    if (!isSpaceId(space)) return `stream ${at}: a space id is 16 to 43 base64url characters`;
    added.push({ space, ...upload });
  }
  if (added.reduce((sum, one) => sum + one.batches.length, 0) > MAX_BATCHES_PER_REQUEST) {
    return `a seeding adds at most ${MAX_BATCHES_PER_REQUEST} batches in all`;
  }
  return { spaces: opened, streams: added };
}
