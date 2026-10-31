// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Accepting a school's timetable package into the teacher's week (#580,
// Setup-5b, Setup-5d, PRD §3.2, §4.6, §7.4, answer 608). The package's bell
// times, when it carries them, give the school's slots: in order, split into
// morning and afternoon at the first break of 45 minutes or more, else after as
// many slots as the week's morning has, so a school whose morning has more
// slots than the teacher's week reads as the week has it, else at noon; without
// them, the slots keep the times the school has now. Each of the package's
// sessions is placed on the slots it spans, from a slot starting at its start
// through slots that follow one another in the same half-day to one ending at
// its end, in the class of that school with the same name, its group by name or
// the whole class, and the teacher's course in that class whose subject the
// package names in any of its names, or the only one when the package names no
// other known subject. A session that cannot be placed names why: no such
// class, group, course or slots. Only when every session is placed is the
// package accepted: a new version of the week, from the day given, holds the
// package's sessions for that school's classes and keeps the rest, the
// teacher's own time and the drawing's options, so sessions recorded before it
// are never rewritten; and the school keeps the package's bell times. The drawn
// week of a school reads as sessions at its slots' times now, with the course's
// subject label, and the package's as placed, with that label too, so a subject
// named two ways is not a difference; in both, a lesson's sessions that follow
// one another on a day are joined, whatever lies between them in the list.

import { clockMinutes, clockOf, withSlotTime, type ClockSpan } from './bells.ts';
import type { Day } from './day.ts';
import type { Course, School, SchoolClass, Slot, TimetableEntry, TimetableVersion } from './records.ts';
import type { TimetableRow } from './timetable-differences.ts';
import { timetableNameKey } from './timetable-import.ts';
import type { TimetablePart } from './timetable-package.ts';
import type { PartSession } from './timetable-sessions.ts';

/** What placing a package needs of the teacher's week. */
export interface PackagePlace {
  readonly part: TimetablePart;
  readonly school: School;
  /** The teacher's classes and courses, of every school. */
  readonly classes: readonly SchoolClass[];
  readonly courses: readonly Course[];
  /** The week drawn so far, or null. */
  readonly drawn: TimetableVersion | null;
  /** The slots the week has. */
  readonly slots: readonly Slot[];
  /** Each slot's time at the school now, or null. */
  readonly times: (slot: Slot) => ClockSpan | null;
  /** Every name a subject goes by, in each language. */
  readonly subjectNames: (code: string) => readonly string[];
  /** Every subject the country knows, by code. */
  readonly subjects: readonly string[];
  /** The label a course's subject shows. */
  readonly subjectLabel: (code: string) => string;
  /** The session type a placed session takes. */
  readonly sessionType: string;
}

/** A session that cannot be placed, and why. */
export interface Unplaced {
  readonly session: PartSession;
  readonly reason: 'class' | 'group' | 'course' | 'slots';
}

interface Placed {
  readonly session: PartSession;
  readonly course: Course;
  readonly groupId: string;
  readonly slots: readonly Slot[];
}

const BREAK = 45;
const NOON = 12 * 60;

/** The package's bell times as slots, morning and afternoon, or null when it carries none. */
export function packageSlots(bells: TimetablePart['bells'], mornings = 0): (Slot & ClockSpan)[] | null {
  if (bells.length === 0) return null;
  const sorted = [...bells].sort((a, b) => a[0] - b[0]);
  const gap = sorted.findIndex((one, at) => at > 0 && one[0] - sorted[at - 1]![1] >= BREAK);
  const byWeek = mornings > 0 && mornings <= sorted.length ? mornings : sorted.filter(([start]) => start < NOON).length;
  const split = gap > 0 ? gap : byWeek;
  return sorted.map(([start, end], at) => ({
    half: at < split ? 'morning' : 'afternoon',
    index: at < split ? at + 1 : at - split + 1,
    from: clockOf(start),
    to: clockOf(end),
  }));
}

function placeAll(place: PackagePlace) {
  const { part, school, slots } = place;
  const own = packageSlots(part.bells, slots.filter((one) => one.half === 'morning').length);
  const timed = slots
    .flatMap((slot) => {
      const span =
        own === null ? place.times(slot) : own.find((one) => one.half === slot.half && one.index === slot.index);
      if (span === null || span === undefined) return [];
      return [{ slot, start: clockMinutes(span.from), end: clockMinutes(span.to) }];
    })
    .sort((a, b) => a.start - b.start);
  const classes = place.classes.filter((one) => one.schoolId === school.id);
  const placed: Placed[] = [];
  const unplaced: Unplaced[] = [];
  for (const session of part.sessions) {
    const of = classes.find((one) => timetableNameKey(one.name) === timetableNameKey(session.class));
    if (of === undefined) {
      unplaced.push({ session, reason: 'class' });
      continue;
    }
    const group =
      session.group === ''
        ? of.groups.find((one) => one.kind === 'whole')
        : of.groups.find((one) => timetableNameKey(one.name) === timetableNameKey(session.group));
    const theirs = place.courses.filter((one) => one.classId === of.id);
    const subject = timetableNameKey(session.subject);
    const names = (code: string) =>
      [...place.subjectNames(code), code].some((name) => timetableNameKey(name) === subject);
    const only = theirs.length === 1 && !place.subjects.some(names) ? theirs[0] : undefined;
    const course = theirs.find((one) => names(one.subject)) ?? only;
    const run: Slot[] = [];
    let at = session.start;
    for (const one of timed) {
      if (one.start !== at || at >= session.end || (run.length > 0 && one.slot.half !== run[0]!.half)) continue;
      run.push(one.slot);
      at = one.end;
    }
    if (group === undefined) unplaced.push({ session, reason: 'group' });
    else if (course === undefined) unplaced.push({ session, reason: 'course' });
    else if (run.length === 0 || at !== session.end) unplaced.push({ session, reason: 'slots' });
    else placed.push({ session, course, groupId: group.id, slots: run });
  }
  return { placed, unplaced, classes, own };
}

const WEEKS = { both: 'every', A: 'A', B: 'B' } as const;

/** The package accepted as a version of the week from `from`, with the school's bell times, or what it cannot place. */
export function acceptPackage(place: PackagePlace, id: string, from: Day) {
  const { placed, unplaced, classes, own } = placeAll(place);
  if (unplaced.length > 0) return { ok: false as const, unplaced };
  const ours = place.courses.filter((one) => classes.some((of) => of.id === one.classId));
  const theirs = new Set(ours.map((one) => one.id));
  const kept = (place.drawn?.entries ?? []).filter((one) => !theirs.has(one.courseId));
  const entries: TimetableEntry[] = placed.flatMap(({ session, course, groupId, slots }) =>
    slots.map((slot) => ({
      id: '',
      weekday: session.day,
      slot,
      courseId: course.id,
      groupId,
      weeks: WEEKS[session.week],
      sessionType: place.sessionType,
      ...(session.room === '' ? {} : { room: session.room }),
    })),
  );
  const version: TimetableVersion = {
    id,
    from,
    entries: [...kept, ...entries.map((one, at) => ({ ...one, id: `${id}-${at + 1}` }))],
    blocks: place.drawn?.blocks ?? [],
    source: 'package',
    ...(place.drawn?.options === undefined ? {} : { options: place.drawn.options }),
  };
  const school = (own ?? []).reduce(
    (next, { from: start, to, ...slot }) => withSlotTime(next, 'usual', slot, { from: start, to }),
    place.school,
  );
  return { ok: true as const, version, school };
}

/** What a package cannot place in the teacher's week. */
export const unplacedOf = (place: PackagePlace): Unplaced[] => placeAll(place).unplaced;

const lessonOf = (one: TimetableRow) => [one.class, one.group, one.subject, one.week, one.room].join('\n');

function joined(rows: readonly TimetableRow[]): TimetableRow[] {
  const sorted = [...rows].sort((a, b) => a.day - b.day || a.start - b.start);
  const out: TimetableRow[] = [];
  const last = new Map<string, number>();
  for (const one of sorted) {
    const at = last.get(lessonOf(one));
    const before = at === undefined ? undefined : out[at];
    if (before !== undefined && before.day === one.day && before.end === one.start) {
      out[at!] = { ...before, end: one.end };
      continue;
    }
    last.set(lessonOf(one), out.length);
    out.push(one);
  }
  return out;
}

/** The package's sessions as rows, those placed under their course's subject label, the others as it names them. */
export function packageRows(place: PackagePlace): TimetableRow[] {
  const { placed } = placeAll(place);
  const label = new Map(placed.map((one) => [one.session.id, place.subjectLabel(one.course.subject)]));
  return joined(place.part.sessions.map(({ id, ...row }) => ({ ...row, subject: label.get(id) ?? row.subject })));
}

/** The drawn week's sessions of a school as rows, each slot's time as the school has it now, slots in a row joined. */
export function drawnRows(place: PackagePlace): TimetableRow[] {
  const classes = new Map(place.classes.filter((one) => one.schoolId === place.school.id).map((one) => [one.id, one]));
  const rows: TimetableRow[] = [];
  for (const entry of place.drawn?.entries ?? []) {
    const course = place.courses.find((one) => one.id === entry.courseId);
    const of = course === undefined ? undefined : classes.get(course.classId);
    const span = place.times(entry.slot);
    if (course === undefined || of === undefined || span === null) continue;
    const group = of.groups.find((one) => one.id === entry.groupId);
    rows.push({
      class: of.name,
      group: group === undefined || group.kind === 'whole' ? '' : group.name,
      subject: place.subjectLabel(course.subject),
      room: entry.room ?? '',
      day: entry.weekday,
      start: clockMinutes(span.from),
      end: clockMinutes(span.to),
      week: entry.weeks === 'every' ? 'both' : entry.weeks,
    });
  }
  return joined(rows);
}
