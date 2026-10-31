// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a new version of the timetable changes for one teacher, and which of a
// teacher's parts applies on a day (#578, R-7.4-13, R-7.4-15, answer 606). Two
// parts' sessions are compared by their stable IDs: a session only in the new
// one was added, only in the old one removed, and one in both whose room
// changed has a new room. A removed session and an added one of the same class,
// group, subject and week, compared as the timetable compares names, are one
// session moved, paired in the order the parts list them. The changes follow
// the order of the sessions they end in, or left. A teacher is affected by a
// version when it changes anything of theirs. On a day, the latest part for
// that one day applies, whatever standing version came after it, since a
// standing version is drafted from the standing one and never carries a one-day
// change; otherwise the latest standing part in force then applies, from its
// first day on, so a one-day change touches only its own date (R-4.6-05).

import { compareDays, type Day } from './day.ts';
import type { SignedPart } from './timetable-package.ts';
import { bySession, type PartSession } from './timetable-sessions.ts';
import { timetableNameKey } from './timetable-import.ts';

/** One change a version makes to a teacher's sessions. */
export type PartChange =
  | { readonly kind: 'moved' | 'room'; readonly before: PartSession; readonly after: PartSession }
  | { readonly kind: 'added'; readonly before: null; readonly after: PartSession }
  | { readonly kind: 'removed'; readonly before: PartSession; readonly after: null };

/** Whether two sessions are of the same class, group, subject and week, as the timetable compares names. */
export const sameLesson = (one: PartSession, other: PartSession) => named(one) === named(other);

const named = (one: PartSession) =>
  [one.class, one.group, one.subject].map(timetableNameKey).concat(one.week).join('\n');

/** What the sessions `after` change from the sessions `before`, for one teacher. */
export function partChanges(before: readonly PartSession[], after: readonly PartSession[]): PartChange[] {
  const was = new Map(before.map((one) => [one.id, one]));
  const now = new Set(after.map((one) => one.id));
  const came = [...after].filter((one) => !was.has(one.id)).sort(bySession);
  const changes: PartChange[] = [];
  for (const one of after) {
    const old = was.get(one.id);
    if (old !== undefined && timetableNameKey(old.room) !== timetableNameKey(one.room)) {
      changes.push({ kind: 'room', before: old, after: one });
    }
  }
  for (const one of [...before].filter((gone) => !now.has(gone.id)).sort(bySession)) {
    const at = came.findIndex((other) => sameLesson(other, one));
    if (at < 0) changes.push({ kind: 'removed', before: one, after: null });
    else changes.push({ kind: 'moved', before: one, after: came.splice(at, 1)[0]! });
  }
  for (const one of came) changes.push({ kind: 'added', before: null, after: one });
  return changes.sort((a, b) => bySession(a.after ?? a.before, b.after ?? b.before));
}

/** Whether a part applies on a day: a standing part from its first day on, a part for one day on that day only. */
export const appliesOn = (part: SignedPart['part'], day: Day) =>
  part.once ? part.from === day : compareDays(part.from, day) <= 0;

/**
 * Of a channel's parts, in its order, the one that applies on a day: the
 * latest part for that one day, or else the latest standing part in force
 * then, or null.
 */
export function partOn(parts: readonly SignedPart[], day: Day): SignedPart | null {
  const latest = [...parts].reverse();
  const once = latest.find((one) => one.part.once && appliesOn(one.part, day));
  return once ?? latest.find((one) => !one.part.once && appliesOn(one.part, day)) ?? null;
}
