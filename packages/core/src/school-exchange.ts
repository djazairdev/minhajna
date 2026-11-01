// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the school exchanges (#592, D-Exchange, §7.5, §7.11, R-3.4-05,
// R-7.11-02, answer 620). The one choice the school makes on it, whether
// absences go to the sector's system, is kept in the director's world store
// under the school's space, on the world's date and never a clock time; it is
// off until the director turns it on, the latest counting, and each change from
// the choice before it is read back for My log. The school's space exported
// whole is one text, minhajna/space-export/1, naming the world, the space, the
// day exported and that it comes from a demo world, with every stream's sealed
// batches in the order given, as the relay keeps them, never opened, in
// base64url, so only the keys that sealed them read it; an ID that is not a
// space's is refused.

import type { SealedBatch } from './batches.ts';
import type { Day } from './day.ts';
import type { SchoolAbsences } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { SCHOOL } from './school-key-shape.ts';
import { record } from './timetable-record.ts';
import { toBase64Url } from './world-keys.ts';

export type { SchoolAbsences } from './device-events.ts';

/** The format of a school's space exported whole. */
export const SPACE_EXPORT = 'minhajna/space-export/1';

/** The absences choice as the store may keep it, or null when it does not read. */
export function readSchoolAbsences(value: unknown): SchoolAbsences | null {
  if (!record(value)) return null;
  const { school, send, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  return typeof send === 'boolean' ? { school, send } : null;
}

/** A change of the absences choice: the day it was made and whether absences are sent from then. */
export interface AbsencesChange {
  readonly day: Day;
  readonly send: boolean;
}

/** Each change of a school's absences choice from the one before it, off at first, by the day it was made. */
export function absencesChanges(entries: readonly Entry[], school: string): readonly AbsencesChange[] {
  const changes: AbsencesChange[] = [];
  let send = false;
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'school.absences' ? readSchoolAbsences(event.absences) : null;
    if (read === null || read.school !== school || read.send === send) continue;
    send = read.send;
    changes.push({ day: entry.day, send });
  }
  return changes;
}

/** Whether a school sends absences to the sector's system: its latest choice, off until it is made. */
export const absencesSent = (entries: readonly Entry[], school: string) =>
  absencesChanges(entries, school).at(-1)?.send ?? false;

/** A school's space exported whole: its sealed batches by stream, unopened, from a demo world. */
export function spaceExportText(
  head: { readonly world: string; readonly school: string; readonly exported: Day },
  streams: ReadonlyMap<string, readonly SealedBatch[]>,
): string {
  if (!SCHOOL.test(head.school)) throw new RangeError('Not a school space’s ID');
  return JSON.stringify({
    format: SPACE_EXPORT,
    demo: true,
    world: head.world,
    school: head.school,
    exported: head.exported,
    streams: [...streams].map(([stream, batches]) => ({
      stream,
      batches: batches.map((one) => ({ number: one.number, bytes: toBase64Url(one.bytes) })),
    })),
  });
}
