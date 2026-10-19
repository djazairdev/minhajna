// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drawing the week by hand (#28, Week-draw): which version a drawing edits,
// what a tap with each brush does to a slot, and the totals under the grid.
// A tap with a class's brush puts that class, whole and every week, in the
// slot, and a second tap with the same brush clears it; the teacher's own
// time works the same way, and the eraser clears whatever is there. The
// first version starts with the school year; a later one starts the day it
// is drawn, so the past never moves (PRD §4.6). A version not in force yet,
// such as the week drawn during setup before the year begins, is drawn
// again rather than followed by a new one. With a double shift, a class
// drawn in one half-day also goes in the other, in the other week.

import {
  blockCovers,
  compareDays,
  courseOf,
  wholeGroup,
  type Course,
  type Day,
  type Half,
  type SchoolClass,
  type SchoolYear,
  type Slot,
  type State,
  type TeacherBlock,
  type TimetableEntry,
  type TimetableVersion,
  type Weekday,
  type Weeks,
} from '@minhajna/core';

export type Brush =
  { readonly kind: 'class'; readonly classId: string } | { readonly kind: 'own' } | { readonly kind: 'erase' };

export type Cell = { readonly weekday: Weekday; readonly slot: Slot };

const at = (cell: Cell) => (entry: TimetableEntry) =>
  entry.weekday === cell.weekday && entry.slot.half === cell.slot.half && entry.slot.index === cell.slot.index;

/**
 * The version a drawing edits: the one drawn today or not in force yet, or a new one that starts today, or with the
 * year if it is the first.
 */
export function versionToDraw(state: State, year: SchoolYear, today: Day, newId: () => string): TimetableVersion {
  const last = state.timetables.at(-1);
  if (last !== undefined && (last.recorded === today || compareDays(last.from, today) > 0)) {
    return { ...last.version, from: last.from };
  }
  return {
    id: newId(),
    from: last === undefined ? year.from : today,
    entries: last?.version.entries ?? [],
    blocks: last?.version.blocks ?? [],
    source: 'hand',
    ...(last?.version.options !== undefined && { options: last.version.options }),
  };
}

/** The class a course belongs to, including courses made while drawing and not saved yet. */
export type ClassOf = (courseId: string) => SchoolClass | undefined;

/** What a slot shows: the class of its session, the teacher's own time, or nothing. */
export function contentOf(version: TimetableVersion, classOf: ClassOf, cell: Cell) {
  const entry = version.entries.find(at(cell));
  if (entry !== undefined) {
    const schoolClass = classOf(entry.courseId);
    return { kind: 'class' as const, classId: schoolClass?.id, name: schoolClass?.name ?? '' };
  }
  const block = version.blocks.find((candidate) => blockCovers(candidate, cell.weekday, cell.slot));
  return block === undefined ? null : { kind: 'own' as const, label: block.label };
}

/**
 * The course a class's slots go to: the one it has for the year in `subject`, or in any of the school's subjects
 * when none is named, or a new one in that subject or the school's first.
 */
export function courseFor(
  state: State,
  schoolClass: SchoolClass,
  year: SchoolYear,
  newId: () => string,
  subject?: string,
) {
  const subjects = subject !== undefined ? [subject] : (state.schools.get(schoolClass.schoolId)?.subjects ?? []);
  for (const subject of subjects) {
    const found = courseOf(state, schoolClass.id, subject, year.id);
    if (found !== undefined) return { course: found, isNew: false };
  }
  const course: Course = {
    id: newId(),
    classId: schoolClass.id,
    subject: subjects[0] ?? '',
    year: year.id,
    pack: null,
  };
  return { course, isNew: true };
}

/**
 * The version after one tap: `course` is the brush's class course, and `ownLabel` names the teacher's time. With a
 * double shift, a class goes in A weeks in the half-day `shift` names and in B weeks in the other, at `mirror`, the
 * same place in the other half-day, when the grid has it.
 */
export function paint(
  version: TimetableVersion,
  classOf: ClassOf,
  cell: Cell,
  brush: Brush,
  made: {
    readonly schoolClass?: SchoolClass;
    readonly course?: Course;
    readonly ownLabel: string;
    readonly newId: () => string;
    readonly shift?: Half;
    readonly mirror?: Cell;
  },
): TimetableVersion {
  const shown = contentOf(version, classOf, cell);
  const mirror = made.shift !== undefined && brush.kind !== 'own' ? made.mirror : undefined;
  const entries = version.entries.filter((entry) => !at(cell)(entry) && !(mirror !== undefined && at(mirror)(entry)));
  const blocks = version.blocks.filter((block) => !blockCovers(block, cell.weekday, cell.slot));
  const cleared = { ...version, entries, blocks };
  if (brush.kind === 'erase') return cleared;
  if (brush.kind === 'own') {
    if (shown?.kind === 'own') return cleared;
    const block: TeacherBlock = {
      weekday: cell.weekday,
      half: cell.slot.half,
      index: cell.slot.index,
      label: made.ownLabel,
    };
    return { ...cleared, blocks: [...blocks, block] };
  }
  if (shown?.kind === 'class' && shown.classId === brush.classId) return cleared;
  const { schoolClass, course } = made;
  if (schoolClass === undefined || course === undefined) return version;
  const entry = (place: Cell, weeks: Weeks): TimetableEntry => ({
    id: made.newId(),
    weekday: place.weekday,
    slot: place.slot,
    courseId: course.id,
    groupId: wholeGroup(schoolClass).id,
    weeks,
    sessionType: 'lesson',
  });
  if (made.shift === undefined) return { ...cleared, entries: [...entries, entry(cell, 'every')] };
  const weeks: Weeks = cell.slot.half === made.shift ? 'A' : 'B';
  const added = [entry(cell, weeks), ...(mirror === undefined ? [] : [entry(mirror, weeks === 'A' ? 'B' : 'A')])];
  return { ...cleared, entries: [...entries, ...added] };
}

/** The same place in the other half-day, for a double shift. */
export function mirrorOf(cell: Cell): Cell {
  return {
    weekday: cell.weekday,
    slot: { half: cell.slot.half === 'morning' ? 'afternoon' : 'morning', index: cell.slot.index },
  };
}

/** Each class's sessions in a week, in the order of the classes, and their total. */
export function classLoads(version: TimetableVersion, classOf: ClassOf, classes: readonly SchoolClass[]) {
  const counts = new Map<string, number>();
  for (const entry of version.entries) {
    const classId = classOf(entry.courseId)?.id;
    if (classId !== undefined) counts.set(classId, (counts.get(classId) ?? 0) + (entry.weeks === 'every' ? 1 : 0.5));
  }
  const loads = classes.flatMap((schoolClass) => {
    const count = counts.get(schoolClass.id);
    return count === undefined ? [] : [{ name: schoolClass.name, count }];
  });
  return { loads, total: loads.reduce((sum, load) => sum + load.count, 0) };
}

/** Whether a session or the teacher's own time sits where `match` says, such as on Saturday. */
export function holds(version: TimetableVersion, match: (weekday: Weekday, slot: Slot) => boolean): boolean {
  return (
    version.entries.some((entry) => match(entry.weekday, entry.slot)) ||
    version.blocks.some((block) => match(block.weekday, { half: block.half, index: block.index ?? 1 }))
  );
}
