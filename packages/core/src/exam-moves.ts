// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exams whose days an update of the calendar moved (#602, answer 634,
// R-7.10-06): each exam's earlier days are worked out as the exams are
// (world-exams.ts), from the entries with the dates a moved entry had before,
// and an exam whose first or last day differs from them, matched by its ID, has
// moved, its figures day and signing deadline with it. Its reason and the day
// it was announced are those of the move whose entries alone change the exam's
// days, a move being the entries moved for one reason announced on one day, so
// windows moved together stay together, the latest announced when several do,
// as the exams a demo world adds move with the term's exam windows; an entry's
// move was announced on the first day an update holding the entry with that
// same move was published, none when no update holds it, and an exam no moved
// entry changes alone has no reason. Every moved entry counts, a day without
// school among them, as one may move the mock exam or the BEM (world-exams.ts).
// A known limit: an exam is matched by its ID, which names the grades its
// window covers, so a move that splits or merges windows makes other exams
// rather than moving one.

import { compareDays, type Day } from './day.ts';
import type { CalendarUpdate } from './calendar-update.ts';
import type { CalendarEntry, SchoolYear } from './reference.ts';
import { worldExams, type WorldExam } from './world-exams.ts';

/** An exam's move: its ID, the days it had, why it moved, and the day the move was announced. */
export interface ExamMove {
  readonly exam: string;
  readonly before: Pick<WorldExam, 'from' | 'to' | 'figuresDay' | 'signBy'>;
  readonly reason: string | null;
  readonly announced: Day | null;
}

/** The exams the calendar's updates moved, in the order of their first days. */
export function examMoves(
  year: SchoolYear,
  entries: readonly CalendarEntry[],
  updates: readonly Pick<CalendarUpdate, 'published' | 'entries'>[],
): ExamMove[] {
  const exams = worldExams(year, entries);
  const now = new Map(exams.map((one) => [one.id, one]));
  const reverted = (group: ReadonlySet<CalendarEntry>) =>
    entries.map((one) =>
      group.has(one) && one.moved !== undefined ? { ...one, from: one.moved.from, to: one.moved.to } : one,
    );
  const changes = (list: readonly CalendarEntry[]) =>
    worldExams(year, list).filter((one) => {
      const is = now.get(one.id);
      return is !== undefined && (is.from !== one.from || is.to !== one.to);
    });
  const announced = (entry: CalendarEntry, moved: NonNullable<CalendarEntry['moved']>) =>
    updates
      .filter((one) =>
        one.entries.some(
          (each) =>
            each.id === entry.id &&
            each.moved?.from === moved.from &&
            each.moved.to === moved.to &&
            each.moved.reason === moved.reason,
        ),
      )
      .map((one) => one.published)
      .sort(compareDays)[0] ?? null;
  const groups = new Map<string, { reason: string; announced: Day | null; entries: Set<CalendarEntry> }>();
  for (const entry of entries) {
    const { moved } = entry;
    if (moved === undefined) continue;
    const day = announced(entry, moved);
    const key = JSON.stringify([moved.reason, day]);
    const group = groups.get(key) ?? { reason: moved.reason, announced: day, entries: new Set<CalendarEntry>() };
    group.entries.add(entry);
    groups.set(key, group);
  }
  const owners = new Map<string, { reason: string; announced: Day | null }[]>();
  for (const group of groups.values())
    for (const one of changes(reverted(group.entries))) owners.set(one.id, [...(owners.get(one.id) ?? []), group]);
  const latest = (a: { announced: Day | null }, b: { announced: Day | null }) =>
    a.announced === b.announced
      ? 0
      : a.announced === null
        ? 1
        : b.announced === null
          ? -1
          : compareDays(b.announced, a.announced);
  const earlier = entries.map((one) =>
    one.moved === undefined ? one : { ...one, from: one.moved.from, to: one.moved.to },
  );
  const before = new Map(worldExams(year, earlier).map((one) => [one.id, one]));
  const found: ExamMove[] = [];
  for (const exam of exams) {
    const was = before.get(exam.id);
    if (was === undefined || (was.from === exam.from && was.to === exam.to)) continue;
    const owner = [...(owners.get(exam.id) ?? [])].sort(latest)[0];
    found.push({
      exam: exam.id,
      before: { from: was.from, to: was.to, figuresDay: was.figuresDay, signBy: was.signBy },
      reason: owner?.reason ?? null,
      announced: owner?.announced ?? null,
    });
  }
  return found;
}
