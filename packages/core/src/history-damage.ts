// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «تغيّر شيء من خارج التطبيق» shows (#235, Log-broken, R-5.5-04, answer
// 427), from a read-only inspection (#399): the last day that checks, the
// first day that cannot be checked, the changes that cannot be checked by
// kind, naming no class or pupil, and the log as far as it is trusted, then
// each later change as its kind and day. Nothing after a break is trusted,
// even where a later hash matches.

import { activityLog, type LogDay } from './activity-log.ts';
import { compareDays, type Day } from './day.ts';
import type { HistoryInspection } from './history-inspection.ts';

/** The kinds a damaged stretch's changes are counted by. */
export type DamagedKind = 'texts-book' | 'roll-call' | 'notes' | 'other';

export interface HistoryDamage {
  /** The day of the last change that checks; null when none does. */
  readonly trustedThrough: Day | null;
  /**
   * The day of the first change that cannot be checked and can still be read, never before `trustedThrough`:
   * it comes from an unchecked header, which a change or a phone's date going back can move earlier; null when
   * none can be read.
   */
  readonly uncheckedFrom: Day | null;
  /**
   * Changes, not records: each version counts, as unchecked content cannot tell records apart; an unreadable row
   * counts as other.
   */
  readonly counts: Readonly<Record<DamagedKind, number>>;
  readonly log: readonly LogDay[];
}

function damagedKind(kind: string | undefined): DamagedKind {
  switch (kind) {
    case 'session.recorded':
    case 'session.withdrawn':
    case 'homework.counted':
    case 'homework.uncounted':
    case 'extra.logged':
    case 'extra.removed':
      return 'texts-book';
    case 'roll-call.taken':
      return 'roll-call';
    case 'session.noted':
    case 'lesson-note.set':
      return 'notes';
    default:
      return 'other';
  }
}

/** What a broken history still shows; null for an intact one. */
export function historyDamage(inspection: HistoryInspection): HistoryDamage | null {
  if (inspection.integrity === 'intact') return null;
  const trusted = inspection.consistentPrefixLength;
  const rows = inspection.rows;
  const counts: Record<DamagedKind, number> = { 'texts-book': 0, 'roll-call': 0, notes: 0, other: 0 };
  for (const row of rows.slice(trusted)) counts[damagedKind(row.entry?.kind)] += 1;
  const trustedThrough = trusted === 0 ? null : (rows[trusted - 1]?.entry?.day ?? null);
  const header = rows.slice(trusted).find((row) => row.entry !== null)?.entry?.day ?? null;
  return {
    trustedThrough,
    uncheckedFrom:
      header !== null && trustedThrough !== null && compareDays(header, trustedThrough) < 0 ? trustedThrough : header,
    counts,
    log: activityLog(
      rows.map((row) => row.entry),
      trusted,
    ),
  };
}
