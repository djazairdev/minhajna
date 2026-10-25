// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { awaitingBetween, confirmSessions, type Choice, type Day, type RecordBook } from '../src/index.ts';
import { contextOf } from './fixtures.ts';

/** Confirms only invented sessions in the chosen span, against their current proposals. */
export async function confirmStatementDays(book: RecordBook, from: Day, to: Day, choice?: Choice): Promise<void> {
  const context = contextOf(book);
  const sessions = awaitingBetween(context, from, to);
  await book.recordAll(
    to,
    confirmSessions(
      context,
      sessions.map((session) => ({ session, ...(choice !== undefined && { choice }) })),
    ),
  );
}
