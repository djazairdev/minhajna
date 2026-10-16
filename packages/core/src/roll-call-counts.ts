// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's totals (PRD §3.4): how many half-days or sessions
// each pupil missed, under the counting rules the teacher sets.

import type { Context } from './context.ts';
import { compareDays, isWithin, maxDay, monthRange, type Day } from './day.ts';
import { compareHalves, type Half, type RollCall } from './records.ts';
import { pupilsFor, rollCallUnits, type RollCallUnit } from './roll-call.ts';
import { current } from './state.ts';

/**
 * Counting rules are settings, because teachers disagree on them and no
 * official text settles them (PRD §3.4).
 *
 * Two things are not settings. Units are never generated on school
 * holidays, so a holiday never counts. And every roll call taken counts,
 * whatever the rules say, so one taken on a make-up day counts too.
 */
export interface CountingRules {
  /** Count from this day. */
  readonly from?: Day;
  /**
   * Units with no roll call. Counting them as present would state what
   * nobody recorded, so by default they are left out and listed apart.
   */
  readonly untaken: 'excluded' | 'present';
  /** Units whose sessions were all recorded as not held. */
  readonly notHeld: 'excluded' | 'counted';
  /** Units on the teacher's own calendar days, such as training days and seminars (PRD §4.5). */
  readonly seminars: 'excluded' | 'counted';
}

export const DEFAULT_COUNTING: CountingRules = { untaken: 'excluded', notHeld: 'excluded', seminars: 'excluded' };

export interface AbsenceMark {
  readonly day: Day;
  readonly half: Half;
  readonly justified: boolean;
}

export interface PupilCount {
  readonly pupilId: string;
  /** Possible attendance: the units the pupil could attend. */
  readonly possible: number;
  /** Absences. With half-day units, a whole day counts 2. */
  readonly absent: number;
  readonly justified: number;
  readonly unjustified: number;
  /** Actual attendance. */
  readonly present: number;
  /** Actual over possible attendance, or null when none was possible. */
  readonly rate: number | null;
  readonly absences: readonly AbsenceMark[];
  /** The days of each late arrival. Lateness never counts as an absence. */
  readonly late: readonly Day[];
}

export interface RollCallCounts {
  readonly pupils: readonly PupilCount[];
  /** Units counted. */
  readonly units: number;
  /** Units the timetable and the calendar give, with no roll call taken. */
  readonly untaken: number;
  /**
   * Roll calls taken that count although the rest of the record leaves their
   * unit out: the timetable or the calendar no longer gives it, or the rules
   * leave it out, for example because its sessions were recorded as not
   * held. Unit keys only, so the app can ask the teacher which is right.
   */
  readonly conflicts: readonly string[];
}

interface Counted {
  readonly unit: RollCallUnit;
  readonly rollCall: RollCall | null;
  readonly conflict: boolean;
}

/**
 * The roll-call book's totals for each pupil, from `from` to `to` (PRD §3.4).
 *
 * Roll calls carry legal weight, so one taken is never dropped silently,
 * even when the timetable or the calendar no longer gives its unit: after a
 * timetable change, or a closure added later.
 */
export function countRollCalls(
  context: Context,
  classId: string,
  from: Day,
  to: Day,
  rules: CountingRules = DEFAULT_COUNTING,
): RollCallCounts {
  const { state } = context;
  const start = rules.from === undefined ? from : maxDay(from, rules.from);
  const generated = compareDays(start, to) <= 0 ? rollCallUnits(context, classId, start, to) : [];
  const counted: Counted[] = [];
  let untaken = 0;

  for (const unit of generated) {
    const rollCall = current(state.rollCalls.get(unit.key));
    const notHeld = unit.sessions.every((session) => current(state.sessions.get(session.key))?.outcome === 'not-held');
    const ownDay = unit.sessions.every((session) => session.calendar === 'teacher');
    const leftOut = (notHeld && rules.notHeld === 'excluded') || (ownDay && rules.seminars === 'excluded');
    if (rollCall !== null) {
      counted.push({ unit, rollCall, conflict: leftOut });
    } else if (!leftOut) {
      untaken += 1;
      if (rules.untaken === 'present') counted.push({ unit, rollCall: null, conflict: false });
    }
  }

  const keys = new Set(generated.map((unit) => unit.key));
  for (const [key, versions] of state.rollCalls) {
    const rollCall = current(versions);
    if (rollCall === null || keys.has(key) || rollCall.classId !== classId || !isWithin(rollCall.day, start, to))
      continue;
    const { groupId, day, half } = rollCall;
    counted.push({ unit: { key, classId, groupId, day, half, sessions: [] }, rollCall, conflict: true });
  }
  counted.sort((a, b) => compareDays(a.unit.day, b.unit.day) || compareHalves(a.unit.half, b.unit.half));

  const counts = new Map<string, { possible: number; absences: AbsenceMark[]; late: Day[] }>();
  for (const { unit, rollCall } of counted) {
    for (const pupil of pupilsFor(context, unit)) {
      const count = counts.get(pupil.id) ?? { possible: 0, absences: [], late: [] };
      count.possible += 1;
      const absence = rollCall?.absent.find((candidate) => candidate.pupilId === pupil.id);
      if (absence !== undefined) count.absences.push({ day: unit.day, half: unit.half, justified: absence.justified });
      if (rollCall?.late.includes(pupil.id) === true) count.late.push(unit.day);
      counts.set(pupil.id, count);
    }
  }

  const pupils: PupilCount[] = [];
  for (const pupil of state.pupils.values()) {
    if (pupil.classId !== classId) continue;
    const count = counts.get(pupil.id);
    if (count === undefined) continue;
    const justified = count.absences.filter((absence) => absence.justified).length;
    const absent = count.absences.length;
    pupils.push({
      pupilId: pupil.id,
      possible: count.possible,
      absent,
      justified,
      unjustified: absent - justified,
      present: count.possible - absent,
      rate: count.possible === 0 ? null : (count.possible - absent) / count.possible,
      absences: count.absences,
      late: count.late,
    });
  }
  return {
    pupils,
    units: counted.length,
    untaken,
    conflicts: counted.filter(({ conflict }) => conflict).map(({ unit }) => unit.key),
  };
}

/** The totals for one month, written YYYY-MM, within the school year. */
export function countMonth(context: Context, classId: string, month: string, rules?: CountingRules): RollCallCounts {
  const { from, to } = monthRange(month);
  const { year } = context.ref;
  const first = maxDay(from, year.from);
  const last = compareDays(to, year.to) <= 0 ? to : year.to;
  if (!isWithin(first, year.from, year.to) || compareDays(first, last) > 0) {
    return { pupils: [], units: 0, untaken: 0, conflicts: [] };
  }
  return countRollCalls(context, classId, first, last, rules);
}
