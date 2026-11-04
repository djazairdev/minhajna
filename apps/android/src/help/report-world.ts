// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A problem report sent to the operators of the demo world the device has open
// (#619, answer 657), with the world's pass: exactly the part of the app, the
// note as previewed and the app's version, which the server keeps, never
// Android's version or the last screens, and nothing the app adds names the
// sender. The server answers the report's ID and a token, given once, that
// deletes it; the caller keeps the token in memory only. A world holding its
// 200 reports is refused as E_REPORTS_FULL, a world that is gone as erased,
// and a report the world no longer holds, when deleting, is said so rather
// than taken as a problem.

import { goneWorld } from '../demo/world-gone';
import { failed, unexpected, type Send } from '../demo/world-session';
import type { Part } from './problem-report';

export type WorldReport = { readonly part: Part; readonly note: string; readonly version: string };
export type SentReport = { readonly id: string; readonly token: string };

const ID = /^[0-9a-f]{32}$/u;
const TOKEN = /^[A-Za-z0-9_-]{43}$/u;
/** The server's word for a report the world does not hold, or a token not its own. */
const NO_REPORT = 'the world has no such report, or the token is not its own';

/** Sends the report to the world's operators, and answers its ID and the token that deletes it. */
export async function sendToWorld(world: string, report: WorldReport, send: Send): Promise<SentReport> {
  const { part, note, version } = report;
  const answer = await send({ method: 'POST', path: `/worlds/${world}/problems`, body: { part, note, version } });
  goneWorld(answer);
  if (answer.status === 409) throw failed('The world holds its 200 reports', 'E_REPORTS_FULL');
  const { id, token } = (answer.body ?? {}) as { id?: unknown; token?: unknown };
  if (
    answer.status !== 201 ||
    typeof id !== 'string' ||
    !ID.test(id) ||
    typeof token !== 'string' ||
    !TOKEN.test(token)
  )
    throw unexpected(answer);
  return { id, token };
}

/** Deletes a report sent from this screen: 'deleted', or 'gone' when the world no longer holds it. */
export async function deleteFromWorld(world: string, sent: SentReport, send: Send): Promise<'deleted' | 'gone'> {
  const answer = await send({
    method: 'POST',
    path: `/worlds/${world}/problems/${sent.id}/delete`,
    starter: sent.token,
  });
  if (answer.status === 200) return 'deleted';
  goneWorld(answer);
  if (answer.status === 404 && (answer.body as { message?: unknown } | null)?.message === NO_REPORT) return 'gone';
  throw unexpected(answer);
}
