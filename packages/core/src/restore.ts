// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A history restored from a Minhajna archive (#247, answer 478): the
// archive's entries exactly as they were, then, on the day of the restore,
// one erasure for each layer whose entries the archive left out, so the
// chain checks with their content gone (docs/formats/archive.md). The device
// layer is always among them: the teacher card's personal fields and the
// drawn signature are typed and drawn again (R-3.8-47). The result is checked
// whole before the app stores it, all at once, into an empty history.
// With a route, its source snapshot is recorded in that same write (#485),
// so a process ending before the next screen cannot lose the receipt.

import type { OpenedArchive } from './archive-read.ts';
import { isDay, type Day } from './day.ts';
import { ERASURE, HistoryError, verifyHistory, type Entry, type HistoryDeps } from './history.ts';
import { makeEntry } from './history-entry.ts';
import { isCopyRoute, type CopyRoute } from './device-events.ts';

/** The checked restore, including its atomic device receipt when a route is supplied. */
export async function restoredHistory(
  opened: Extract<OpenedArchive, { ok: true }>,
  day: Day,
  deps: HistoryDeps,
  from?: CopyRoute,
): Promise<readonly Entry[]> {
  if (!isDay(day)) throw new RangeError('The day of a change is written YYYY-MM-DD');
  if (from !== undefined && !isCopyRoute(from)) throw new RangeError('Invalid restore route');
  const out = new Set(opened.archive.leftOut);
  const left = opened.entries.filter((entry) => out.has(entry.id));
  const restored = [...opened.entries];
  for (const layer of new Set(left.map((entry) => entry.layer))) {
    const ids = left.filter((entry) => entry.layer === layer).map((entry) => entry.id);
    restored.push(
      await makeEntry(deps, restored.at(-1) ?? null, { day, layer, kind: ERASURE, body: { entries: ids } }),
    );
  }
  if (from !== undefined) {
    restored.push(
      await makeEntry(deps, restored.at(-1) ?? null, {
        day,
        layer: 'device',
        kind: 'copy.received',
        body: {
          kind: 'copy.received',
          received: { from, file: { made: opened.archive.made, last: opened.entries.at(-1)?.hash ?? '' } },
        },
      }),
    );
  }
  const problems = await verifyHistory(deps.digest, restored);
  if (problems.length > 0) throw new HistoryError([...new Set(problems.map((problem) => problem.kind))]);
  return restored;
}
