// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A substitute's appointment as the director records it in the world's store
// (#587, D-Substitute, §7.5, R-7.5-07, answer 615), never on the server: the
// directorate's decision, by its reference of at most 40 characters written
// clean, naming the holder and another teacher as the substitute by their staff
// list IDs, the holder's classes it passes over, each named once by its name
// key, the first day, the timetable version that passed them over, and the day
// the holder returned once recorded, never before the first day. A later record
// for the same appointment replaces the earlier one, and a school's
// appointments are read in the order each was first recorded.

import { compareDays, isDay } from './day.ts';
import type { SchoolSubstitution } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { ID, isStaffId, SCHOOL } from './school-key-shape.ts';
import { timetableNameKey } from './timetable-import.ts';
import { clean, named, record, whole } from './timetable-record.ts';

export type { SchoolSubstitution } from './device-events.ts';

/** How long the directorate's decision reference may be, in UTF-16 units. */
export const DECISION_MOST = 40;

/** How many classes one appointment may pass over. */
export const SUBSTITUTION_CLASSES = 64;

/** Whether a value is a decision reference: a name of at most `DECISION_MOST` units, written clean. */
export const isDecision = (value: unknown): value is string =>
  named(value, false, DECISION_MOST) && clean(value) === value;

/** Whether classes are each named once, as their name keys read. */
export const distinctClasses = (classes: readonly string[]) =>
  new Set(classes.map(timetableNameKey)).size === classes.length;

/** An appointment as the store may keep it, or null when it does not read. */
export function readSchoolSubstitution(value: unknown): SchoolSubstitution | null {
  if (!record(value)) return null;
  const { school, id, holder, substitute, decision, classes, from, version, ended, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  if (typeof id !== 'string' || !ID.test(id) || !isStaffId(holder) || !isStaffId(substitute)) return null;
  if (holder === substitute || !isDecision(decision) || !whole(version, 1, Number.MAX_SAFE_INTEGER)) return null;
  if (!Array.isArray(classes) || classes.length === 0 || classes.length > SUBSTITUTION_CLASSES) return null;
  if (!classes.every((one) => named(one) && clean(one) === one) || !distinctClasses(classes as string[])) return null;
  if (typeof from !== 'string' || !isDay(from)) return null;
  if (ended !== null && (typeof ended !== 'string' || !isDay(ended) || compareDays(ended, from) < 0)) return null;
  return { school, id, holder, substitute, decision, classes: classes as string[], from, version, ended };
}

/** A school's appointments in the store, each at its latest record, in the order each was first recorded. */
export function keptSubstitutions(entries: readonly Entry[], school: string): SchoolSubstitution[] {
  const found = new Map<string, SchoolSubstitution>();
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'school.substitution' ? readSchoolSubstitution(event.substitution) : null;
    if (read !== null && read.school === school) found.set(read.id, read);
  }
  return [...found.values()];
}
