// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the world's client makes of an answer it did not expect: a server that
// says how long to wait is busy, as one waking from sleep says with a 503
// (apps/server/host/worker.ts), and any other answer is the server's problem.

import { unexpected } from '../src/demo/world-session';

test.each([
  [429, 12, 'E_WORLD_BUSY', 12],
  [429, null, 'E_WORLD_BUSY', undefined],
  [503, 15, 'E_WORLD_BUSY', 15],
  [503, null, 'E_WORLD_SERVER', undefined],
  [500, 15, 'E_WORLD_SERVER', undefined],
  [403, null, 'E_WORLD_SERVER', undefined],
] as const)('a %i with %s seconds to wait is %s', (status, retryAfter, code, seconds) => {
  const error = unexpected({ status, body: null, retryAfter }) as Error & { code: string; retryAfter?: number };
  expect(error.code).toBe(code);
  expect(error.retryAfter).toBe(seconds);
});
