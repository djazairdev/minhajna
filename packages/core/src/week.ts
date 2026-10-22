// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's week as they draw it (PRD §3.2, §4.6). The grid holds slots
// by half-day, never clock times: bell times come from templates (#29). It
// shows the country's working days, Saturday when the teacher has Saturday
// classes, four slots in each half-day and a fifth morning slot when asked,
// with a fifth afternoon slot too under a double shift, so that a session
// drawn there keeps its other week (#230, answer 385).
// Two things clash when they take the same slot in a week they share: two
// sessions, or a session and time that belongs to the teacher. Sessions of
// two schools are kept apart, since a hand-drawn week can only be fixed by
// the teacher, while a school's package is settled by a new version (§3.2).

import { keptClashAt } from './session-moves.ts';
import type { Weekday } from './day.ts';
import {
  compareSlots,
  type Half,
  type Slot,
  type TeacherBlock,
  type TimetableEntry,
  type TimetableVersion,
  type WeekOptions,
  type Weeks,
} from './records.ts';
import { courseGrade } from './joint.ts';
import type { CountryProfile } from './reference.ts';
import type { State } from './state.ts';

export const SATURDAY: Weekday = 6;

/** Slots in each half-day before the fifth morning slot. */
export const SLOTS_PER_HALF = 4;

export interface WeekGrid {
  readonly days: readonly Weekday[];
  readonly slots: readonly Slot[];
}

/** The days and slots the teacher draws on. */
export function weekGrid(country: CountryProfile, options: WeekOptions = {}): WeekGrid {
  const days = [...country.workingDays];
  if (options.saturday && !days.includes(SATURDAY)) days.push(SATURDAY);
  const order = (day: Weekday) => (day - country.weekStartsOn + 7) % 7;
  days.sort((a, b) => order(a) - order(b));
  const halves: [Half, number][] = [
    ['morning', SLOTS_PER_HALF + (options.fifthMorning ? 1 : 0)],
    ['afternoon', SLOTS_PER_HALF + (options.fifthMorning && options.doubleShift !== undefined ? 1 : 0)],
  ];
  const slots = halves.flatMap(([half, count]) => Array.from({ length: count }, (_, at) => ({ half, index: at + 1 })));
  return { days, slots };
}

/** Whether two weekly patterns ever meet in the same week. */
export function weeksOverlap(a: Weeks, b: Weeks): boolean {
  return a === 'every' || b === 'every' || a === b;
}

/** Whether a block takes a slot: its own slot, or every slot of its half-day. */
export function blockCovers(block: TeacherBlock, weekday: Weekday, slot: Slot): boolean {
  return (
    block.weekday === weekday && block.half === slot.half && (block.index === undefined || block.index === slot.index)
  );
}

export type WeekItem =
  | { readonly kind: 'entry'; readonly entry: TimetableEntry; readonly schoolId: string | null }
  | { readonly kind: 'block'; readonly block: TeacherBlock };

export interface Clash {
  readonly weekday: Weekday;
  readonly slot: Slot;
  /** Two or more items, sessions first, in the order drawn. */
  readonly items: readonly WeekItem[];
  /** The distinct schools of the clashing sessions: two or more when the week of two schools clashes. */
  readonly schools: readonly string[];
  /** Whether the teacher kept it, «الإبقاء على الاثنين», so it is no longer open (#232, answer 400). */
  readonly kept: boolean;
}

function weeksOf(item: WeekItem): Weeks {
  return item.kind === 'entry' ? item.entry.weeks : (item.block.weeks ?? 'every');
}

/** Every slot where two items meet, in the order of the week. */
export function weekClashes(version: TimetableVersion, state: State): Clash[] {
  const schoolOf = (entry: TimetableEntry) => {
    const course = state.courses.get(entry.courseId);
    const schoolClass = course && state.classes.get(course.classId);
    return schoolClass?.schoolId ?? null;
  };
  const cells = new Map<string, { weekday: Weekday; slot: Slot; items: WeekItem[] }>();
  const cell = (weekday: Weekday, slot: Slot) => {
    const key = `${weekday}:${slot.half}:${slot.index}`;
    let found = cells.get(key);
    if (found === undefined) cells.set(key, (found = { weekday, slot, items: [] }));
    return found;
  };
  for (const entry of version.entries) {
    cell(entry.weekday, entry.slot).items.push({ kind: 'entry', entry, schoolId: schoolOf(entry) });
  }
  for (const block of version.blocks) {
    if (block.index !== undefined) {
      cell(block.weekday, { half: block.half, index: block.index }).items.push({ kind: 'block', block });
      continue;
    }
    for (const entry of version.entries) {
      if (blockCovers(block, entry.weekday, entry.slot)) {
        cell(entry.weekday, entry.slot).items.push({ kind: 'block', block });
      }
    }
  }
  const clashes: Clash[] = [];
  for (const { weekday, slot, items } of cells.values()) {
    const meeting = items.filter((item, at) =>
      items.some((other, otherAt) => otherAt !== at && weeksOverlap(weeksOf(item), weeksOf(other))),
    );
    const sessions = meeting.filter((item) => item.kind === 'entry');
    if (meeting.length < 2 || sessions.length === 0) continue;
    const schools = [
      ...new Set(sessions.flatMap((item) => (item.kind === 'entry' && item.schoolId !== null ? [item.schoolId] : []))),
    ];
    const kept = keptClashAt(state, version.id, weekday, slot) !== undefined;
    clashes.push({
      weekday,
      slot,
      items: [...sessions, ...meeting.filter((item) => item.kind === 'block')],
      schools,
      kept,
    });
  }
  return clashes.sort((a, b) => a.weekday - b.weekday || compareSlots(a.slot, b.slot));
}

/** Each course's sessions in a week, an A-week or B-week slot counting as half. */
export function weeklyLoad(version: TimetableVersion): Map<string, number> {
  const load = new Map<string, number>();
  for (const entry of version.entries) {
    load.set(entry.courseId, (load.get(entry.courseId) ?? 0) + (entry.weeks === 'every' ? 1 : 0.5));
  }
  return load;
}

/** The course of a class and subject in a school year, if the teacher has it; in a joint class, of one level. */
export function courseOf(state: State, classId: string, subject: string, year: string, grade?: string) {
  const schoolClass = state.classes.get(classId);
  return [...state.courses.values()].find(
    (course) =>
      course.classId === classId &&
      course.subject === subject &&
      course.year === year &&
      (grade === undefined || (schoolClass !== undefined && courseGrade(course, schoolClass) === grade)),
  );
}
