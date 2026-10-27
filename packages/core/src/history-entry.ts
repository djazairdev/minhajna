// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Making one history entry, shared by the history, a restore (#247) and a
// copy coming back (#250), which also links an entry onto another chain. It
// is kept out of the core's index: only those add entries to a chain.

import { canonicalJson } from './canonical.ts';
import type { Day } from './day.ts';
import type { Entry, HistoryDeps } from './history.ts';
import { contentText, headerText } from './history-text.ts';
import { newId, toHex } from './id.ts';
import type { Layer } from './layers.ts';

export interface EntryInput {
  readonly day: Day;
  readonly layer: Layer;
  readonly kind: string;
  readonly body: unknown;
}

/**
 * Hashes a new entry onto `previous`. The stored body is parsed back from
 * the hashed text, so what is kept is exactly what was hashed, and later
 * changes to the caller's object cannot reach it.
 */
export async function makeEntry(deps: HistoryDeps, previous: Entry | null, input: EntryInput): Promise<Entry> {
  const bodyText = canonicalJson(input.body);
  const salt = toHex(deps.random(16));
  const header = {
    id: newId(deps.random),
    seq: previous === null ? 0 : previous.seq + 1,
    day: input.day,
    layer: input.layer,
    kind: input.kind,
    digest: await deps.digest(contentText(salt, bodyText)),
    previous: previous === null ? '' : previous.hash,
  };
  const body: unknown = JSON.parse(bodyText);
  return { ...header, hash: await deps.digest(headerText(header)), content: { salt, body } };
}

/**
 * The same entry linked after `previous` instead: its ID, day, layer, kind
 * and content stay, so erasures that name it still do, and only its place,
 * its link and its hash change.
 */
export async function relinkedEntry(deps: Pick<HistoryDeps, 'digest'>, previous: Entry, entry: Entry): Promise<Entry> {
  const header = {
    id: entry.id,
    seq: previous.seq + 1,
    day: entry.day,
    layer: entry.layer,
    kind: entry.kind,
    digest: entry.digest,
    previous: previous.hash,
  };
  return { ...header, hash: await deps.digest(headerText(header)), content: entry.content };
}
