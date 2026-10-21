// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The calendar has four layers: national, zone, school and teacher
// (PRD §4.5). Late news is normal, so nothing here is cached beyond one
// view: a closure added this morning changes today's sessions at once.
//
// The teacher's own layer, with training days, seminars and duties, marks
// only the teacher's own sessions. It never changes the school's days or
// its A/B weeks, which every teacher of the school shares.

import { addDays, compareDays, isWithin, startOfWeek, weekday, type Day } from './day.ts';
import type { CalendarEffect, CalendarEntry, Reference } from './reference.ts';
import type { School, SchoolClass } from './records.ts';
import { effectiveCalendar } from './calendar-lunar.ts';

/** Whether an entry covers a school, and a class there if one is given. */
export function appliesTo(entry: CalendarEntry, school: School, schoolClass?: SchoolClass): boolean {
  if (entry.rotation !== undefined && schoolClass !== undefined && entry.rotation.classId !== schoolClass.id)
    return false;
  if (entry.layer === 'zone' && (school.zone === undefined || entry.zone !== school.zone)) return false;
  if (entry.layer === 'school' && entry.schoolId !== school.id) return false;
  const levels = entry.levels;
  if (levels !== undefined) {
    const covered = schoolClass ? levels.includes(schoolClass.level) : school.levels.some((l) => levels.includes(l));
    if (!covered) return false;
  }
  if (entry.grades !== undefined && (schoolClass === undefined || !entry.grades.includes(schoolClass.grade))) {
    return false;
  }
  return true;
}

export interface DayInfo {
  readonly day: Day;
  /** Within the school year and not a holiday. The teacher's own layer never changes it. */
  readonly schoolDay: boolean;
  readonly closure: CalendarEntry | null;
  readonly exam: CalendarEntry | null;
  /** On a school day, an entry of the teacher's own layer that takes the teacher's sessions. */
  readonly teacher: CalendarEntry | null;
  /** Every entry that covers the day, for the marks on Today. */
  readonly entries: readonly CalendarEntry[];
}

/** The effects that take sessions away. Markers and A/B resets leave them as they are. */
const TAKES_SESSIONS: readonly CalendarEffect[] = ['no-school', 'closure', 'exam'];

export type Parity = 'A' | 'B';

export interface TeachingWeek {
  readonly start: Day;
  /** From 1, counting only weeks with teaching days. */
  readonly number: number;
  readonly parity: Parity;
}

/** The calendar as one school and its classes see it. */
export class CalendarView {
  readonly #ref: Reference;
  readonly #entries: readonly CalendarEntry[];
  readonly #weeks = new Map<string, readonly TeachingWeek[]>();

  /** `own` holds the entries the teacher added: closures and their own layer. */
  constructor(ref: Reference, own: readonly CalendarEntry[]) {
    this.#ref = ref;
    this.#entries = effectiveCalendar(ref.calendar, own, ref.updatedIds);
  }

  /** Every entry that covers a school, and a class there if one is given. */
  entriesFor(school: School, schoolClass?: SchoolClass): CalendarEntry[] {
    return this.#entries.filter((entry) => appliesTo(entry, school, schoolClass));
  }

  /**
   * What `day` holds for a school, and for one of its classes. Whether it is
   * a school day, a closure or an exam comes from the national, zone and
   * school layers, which every teacher of the school shares. The teacher's
   * own layer can only take the teacher's sessions.
   */
  info(day: Day, school: School, schoolClass?: SchoolClass, half?: 'morning' | 'afternoon'): DayInfo {
    const entries = this.#entries.filter(
      (entry) =>
        isWithin(day, entry.from, entry.to) &&
        appliesTo(entry, school, schoolClass) &&
        (half === undefined || entry.half === undefined || entry.half === half),
    );
    const shared = entries.filter((entry) => entry.layer !== 'teacher');
    const inYear = isWithin(day, this.#ref.year.from, this.#ref.year.to);
    const schoolDay = inYear && !shared.some((entry) => entry.effect === 'no-school');
    const own = (entry: CalendarEntry): boolean => entry.layer === 'teacher' && TAKES_SESSIONS.includes(entry.effect);
    return {
      day,
      schoolDay,
      closure: schoolDay ? (shared.find((entry) => entry.effect === 'closure') ?? null) : null,
      exam: schoolDay ? (shared.find((entry) => entry.effect === 'exam') ?? null) : null,
      teacher: schoolDay ? (entries.find(own) ?? null) : null,
      entries,
    };
  }

  /**
   * The school's teaching weeks and their A/B parity. By default the parity
   * alternates and skips weeks with no teaching day, and an entry can reset
   * it, for example each term (PRD §4.6). Entries of the teacher's own layer
   * count for neither.
   */
  teachingWeeks(school: School): readonly TeachingWeek[] {
    const cached = this.#weeks.get(school.id);
    if (cached !== undefined) return cached;
    const { country, year } = this.#ref;
    const weeks: TeachingWeek[] = [];
    let parity: Parity = 'B';
    for (
      let start = startOfWeek(year.from, country.weekStartsOn);
      compareDays(start, year.to) <= 0;
      start = addDays(start, 7)
    ) {
      const end = addDays(start, 6);
      let teaching = false;
      for (let offset = 0; offset < 7 && !teaching; offset += 1) {
        const day = addDays(start, offset);
        teaching = country.workingDays.includes(weekday(day)) && this.info(day, school).schoolDay;
      }
      if (!teaching) continue;
      const priority = { national: 0, zone: 1, school: 2, teacher: -1 };
      const reset = this.#entries
        .filter(
          (entry) =>
            (entry.effect === 'week-a' || entry.effect === 'week-b') &&
            entry.layer !== 'teacher' &&
            isWithin(entry.from, start, end) &&
            appliesTo(entry, school),
        )
        .sort((a, b) => priority[a.layer] - priority[b.layer])
        .at(-1);
      if (reset === undefined) parity = parity === 'A' ? 'B' : 'A';
      else parity = reset.effect === 'week-a' ? 'A' : 'B';
      weeks.push({ start, number: weeks.length + 1, parity });
    }
    this.#weeks.set(school.id, weeks);
    return weeks;
  }

  /** The A or B week of `day`, or in a week with no teaching day, of the last teaching week before it; null before the first. */
  parityOn(day: Day, school: School): Parity | null {
    const start = startOfWeek(day, this.#ref.country.weekStartsOn);
    const before = this.teachingWeeks(school).filter((week) => compareDays(week.start, start) <= 0);
    return before.at(-1)?.parity ?? null;
  }

  /** The teaching week that holds `day`, or null in a holiday week or outside the year. */
  weekOf(day: Day, school: School): TeachingWeek | null {
    const start = startOfWeek(day, this.#ref.country.weekStartsOn);
    return this.teachingWeeks(school).find((week) => week.start === start) ?? null;
  }
}
