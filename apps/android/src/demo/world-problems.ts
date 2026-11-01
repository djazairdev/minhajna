// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What went wrong on the demo worlds' own pages (#560, #561): each error's code
// in the catalogue's words, and any other code as the server's answer.

export type ProblemKey =
  `demo.problem.${'code' | 'none' | 'busy' | 'offline' | 'lastDay' | 'store' | 'device' | 'other'}`;

/** The catalogue's words for an error's code. */
const PROBLEMS: Readonly<Record<string, ProblemKey>> = {
  E_WORLD_CODE: 'demo.problem.code',
  E_NO_SUCH_WORLD: 'demo.problem.none',
  E_WORLD_BUSY: 'demo.problem.busy',
  E_OFFLINE: 'demo.problem.offline',
  E_TIMEOUT: 'demo.problem.offline',
  E_REFUSED: 'demo.problem.device',
  E_WORLD_KIT: 'demo.problem.device',
  E_NO_WORLD: 'demo.problem.device',
  E_WORLD_LEFT_DAYS: 'demo.problem.lastDay',
  E_WORLD: 'demo.problem.store',
  E_KEY_LOST: 'demo.problem.store',
};

/** What went wrong entering, moving or leaving a world, in the catalogue's words. */
export function problemOf(error: unknown): ProblemKey {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === 'string' ? PROBLEMS[code] : undefined) ?? 'demo.problem.other';
}
