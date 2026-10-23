// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What entering a test's or the exam's marks reads (#239, Marks-test,
// Marks-exam, answers 439, 440 and 447): the sheet, with its title, day,
// maximum, the level's scale, and the pupils on its list in class-list order,
// for a test of the course's in the term its day falls in; the keypad's typing,
// two digits at most before the point and two after, the quick quarters keeping
// the whole part; what «التالي» does with what was typed: refuse a mark over
// the maximum, record a new mark, clear one erased, or move on; and each test's
// or the exam's line on the hub, with how many of its pupils have a mark or
// «غائب».

import {
  entryCheck,
  examList,
  marksFor,
  markProblem,
  termExams,
  termNumberOn,
  testList,
  type AssessmentData,
  type Context,
  type Day,
  type MarkTarget,
  type MarkValue,
  type ScheduledTest,
} from '@minhajna/core';
import { courseTests } from '../exams/test-rules';

export interface EntrySheet {
  readonly target: MarkTarget;
  /** The test's own name, or null for the term's exam. */
  readonly title: string | null;
  /** The test's day, or the exam window's first day. */
  readonly day: Day;
  readonly max: number;
  /** The pupils on its list, in class-list order. */
  readonly listed: readonly { readonly id: string; readonly name: string }[];
}

/** The scale of a level's marks: 20, or 10 in primary; null when no preset gives it. */
export function levelScale(data: AssessmentData, level: string): number | null {
  return data.presets.find((preset) => preset.level === level)?.scale ?? null;
}

/** The sheet for a test of the course's, or for the term's exam without one; null when it cannot be entered. */
export function entrySheet(
  context: Context,
  data: AssessmentData,
  courseId: string,
  term: number,
  testId?: string,
): EntrySheet | null {
  const { state } = context;
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  const max = room === undefined ? null : levelScale(data, room.level);
  if (max === null) return null;
  const named = (ids: readonly string[]) => ids.map((id) => ({ id, name: state.pupils.get(id)?.name ?? '' }));
  if (testId !== undefined) {
    const test = state.tests.get(testId);
    if (test === undefined || test.courseId !== courseId) return null;
    if (termNumberOn(context.ref.year, test.day) !== term) return null;
    const target: MarkTarget = { kind: 'test', testId };
    return { target, title: test.title, day: test.day, max, listed: named(testList(context, test)) };
  }
  const exams = termExams(context, courseId, term);
  if (exams === null) return null;
  return {
    target: { kind: 'exam' },
    title: null,
    day: exams.from,
    max,
    listed: named(examList(context, courseId, exams.from)),
  };
}

/** The buffer after a key: a digit, the point, or erase. */
export function pressKey(buffer: string, key: string): string {
  if (key === 'erase') return buffer.slice(0, -1);
  if (key === '.') return buffer.includes('.') ? buffer : `${buffer === '' ? '0' : buffer}.`;
  const [whole = '', fraction] = buffer.split('.');
  if (fraction === undefined ? whole.length >= 2 : fraction.length >= 2) return buffer;
  return buffer === '0' ? key : buffer + key;
}

/** The buffer with a quick quarter: the whole part typed, then .25, .5 or .75. */
export function withQuarter(buffer: string, quarter: '.25' | '.5' | '.75'): string {
  return `${Math.trunc(Number(buffer === '' || buffer === '.' ? '0' : buffer))}${quarter}`;
}

/** What a pupil's cell starts the buffer with: their mark, or nothing. */
export function startBuffer(saved: MarkValue | undefined): string {
  return typeof saved === 'number' ? String(saved) : '';
}

export type NextStep =
  { readonly kind: 'over' } | { readonly kind: 'move' } | { readonly kind: 'record'; readonly value: number | null };

/** What «التالي» does: refuse a mark over the maximum, record a changed mark or a cleared one, or move on. */
export function nextStep(buffer: string, saved: MarkValue | undefined, max: number): NextStep {
  if (buffer === '' || buffer === '.') {
    return typeof saved === 'number' ? { kind: 'record', value: null } : { kind: 'move' };
  }
  const value = Number(buffer);
  if (markProblem(value, max) !== null) return { kind: 'over' };
  return value === saved ? { kind: 'move' } : { kind: 'record', value };
}

export interface HubEntry {
  readonly sheet: EntrySheet;
  /** Pupils on the list with a mark or «غائب». */
  readonly done: number;
}

/** How far a sheet's entry has gone. */
export function entryDone(context: Context, courseId: string, term: number, sheet: EntrySheet): HubEntry {
  const marks = marksFor(context.state, courseId, term, sheet.target);
  const check = entryCheck(
    sheet.listed.map((pupil) => pupil.id),
    marks,
  );
  return { sheet, done: check.entered + check.absent };
}

/** The course's tests whose day falls in the term, by day. */
export function termTests(context: Context, courseId: string, term: number): ScheduledTest[] {
  return courseTests(context, courseId).filter((test) => termNumberOn(context.ref.year, test.day) === term);
}
