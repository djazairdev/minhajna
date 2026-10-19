// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Pupil screen shows of one pupil (#217, Pupil and Pupil-year): for a
// month so far or the school year, their counts in half-days, each half-day
// missed with the roll calls behind it, each late arrival, and the change log
// of those roll calls: when each mark was first recorded, then each change,
// newest first (answer 259), a line the half-day's roll calls share said once.
// The one-tap toggle justifies a half-day by correcting every roll call that
// marked it, with the reason «administration», and flips it back with «entry-
// error» (answers 254, 258 and 259).

import {
  DEFAULT_COUNTING,
  compareDays,
  correctPupil,
  countRollCalls,
  current,
  markOf,
  pupilChanges,
  pupilsFor,
  type AbsenceMark,
  type Context,
  type Day,
  type Half,
  type MarkChange,
  type PupilCount,
  type PupilMark,
  type RecordEvent,
  type RollCallUnit,
} from '@minhajna/core';
import { bookUnits, monthSpan } from './month-rules';

/** A half-day missed, with the roll calls that marked it. */
export interface PupilAbsence {
  readonly mark: AbsenceMark;
  readonly units: readonly RollCallUnit[];
}

/** A line of the change log: a mark first recorded, or a change to it. */
export type LogEntry =
  | {
      readonly kind: 'recorded';
      readonly changed: Day;
      readonly day: Day;
      readonly half: Half;
      readonly unit: string;
      readonly mark: Exclude<PupilMark, 'present'>;
    }
  | ({ readonly kind: 'changed' } & MarkChange);

export interface PupilView {
  readonly count: PupilCount | null;
  readonly absences: readonly PupilAbsence[];
  readonly lates: readonly RollCallUnit[];
  /** Each roll call taken with the pupil on its list, or marking them, for «تصحيح غياب أو تأخر مسجّل». */
  readonly taken: readonly { readonly unit: RollCallUnit; readonly mark: PupilMark }[];
  readonly log: readonly LogEntry[];
}

/** The days the Pupil screen covers: a month so far, or the school year up to `today`. */
export function pupilSpan(context: Context, month: string, today: Day): { from: Day; to: Day } | null {
  if (month !== 'year') return monthSpan(context, month, today);
  const { year } = context.ref;
  const to = compareDays(today, year.to) < 0 ? today : year.to;
  return compareDays(year.from, to) > 0 ? null : { from: year.from, to };
}

/** Nothing to show: before the school year starts. */
export const EMPTY_VIEW: PupilView = { count: null, absences: [], lates: [], taken: [], log: [] };

/**
 * The pupil's counts, absences, late arrivals and change log from `from` to
 * `to`. Late arrivals, like the counts, start on the counting rules' day.
 */
export function pupilView(context: Context, classId: string, pupilId: string, from: Day, to: Day): PupilView {
  const units = bookUnits(context, classId, from, to);
  const byKey = new Map(units.map((unit) => [unit.key, unit]));
  const count = countRollCalls(context, classId, from, to).pupils.find((one) => one.pupilId === pupilId) ?? null;
  const taken = units.flatMap((unit) => {
    const rollCall = current(context.state.rollCalls.get(unit.key));
    if (rollCall === null) return [];
    const mark = markOf(rollCall, pupilId);
    const listed = pupilsFor(context, unit).some((pupil) => pupil.id === pupilId);
    return listed || mark !== 'present' ? [{ unit, mark }] : [];
  });
  const start = (context.state.counting ?? DEFAULT_COUNTING).from;
  const counted = (day: Day) => start === undefined || compareDays(day, start) >= 0;
  const log: LogEntry[] = [];
  for (const unit of units) {
    const first = context.state.rollCalls.get(unit.key)?.[0];
    const mark = first === undefined ? 'present' : markOf(first.value, pupilId);
    if (first !== undefined && mark !== 'present') {
      log.push({ kind: 'recorded', changed: first.day, day: unit.day, half: unit.half, unit: unit.key, mark });
    }
  }
  for (const change of pupilChanges(context.state, pupilId).reverse()) {
    if (byKey.has(change.unit)) log.push({ kind: 'changed', ...change });
  }
  const order = (entry: LogEntry) => (entry.kind === 'changed' ? 0 : 1);
  log.sort(
    (a, b) =>
      compareDays(b.changed, a.changed) ||
      order(a) - order(b) ||
      compareDays(b.day, a.day) ||
      b.unit.localeCompare(a.unit),
  );
  const seen = new Set<string>();
  const times = new Map<string, number>();
  const lines = log.filter((entry) => {
    const what = entry.kind === 'recorded' ? entry.mark : `${entry.from}/${entry.to}/${entry.reason ?? ''}`;
    const line = `${entry.kind}/${entry.changed}/${entry.day}/${entry.half}/${what}`;
    const time = times.get(`${entry.unit}|${line}`) ?? 0;
    times.set(`${entry.unit}|${line}`, time + 1);
    if (seen.has(`${line}#${time}`)) return false;
    seen.add(`${line}#${time}`);
    return true;
  });
  return {
    count,
    absences: (count?.absences ?? []).map((mark) => ({
      mark,
      units: mark.units.flatMap((key) => byKey.get(key) ?? []),
    })),
    lates: taken.filter((one) => one.mark === 'late' && counted(one.unit.day)).map((one) => one.unit),
    taken,
    log: lines,
  };
}

/**
 * The events that set a half-day missed justified or not: one correction
 * for each of its roll calls whose mark differs, with the reason the toggle
 * gives (answers 254 and 259).
 */
export function justifyEvents(
  context: Context,
  absence: PupilAbsence,
  pupilId: string,
  justified: boolean,
): RecordEvent[] {
  const mark: PupilMark = justified ? 'justified' : 'unjustified';
  return absence.units.flatMap((unit) => {
    const rollCall = current(context.state.rollCalls.get(unit.key));
    const now = rollCall === null ? null : markOf(rollCall, pupilId);
    if (now !== 'justified' && now !== 'unjustified') return [];
    if (now === mark) return [];
    return [correctPupil(context, unit, pupilId, mark, justified ? 'administration' : 'entry-error')];
  });
}
