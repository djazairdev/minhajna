// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the seeding tests share (#548, answer 625): made-up worlds started on a
// test server, seeding requests with or without the starter token, sealed
// batches of the relay's one size, and a space read back as the relay keeps it.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { SEALED_BATCH_BYTES } from '../src/spaces/space-rules.js';

export const OPEN = { perAddress: 10_000, total: 10_000, windowMs: 60_000 };
export const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDM';
export const SCHOOLS = ['c2Nob29sLW9uZS1vZi10aGUtZGVtbw', 'c2Nob29sLXR3by1vZi10aGUtZGVtbw'];
export const STREAMS = ['c3RyZWFtLW9uZS1vZi10aGUtZGVtbw', 'c3RyZWFtLXR3by1vZi10aGUtZGVtbw'];

const batch = () => randomBytes(SEALED_BATCH_BYTES).toString('base64url');
export const batches = (count: number) => Array.from({ length: count }, batch);

let ids = 0;
const freshId = () => `S${String((ids += 1)).padStart(4, '0')}`;

/** A new made-up world on the server at `url`, with its starter token. */
export async function start(url: string): Promise<{ world: string; starter: string }> {
  const world = freshId();
  const res = await fetch(`${url}/worlds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ world, sealed: 'c2VhbGVk', date: '2026-11-22', announcedDays: [], pass: PASS }),
  });
  assert.equal(res.status, 201);
  return { world, starter: ((await res.json()) as { starter: string }).starter };
}

/** A seeding request, with the starter token as given or none, and the pass. */
export function seed(url: string, world: string, path: string, body: unknown, authorization: string | null) {
  return fetch(`${url}/worlds/${world}/seed/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-world-pass': PASS,
      ...(authorization === null ? {} : { authorization }),
    },
    body: JSON.stringify(body),
  });
}

/** A space's batches as the relay keeps them, or its status when it answers none. */
export async function read(url: string, world: string, space: string) {
  const res = await fetch(`${url}/worlds/${world}/spaces/${space}/batches?after=0`, {
    headers: { 'x-world-pass': PASS },
  });
  if (res.status !== 200) return res.status;
  const body = (await res.json()) as { batches: { stream: string; number: number }[] };
  return body.batches.map(({ stream, number }) => ({ stream, number }));
}

/** The message of a refusal. */
export const message = async (res: Response) => ((await res.json()) as { message: string }).message;
