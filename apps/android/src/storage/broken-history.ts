// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A history that does not verify (#235, Log-broken, R-5.5-04, answer 427):
// its stored rows are read once more, as they are, and inspected read-only
// (#399), never repaired, rewritten or added to. When the rows can be read
// but the chain breaks, the app shows what still checks; a history it cannot
// read at all, or whose key is gone, keeps the one short line it had. The
// names a trusted line needs come from the changes that check alone.

import { buildState, historyDamage, inspectHistory, type HistoryDamage, type State } from '@minhajna/core';
import { fromRow, nativeDeps, type HistorySpec } from './history';

export interface BrokenHistory {
  readonly damage: HistoryDamage;
  /** The records as far as the history checks, to name classes and pupils in the trusted log. */
  readonly state: State;
}

/** A stored row as an entry when it reads as one, or else as it is, which the inspection finds unreadable. */
function loose(row: unknown): unknown {
  try {
    return fromRow(row as Parameters<typeof fromRow>[0]);
  } catch {
    return row;
  }
}

/** What a history that did not open still shows; null when it cannot be read or nothing is broken. */
export async function readBroken(native: HistorySpec): Promise<BrokenHistory | null> {
  try {
    const rows: unknown = JSON.parse(await native.loadHistory());
    if (!Array.isArray(rows)) return null;
    const inspection = await inspectHistory(nativeDeps(native).digest, rows.map(loose));
    const damage = historyDamage(inspection);
    if (damage === null) return null;
    const trusted = inspection.rows.slice(0, inspection.consistentPrefixLength).flatMap((row) => row.entry ?? []);
    return { damage, state: buildState(trusted) };
  } catch {
    return null;
  }
}
