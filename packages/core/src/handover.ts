// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The working copy handed to the teacher's other device and back (#250,
// answers 503, 513, 514 and 515). While the copy is on the other device,
// this one records only what never leaves it, its recovery key, its backups
// and the handover itself, and the log of what it prints or saves. A copy
// that comes back, a transfer or a backup with the private notes, is taken
// only if it continues this one: every entry handed over, but the device
// layer's, is in it with the same ID and content, in the same order, so
// each round trip continues the last. The history stays append-only (PRD
// §5.5): what the other device recorded since is linked on after this
// device's own entries, its IDs and content unchanged, then the end of the
// handover. The device layer stays each device's own: none of the other
// device's is added, not even its erasures, so its restore's erasure of
// this device's keys and its own key never come here. Any other erasure
// made there applies here, to entries handed over only; one that names an
// entry this device made since refuses the copy. The app stores what this
// gives all at once, and the erasures run as the history reopens.

import type { OpenedArchive } from './archive-read.ts';
import type { Day } from './day.ts';
import { deviceFacts } from './devices.ts';
import { layerOf, type RecordEvent } from './events.ts';
import { HistoryError, erasedIds, verifyHistory, type Entry, type HistoryDeps } from './history.ts';
import { makeEntry, relinkedEntry } from './history-entry.ts';

type Opened = Extract<OpenedArchive, { ok: true }>;

/** What a device records while its working copy is on the other device. */
const WHILE_HANDED_OVER: ReadonlySet<string> = new Set([
  'recovery.set',
  'backup.saved',
  'handover.sent',
  'handover.ended',
  'output.recorded',
]);

/** Whether an event or entry of this kind may be recorded while the working copy is on the other device. */
export function recordsWhileHandedOver(event: RecordEvent | Pick<Entry, 'kind'>): boolean {
  return WHILE_HANDED_OVER.has(event.kind);
}

/** Why a returned copy is not taken: the copy is here, or the returned one does not continue it. */
export type HandoverProblem = 'not-handed-over' | 'not-continued';

export class HandoverError extends Error {
  readonly problem: HandoverProblem;

  constructor(problem: HandoverProblem) {
    super(`The returned copy is not taken: ${problem}`);
    this.name = 'HandoverError';
    this.problem = problem;
  }
}

/** What taking a copy back adds to this device's history, and the entries whose content it erases. */
export interface TakenBack {
  readonly entries: readonly Entry[];
  readonly erase: readonly string[];
}

/**
 * Whether `opened` holds every entry of `handed` but the device layer's,
 * with the same content and in the same order, and leaves out nothing else.
 */
function continues(handed: readonly Entry[], opened: Opened): boolean {
  const place = new Map(opened.entries.map((entry, index) => [entry.id, index]));
  const out = new Set(opened.archive.leftOut);
  if (!opened.archive.privateNotes || opened.entries.some((e) => out.has(e.id) && e.layer !== 'device')) return false;
  const shared = handed.filter((entry) => entry.layer !== 'device');
  let last = -1;
  for (const entry of shared) {
    const index = place.get(entry.id) ?? -1;
    const theirs = opened.entries[index];
    if (index <= last || theirs?.digest !== entry.digest || theirs.kind !== entry.kind) return false;
    last = index;
  }
  return shared.length > 0;
}

/** The entries a returned copy adds, checked with this device's history as it will be. */
export async function takenBack(
  ours: readonly Entry[],
  opened: Opened,
  day: Day,
  deps: HistoryDeps,
): Promise<TakenBack> {
  const handed = deviceFacts(ours).handedOver;
  if (handed === null) throw new HandoverError('not-handed-over');
  const at = ours.findIndex((entry) => entry.hash === handed.last);
  if (at < 0 || !continues(ours.slice(0, at + 1), opened)) throw new HandoverError('not-continued');
  const handedIds = new Set(ours.slice(0, at + 1).map((entry) => entry.id));
  const here = new Set(ours.map((entry) => entry.id));
  const erase = new Set<string>();
  const entries: Entry[] = [];
  let previous = ours[ours.length - 1]!;
  for (const entry of opened.entries) {
    if (entry.layer === 'device' || here.has(entry.id)) continue;
    for (const id of erasedIds(entry) ?? []) {
      if (handedIds.has(id)) erase.add(id);
      else if (here.has(id)) throw new HandoverError('not-continued');
    }
    previous = await relinkedEntry(deps, previous, entry);
    entries.push(previous);
  }
  const ended: RecordEvent = { kind: 'handover.ended', handover: { how: 'back' } };
  entries.push(await makeEntry(deps, previous, { day, layer: layerOf(ended), kind: ended.kind, body: ended }));
  const whole = [...ours.map((entry) => (erase.has(entry.id) ? { ...entry, content: null } : entry)), ...entries];
  const problems = await verifyHistory(deps.digest, whole);
  if (problems.length > 0) throw new HistoryError([...new Set(problems.map((problem) => problem.kind))]);
  return { entries, erase: [...erase] };
}
