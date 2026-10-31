// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lets the PC web app call the demo server from its own origin (answer 583):
// https://minhajna.djazair.dev, and where it is tried locally: its ZIP at
// http://127.0.0.1:4180, and its Worker at http://127.0.0.1:8787. Only those
// origins are named back, only for the methods and headers the demo client
// sends, and never with credentials: a world's pass travels in X-World-Pass,
// not a cookie. The client may read Retry-After. A preflight from any other
// origin, or for another method or header, is refused before it reaches a
// route.

import type { IncomingMessage, ServerResponse } from 'node:http';

export const WEB_ORIGINS: ReadonlySet<string> = new Set([
  'https://minhajna.djazair.dev',
  'http://127.0.0.1:4180',
  'http://127.0.0.1:8787',
]);
export const CORS_METHODS: ReadonlySet<string> = new Set(['GET', 'POST', 'PUT']);
export const CORS_HEADERS: ReadonlySet<string> = new Set(['accept', 'authorization', 'content-type', 'x-world-pass']);

/** How long a browser may keep a preflight's answer, in seconds. */
const PREFLIGHT_KEPT = 600;

/** Whether every header a preflight asks for is one the demo client sends. */
function allowedHeaders(asked: string | undefined): boolean {
  const names = (asked ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '');
  return names.every((name) => CORS_HEADERS.has(name));
}

export function cors(request: IncomingMessage, response: ServerResponse, next: () => void): void {
  const origin = request.headers.origin;
  const named = origin !== undefined && WEB_ORIGINS.has(origin);
  response.setHeader('Vary', 'Origin');
  if (named) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  }
  const method = request.headers['access-control-request-method'];
  if (request.method !== 'OPTIONS' || method === undefined) {
    next();
    return;
  }
  const allowed =
    named && CORS_METHODS.has(method) && allowedHeaders(request.headers['access-control-request-headers']);
  if (allowed) {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': [...CORS_METHODS].join(', '),
      'Access-Control-Allow-Headers': [...CORS_HEADERS].join(', '),
      'Access-Control-Max-Age': String(PREFLIGHT_KEPT),
      'Cache-Control': 'no-store',
    });
    response.end();
    return;
  }
  response.removeHeader('Access-Control-Allow-Origin');
  response.removeHeader('Access-Control-Expose-Headers');
  response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ statusCode: 403, message: 'this origin, method or header is not allowed' }));
}
