// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher does on an exam week (#221, R-3.3-05, answers 268 and
// 270): an invigilation, with its day, its times and its room when typed,
// or a class exam, «اختبار قسمي», with the classes sitting it, one or
// several of the teacher's courses. The teacher types them from the
// school's paper; they can be set only on a day an exam window of one of
// the teacher's classes covers, and a class exam only for classes whose own
// window covers it. Today shows them, and an invigilation has its own row
// in the journal, never in the texts book; nothing counts them.

import { CLOCK, clockMinutes } from './bells.ts';
import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { isWithin, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { courseGrade, forGrade } from './joint.ts';
import type { CalendarEntry } from './reference.ts';
import type { State } from './state.ts';

export const DUTY_KINDS = ['invigilation', 'exam'] as const;

export type DutyKind = (typeof DUTY_KINDS)[number];

/** The longest room, in characters. */
export const ROOM_MAX = 40;

export interface ExamDuty {
  readonly id: string;
  readonly kind: DutyKind;
  readonly day: Day;
  /** As typed, HH:MM on a 24-hour clock. */
  readonly from: string;
  readonly to: string;
  readonly room?: string;
  /** For a class exam: the courses sitting it, in the order chosen. */
  readonly courseIds?: readonly string[];
}

function courseWindows(context: Context, courseId: string): CalendarEntry[] {
  const { state, calendar } = context;
  const course = state.courses.get(courseId);
  if (course === undefined || !state.classes.has(course.classId)) return [];
  const setup = courseSetup(context, courseId);
  const school = state.schools.get(setup.schoolClass.schoolId);
  if (school === undefined) return [];
  return calendar
    .entriesFor(school, forGrade(setup.schoolClass, courseGrade(course, setup.schoolClass)))
    .filter((entry) => entry.effect === 'exam');
}

/** The exam windows of the teacher's classes, each once, by first day. */
export function examWindows(context: Context): CalendarEntry[] {
  const windows = new Map<string, CalendarEntry>();
  for (const courseId of context.state.courses.keys()) {
    for (const entry of courseWindows(context, courseId)) windows.set(entry.id, entry);
  }
  return [...windows.values()].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** The teacher's courses whose own exam window covers `day`, the classes that may sit a class exam then. */
export function examCourses(context: Context, day: Day): string[] {
  return [...context.state.courses.keys()].filter((courseId) =>
    courseWindows(context, courseId).some((entry) => isWithin(day, entry.from, entry.to)),
  );
}

/** Whether an exam window of one of the teacher's classes covers `day`. */
export function examDay(context: Context, day: Day): boolean {
  return examWindows(context).some((entry) => isWithin(day, entry.from, entry.to));
}

/** The event that sets an exam-week entry, or corrects one set before under the same ID. */
export function setDuty(context: Context, duty: ExamDuty): RecordEvent {
  const { state, ref } = context;
  if (!(DUTY_KINDS as readonly string[]).includes(duty.kind)) throw new RangeError('Unknown kind of entry');
  if (!isWithin(duty.day, ref.year.from, ref.year.to)) throw new RangeError('The day is outside the school year');
  if (!examDay(context, duty.day)) throw new RangeError('The day is outside the exam windows');
  if (!CLOCK.test(duty.from) || !CLOCK.test(duty.to)) throw new RangeError('A time is HH:MM');
  if (clockMinutes(duty.to) <= clockMinutes(duty.from)) throw new RangeError('The entry ends after it starts');
  const room = duty.room?.trim() ?? '';
  if (room.length > ROOM_MAX) throw new RangeError('The room is too long');
  const courseIds = duty.courseIds ?? [];
  if (duty.kind === 'exam') {
    if (courseIds.length === 0) throw new RangeError('A class exam names its classes');
    if (new Set(courseIds).size !== courseIds.length) throw new RangeError('A class is named twice');
    if (courseIds.some((id) => !state.courses.has(id))) throw new RangeError('No such course');
    const sitting = examCourses(context, duty.day);
    if (courseIds.some((id) => !sitting.includes(id))) throw new RangeError('A class has no exams that day');
  } else if (courseIds.length > 0) {
    throw new RangeError('An invigilation names no class');
  }
  return {
    kind: 'duty.set',
    duty: {
      id: duty.id,
      kind: duty.kind,
      day: duty.day,
      from: duty.from,
      to: duty.to,
      ...(room !== '' && { room }),
      ...(duty.kind === 'exam' && { courseIds }),
    },
  };
}

/** A day's exam-week entries, by start, then end, then ID. */
export function dutiesOn(state: State, day: Day): ExamDuty[] {
  return [...state.duties.values()].filter((duty) => duty.day === day).sort(compareDuties);
}

export function compareDuties(a: ExamDuty, b: ExamDuty): number {
  return (
    (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) ||
    clockMinutes(a.from) - clockMinutes(b.from) ||
    clockMinutes(a.to) - clockMinutes(b.to) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
