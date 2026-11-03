// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's problem reports as the operators' console reads them from the demo
// server (#619, R-6.7-03, answer 656), with the world's pass: each by its ID,
// the part of the app, the note with pupils' names already replaced, the app's
// version and the UTC day it came, newest first, never a token; a note's bidi
// controls refused as the server refuses them, so nothing reads otherwise than
// it was sent. Marking one fixed erases it and logs the fix on the server; one
// the world no longer holds is said so, while a world that is gone, as for any
// read of it, is said as erased.

import { isDay, type Day } from '@minhajna/core';
import { unexpected, type Send } from '../demo/world-session';
import { NOTE_LIMIT, PARTS, type Part } from '../help/problem-report';
import { goneWorld } from './ops-system';

export type OpsProblem = {
  readonly id: string;
  readonly part: Part;
  readonly note: string;
  readonly version: string;
  readonly received: Day;
};

const ID = /^[0-9a-f]{32}$/u;
const VERSION = /^[0-9A-Za-z.+-]{1,32}$/u;
const REFUSED = /(?!\n)\p{Cc}|\p{Cs}|[\u202A-\u202E\u2066-\u2069]/u;
/** The server's word for a report the world does not hold, unlike a world that is gone. */
const NO_REPORT = 'the world has no such report, or the token is not its own';

/** A report as the console shows it, or null when it is shaped otherwise. */
export function opsProblem(value: unknown): OpsProblem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { id, part, note, version, received } = value as Record<string, unknown>;
  if (typeof id !== 'string' || !ID.test(id) || !PARTS.includes(part as Part)) return null;
  if (typeof note !== 'string' || note.trim() === '' || [...note].length > NOTE_LIMIT || REFUSED.test(note))
    return null;
  if (typeof version !== 'string' || !VERSION.test(version)) return null;
  if (typeof received !== 'string' || !isDay(received)) return null;
  return { id, part: part as Part, note, version, received };
}

/** The world's reports, newest first. */
export async function readProblems(world: string, send: Send): Promise<OpsProblem[]> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/problems` });
  goneWorld(answer);
  const body = answer.body as { problems?: unknown } | null;
  const problems = typeof body === 'object' && body !== null ? body.problems : undefined;
  const read = Array.isArray(problems) ? problems.map(opsProblem) : null;
  if (answer.status !== 200 || read === null || read.some((one) => one === null)) throw unexpected(answer);
  return read as OpsProblem[];
}

/** Marks a report fixed, which erases it: 'fixed', or 'gone' when the world no longer holds it. */
export async function markFixed(world: string, id: string, send: Send): Promise<'fixed' | 'gone'> {
  const answer = await send({ method: 'POST', path: `/worlds/${world}/problems/${id}/fixed` });
  if (answer.status === 200) return 'fixed';
  if (answer.status === 404 && (answer.body as { message?: unknown } | null)?.message === NO_REPORT) return 'gone';
  goneWorld(answer);
  throw unexpected(answer);
}
