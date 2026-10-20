// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Context } from './context.ts';
import { isWithin, weekday, type Day, type Weekday } from './day.ts';
import type { RecordEvent } from './events.ts';
import type { CalendarEntry } from './reference.ts';
import type { ClassGroup, SchoolClass } from './records.ts';

/** Validate an explicit local class rule; it is not an authenticated school notice. */
export function checkRotation(context: Context, entry: CalendarEntry): void {
  const rule = entry.rotation;
  const schoolClass = rule && context.state.classes.get(rule.classId);
  if (
    entry.layer !== 'school' ||
    rule === undefined ||
    schoolClass === undefined ||
    schoolClass.schoolId !== entry.schoolId ||
    rule.groups.length !== 2 ||
    rule.groups[0] === rule.groups[1] ||
    schoolClass.groups.filter((group) => group.kind === 'half').length !== 2 ||
    rule.groups.some((id) => !schoolClass.groups.some((group) => group.id === id && group.kind === 'half')) ||
    entry.half !== undefined ||
    entry.levels !== undefined ||
    entry.grades !== undefined ||
    entry.adds !== undefined ||
    entry.follows !== undefined ||
    entry.takes !== undefined ||
    entry.replaces !== undefined
  )
    throw new RangeError('A rotation needs one class and two half-groups');
  const overlaps = context.state.calendar.some(
    (other) =>
      other.id !== entry.id &&
      other.rotation?.classId === rule.classId &&
      other.from <= entry.to &&
      other.to >= entry.from,
  );
  if (overlaps) throw new RangeError('Class rotation periods cannot overlap');
  const courses = new Set(
    [...context.state.courses.values()].filter((one) => one.classId === schoolClass.id).map((one) => one.id),
  );
  const allowed = new Set(
    schoolClass.groups.filter((one) => one.kind === 'whole' || one.kind === 'half').map((one) => one.id),
  );
  if (
    context.state.timetables.some((one) =>
      one.version.entries.some((slot) => courses.has(slot.courseId) && !allowed.has(slot.groupId)),
    )
  )
    throw new RangeError('Review option and level group slots before rotating this class');
  const pupils = [...context.state.pupils.values()].filter((one) => one.classId === schoolClass.id);
  if (pupils.some((one) => rule.groups.filter((id) => one.groups.includes(id)).length !== 1))
    throw new RangeError('Confirm one half-group for every pupil first');
}

/** The attending group on a working day, following the school A/B letter. */
export function rotationOn(
  context: Context,
  schoolClass: SchoolClass,
  day: Day,
): {
  readonly entry: CalendarEntry;
  readonly groupId: string;
} | null {
  const school = context.state.schools.get(schoolClass.schoolId);
  if (school === undefined) return null;
  const entry = context.calendar
    .entriesFor(school, schoolClass)
    .find(
      (one) =>
        one.effect === 'rotating-groups' && one.rotation?.classId === schoolClass.id && isWithin(day, one.from, one.to),
    );
  if (entry?.rotation === undefined) return null;
  const latest = context.state.timetables.filter((one) => one.from <= day).at(-1);
  const days: Weekday[] = [...context.ref.country.workingDays];
  if (latest?.version.options?.saturday && !days.includes(6)) days.push(6);
  const start = context.ref.country.weekStartsOn;
  days.sort((a, b) => ((a - start + 7) % 7) - ((b - start + 7) % 7));
  const index = days.indexOf(weekday(day));
  if (index < 0) return null;
  const offset = context.calendar.parityOn(day, school) === 'B' ? days.length : 0;
  return { entry, groupId: entry.rotation.groups[(index + offset) % 2]! };
}

/** Explicitly save the reviewed split using existing class and pupil records, never calendar pupil data. */
export function assignRotationGroups(
  context: Context,
  classId: string,
  halves: readonly [ClassGroup, ClassGroup],
  assignments: ReadonlyMap<string, string>,
): RecordEvent[] {
  const schoolClass = context.state.classes.get(classId);
  if (
    schoolClass === undefined ||
    halves.some((one) => one.kind !== 'half' || !one.name.trim()) ||
    halves[0].id === halves[1].id
  )
    throw new RangeError('Invalid half-groups');
  const old = schoolClass.groups.filter((one) => one.kind === 'half');
  if (
    old.some((one) => !halves.some((next) => next.id === one.id)) ||
    halves.some((one) => schoolClass.groups.some((group) => group.id === one.id && group.kind !== 'half'))
  )
    throw new RangeError('Keep existing group identities');
  const pupils = [...context.state.pupils.values()].filter((one) => one.classId === classId);
  if (
    assignments.size !== pupils.length ||
    pupils.some((one) => !halves.some((group) => group.id === assignments.get(one.id)))
  )
    throw new RangeError('Review the complete class split');
  const groups = [...schoolClass.groups.filter((one) => one.kind !== 'half'), ...halves];
  const events: RecordEvent[] =
    JSON.stringify(groups) === JSON.stringify(schoolClass.groups)
      ? []
      : [{ kind: 'class.set', schoolClass: { ...schoolClass, groups } }];
  for (const pupil of pupils) {
    const memberships = [
      ...pupil.groups.filter((id) => !halves.some((one) => one.id === id)),
      assignments.get(pupil.id)!,
    ];
    if (pupil.groups.length === memberships.length && pupil.groups.every((id) => memberships.includes(id))) continue;
    events.push({ kind: 'pupil.set', pupil: { ...pupil, groups: memberships } });
  }
  return events;
}
