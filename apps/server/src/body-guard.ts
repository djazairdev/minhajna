// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Refuses a request body before it is read when it is larger than its route
// takes: 1 MB for a relay upload of up to 128 sealed batches, 64 KB for
// everything else. A body must say its length, so none is read unbounded.
// A refused body is drained so the client reads the answer, unless it
// claims more than DRAIN_AT, when the connection is closed instead.

import type { IncomingMessage, ServerResponse } from 'node:http';

export const SMALL_BODY = 64 * 1024;
export const BATCH_BODY = 1024 * 1024;
export const DRAIN_AT = 4 * BATCH_BODY;

const UPLOAD = /^\/worlds\/[^/?]+\/spaces\/[^/?]+\/batches(?:\?|$)/;

function refuse(response: ServerResponse, statusCode: number, message: string, close: boolean): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(close ? { Connection: 'close' } : {}),
  });
  response.end(JSON.stringify({ statusCode, message }));
}

export function bodyGuard(request: IncomingMessage, response: ServerResponse, next: () => void): void {
  const length = request.headers['content-length'];
  if (request.headers['transfer-encoding'] !== undefined && length === undefined) {
    refuse(response, 411, 'a body must say its length', true);
    return;
  }
  const most = request.method === 'POST' && UPLOAD.test(request.url ?? '') ? BATCH_BODY : SMALL_BODY;
  const claimed = Number(length ?? 0);
  if (claimed > most) {
    refuse(response, 413, `this route takes a body of at most ${most} bytes`, claimed > DRAIN_AT);
    return;
  }
  next();
}
