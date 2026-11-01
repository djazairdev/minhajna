// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The reference-only scenario of #610 (R-4.3-13). Its grid is supplied with
// a source, never guessed from missing official data or a teacher's load.
// It describes one class's plan and TD allocation, including A/B weeks.
// A fresh empty state lets the calendar and session engine count this grid
// without accepting any teacher history, progress, decisions or private
// calendar. Only national and zone reference entries are considered.
// Dates are explicit and within the reference year; invalid caller inputs
// throw, while an overlong plan is handled separately as an advisory.

import { makeContext, type Context } from './context.ts';
import { compareDays, isDay, type Day } from './day.ts';
import { parsePackId } from './pack-catalogue.ts';
import type { PlanPack } from './pack.ts';
import type { School, SchoolClass, TimetableEntry, TimetableVersion } from './records.ts';
import { packKey, type Reference } from './reference.ts';
import { buildState } from './state.ts';

export interface BudgetPackGrid {
  readonly source: string;
  readonly sessionMinutes: number;
  readonly sessions: readonly Pick<TimetableEntry, 'weekday' | 'slot' | 'weeks' | 'sessionType'>[];
}

export interface BudgetPackScope {
  readonly from: Day;
  readonly to: Day;
  readonly zone?: string;
  readonly grid: BudgetPackGrid | null;
}

function validGrid(ref: Reference, grid: BudgetPackGrid): boolean {
  const sessions: BudgetPackGrid['sessions'] = grid.sessions;
  if (
    typeof grid.source !== 'string' ||
    grid.source.trim() === '' ||
    !Array.isArray(grid.sessions) ||
    !Number.isFinite(grid.sessionMinutes) ||
    grid.sessionMinutes <= 0
  )
    return false;
  return sessions.every(
    (entry, index, all) =>
      ref.country.workingDays.includes(entry.weekday) &&
      Number.isSafeInteger(entry.slot.index) &&
      entry.slot.index > 0 &&
      ['morning', 'afternoon'].includes(entry.slot.half) &&
      ['every', 'A', 'B'].includes(entry.weeks) &&
      ref.country.sessionTypes.some((type) => type.code === entry.sessionType) &&
      !all
        .slice(0, index)
        .some(
          (other) =>
            other.weekday === entry.weekday &&
            other.slot.half === entry.slot.half &&
            other.slot.index === entry.slot.index &&
            (other.weeks === 'every' || entry.weeks === 'every' || other.weeks === entry.weeks),
        ),
  );
}

export function budgetPackContext(
  pack: PlanPack,
  ref: Reference,
  scope: BudgetPackScope,
  grid: BudgetPackGrid,
): {
  readonly context: Context;
  readonly courseId: string;
  readonly school: School;
  readonly schoolClass: SchoolClass;
} {
  if (
    !isDay(scope.from) ||
    !isDay(scope.to) ||
    compareDays(scope.from, scope.to) > 0 ||
    compareDays(scope.from, ref.year.from) < 0 ||
    compareDays(scope.to, ref.year.to) > 0
  )
    throw new RangeError('Invalid plan horizon');
  const parts = parsePackId(pack.id);
  if (parts === null || parts.country !== ref.country.code) throw new RangeError('Unknown pack profile');
  const level = ref.country.levels.find((one) => one.code === parts.level);
  if (
    scope.zone !== undefined &&
    ref.country.zones !== undefined &&
    !ref.country.zones.some((zone) => zone.code === scope.zone)
  )
    throw new RangeError('Unknown calendar zone');
  if (
    level === undefined ||
    !level.grades.some((grade) => grade.code === parts.grade) ||
    !ref.country.subjects.some((subject) => subject.code === parts.subject && subject.levels.includes(parts.level))
  )
    throw new RangeError('Unknown pack profile');
  if (!validGrid(ref, grid)) throw new RangeError('Invalid reference grid');
  const school: School = {
    id: 'pack-check-school',
    name: '',
    levels: [parts.level],
    subjects: [parts.subject],
    ...(scope.zone === undefined ? {} : { zone: scope.zone }),
  };
  const schoolClass: SchoolClass = {
    id: 'pack-check-class',
    schoolId: school.id,
    name: '',
    level: parts.level,
    grade: parts.grade,
    ...(parts.stream === undefined ? {} : { stream: parts.stream }),
    groups: [{ id: 'pack-check-whole', name: '', kind: 'whole' }],
  };
  const course = {
    id: 'pack-check-course',
    classId: schoolClass.id,
    subject: parts.subject,
    year: ref.year.id,
    pack: { id: pack.id, release: pack.release },
    sessionMinutes: grid.sessionMinutes,
  };
  const version: TimetableVersion = {
    id: 'pack-check-grid',
    from: scope.from,
    source: 'package',
    blocks: [],
    entries: grid.sessions.map((entry, index) => ({
      ...entry,
      id: `pack-check-slot-${index}`,
      courseId: course.id,
      groupId: 'pack-check-whole',
    })),
  };
  const state = {
    ...buildState([]),
    schools: new Map([[school.id, school]]),
    classes: new Map([[schoolClass.id, schoolClass]]),
    courses: new Map([[course.id, course]]),
    timetables: [{ version, recorded: scope.from, from: scope.from }],
  };
  const reference = {
    ...ref,
    packs: new Map([[packKey(pack.id, pack.release), pack]]),
    calendar: ref.calendar.filter((entry) => entry.layer === 'national' || entry.layer === 'zone'),
  };
  return { context: makeContext(reference, state), courseId: course.id, school, schoolClass };
}
