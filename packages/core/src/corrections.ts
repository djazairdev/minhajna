// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's corrections, for the director's monthly check (#218,
// PRD §5.5, R-3.8-16, R-5.5-02, answer 266): every version of a confirmed
// session or of a logged extra session after its first record, the same
// day too, with the version before it, the day of the change and its
// reason. Withdrawing a confirmation or removing an extra session is a
// correction too, and so is recording it again afterwards, from nothing
// standing to the new version. A correction belongs to the month of the
// entry it corrects, the day the entry stands on after it, so the director
// finds it beside that month's paper page; an extra session moved to another
// month belongs to both, the one it left and the one it reached. Nothing is
// scored (R-2.6-07).

import { compareDays, type Day } from './day.ts';
import type { ExtraSession } from './extra-records.ts';
import type { SessionRecord } from './records.ts';
import type { State, Version } from './state.ts';

/** One change to an entry: what stood before and what stands after, null while withdrawn or removed. */
export interface Correction<T> {
  readonly key: string;
  readonly courseId: string;
  /** The day of the entry, which places it in a month. */
  readonly entryDay: Day;
  /** The day the entry stood on before, when the change moved it. */
  readonly movedFrom?: Day;
  readonly before: T | null;
  readonly after: T | null;
  /** The day the change was recorded. */
  readonly day: Day;
  readonly reason?: string;
}

export interface BookCorrections {
  readonly sessions: readonly Correction<SessionRecord>[];
  readonly extras: readonly Correction<ExtraSession>[];
}

function changes<T>(
  key: string,
  versions: readonly Version<T | null>[],
  where: (value: T) => { readonly courseId: string; readonly day: Day },
): Correction<T>[] {
  const found: Correction<T>[] = [];
  let previous: T | null = null;
  let recorded = false;
  for (const version of versions) {
    const value = version.value;
    const placed = value ?? previous;
    if (recorded && placed !== null) {
      const { courseId, day } = where(placed);
      const left = previous === null || value === null ? day : where(previous).day;
      found.push({
        key,
        courseId,
        entryDay: day,
        ...(left !== day && { movedFrom: left }),
        before: previous,
        after: value,
        day: version.day,
        ...(version.reason !== undefined && { reason: version.reason }),
      });
    }
    previous = value;
    recorded ||= value !== null;
  }
  return found;
}

const inRange = (from: Day, to: Day) => (correction: Correction<unknown>) =>
  [correction.entryDay, correction.movedFrom].some(
    (day) => day !== undefined && compareDays(day, from) >= 0 && compareDays(day, to) <= 0,
  );

const byEntry = (a: Correction<unknown>, b: Correction<unknown>) =>
  compareDays(a.entryDay, b.entryDay) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || compareDays(a.day, b.day);

/** The corrections to entries from `from` to `to`, in the entries' order, then each entry's in time. */
export function bookCorrections(state: Pick<State, 'sessions' | 'extras'>, from: Day, to: Day): BookCorrections {
  const sessions = [...state.sessions].flatMap(([key, versions]) =>
    changes<SessionRecord>(key, versions, (record) => record.session),
  );
  const extras = [...state.extras].flatMap(([key, versions]) => changes<ExtraSession>(key, versions, (extra) => extra));
  return {
    sessions: sessions.filter(inRange(from, to)).sort(byEntry),
    extras: extras.filter(inRange(from, to)).sort(byEntry),
  };
}
