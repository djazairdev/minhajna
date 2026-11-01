// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erase warnings count backups and transfers confirmed opened on another
// device (#494). A transfer covers only its earlier hash, never changes made
// while its file was being saved or opened. Its confirmation is bookkeeping;
// it neither counts as a lost change nor resets the backup reminder. Coverage
// survives an ended handover, and an older file never replaces a newer copy.

import type { Day } from './day.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';

/** The copy available elsewhere and the changes it does not cover, for the erase warning alone. */
export interface EraseCoverage {
  /** The best confirmed coverage, by history order; null before a backup or valid transfer. */
  readonly lastCopy: { readonly from: 'backup' | 'transfer'; readonly day: Day } | null;
  /** Entries after that boundary, excluding valid transfer confirmations; all entries before any copy. */
  readonly sinceCopy: number;
}

/** What is known to be held elsewhere, without treating a transfer as a retained backup. */
export function eraseCoverage(entries: readonly Entry[]): EraseCoverage {
  const before = new Map<string, number>();
  let lastCopy: EraseCoverage['lastCopy'] = null;
  let changes = 0;
  let covered = 0;
  for (const entry of entries) {
    const event = eventOf(entry);
    const boundary = event?.kind === 'handover.sent' ? before.get(event.handover?.last) : undefined;
    if (boundary === undefined) changes += 1;
    if (event?.kind === 'backup.saved') {
      covered = changes;
      lastCopy = { from: 'backup', day: entry.day };
    }
    if (boundary !== undefined && boundary >= covered) {
      covered = boundary;
      lastCopy = { from: 'transfer', day: entry.day };
    }
    before.set(entry.hash, changes);
  }
  return { lastCopy, sinceCopy: changes - covered };
}
