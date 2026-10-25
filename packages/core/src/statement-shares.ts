// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل المشاركة» (#439, Share, Share-to, R-3.10-10, answer 486): every
// statement that left, read from the history, newest day first, each with the
// role said last for it, or none yet. The history is only added to: a role said
// later is a new event, and the earlier one stays in the history. A role for no
// share in the history, or not one of the five, is left out, and so is a share
// whose way out this version does not know. The activity log names a share and
// its recipient the same way, never a person or the statement's content.

import { compareDays, type Day } from './day.ts';
import { eventOf, type RecordEvent } from './events.ts';
import type { Entry } from './history.ts';
import { SHARE_HOWS, SHARE_ROLES, type ShareHow, type ShareRole, type StatementShare } from './share-events.ts';

export {
  SHARE_HOWS,
  SHARE_KINDS,
  SHARE_ROLES,
  type ShareEvent,
  type ShareHow,
  type ShareRole,
} from './share-events.ts';
export type { StatementShare } from './share-events.ts';

/** One line of the sharing history. */
export interface SharedStatement extends StatementShare {
  readonly day: Day;
  readonly to: ShareRole | null;
}

/** A line of the activity log: a share when it left, or the role it went to. */
export type ShareLine =
  | { readonly kind: 'shared'; readonly share: StatementShare }
  | { readonly kind: 'sent'; readonly share: StatementShare; readonly to: ShareRole };

const isRole = (value: unknown): value is ShareRole => (SHARE_ROLES as readonly unknown[]).includes(value);
const isHow = (value: unknown): value is ShareHow => (SHARE_HOWS as readonly unknown[]).includes(value);

/** The shares in the history, newest day first, and within a day the latest first. */
export function sharingHistory(entries: readonly Entry[]): SharedStatement[] {
  const shares: { readonly share: StatementShare; readonly day: Day }[] = [];
  const roles = new Map<string, ShareRole>();
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind === 'statement.shared' && isHow(event.share.how))
      shares.push({ share: event.share, day: entry.day });
    else if (event?.kind === 'statement.sent' && isRole(event.sent.to)) roles.set(event.sent.id, event.sent.to);
  }
  return shares
    .map(({ share, day }) => ({ ...share, day, to: roles.get(share.id) ?? null }))
    .reverse()
    .sort((a, b) => compareDays(b.day, a.day));
}

/** The log's line for a share event, given the shares seen before it; null for a role of no share seen. */
export function shareLine(event: RecordEvent, seen: Map<string, StatementShare>): ShareLine | null {
  if (event.kind === 'statement.shared') {
    if (!isHow(event.share.how)) return null;
    seen.set(event.share.id, event.share);
    return { kind: 'shared', share: event.share };
  }
  if (event.kind !== 'statement.sent' || !isRole(event.sent.to)) return null;
  const share = seen.get(event.sent.id);
  return share === undefined ? null : { kind: 'sent', share, to: event.sent.to };
}
