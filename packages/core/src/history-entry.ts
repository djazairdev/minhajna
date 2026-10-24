// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Making one history entry, shared by the history and a restore (#247). It is
// kept out of the core's index: only those two add entries to a chain.

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
