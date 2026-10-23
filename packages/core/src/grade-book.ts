// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The grade book (#240, PRD §3.5, answers 456 and 457): for a course and term,
// the pupils sitting the exam, enrolled on the window's first day or, with no
// window, the term's last; each one's T, the sum of the component marks once
// every one has a mark, or in primary the mean of their totals over the
// months the teacher marked one of the setup's components in; F, the mean of
// the tests they sat; E, the exam; lycée's P or O, the practical work or the
// oral, when the formula the administration chose weighs them (answer 463);
// and the average by the class and subject's formula once every part it
// weighs has a value. Everything is kept at full precision: a value shows two
// decimals, rounded half up, its full value truncated to four, and the
// threshold, half the scale, and the ranks compare the full value. The class's
// figures are the mean, highest and lowest of the averages there are, and how
// many reach the threshold.

import {
  assessmentFor,
  courseFormula,
  presetFor,
  type AssessmentData,
  type AveragePart,
  type Formula,
  type SetupLine,
} from './assessment.ts';
import { termMonths } from './component-figures.ts';
import type { Context } from './context.ts';
import { componentTotal, termAverage } from './justification.ts';
import { examList, termExams, termTests, testMean } from './mark-figures.ts';
import { marksFor, type MarkValue } from './marks.ts';

/** The book's columns in the formulas' order: practical work and the oral before the exam. */
const BOOK_ORDER: readonly AveragePart[] = ['T', 'F', 'P', 'O', 'E'];

/** The tolerance values are compared and rounded with, so a computed 9.9999999999 is 10. */
const TOLERANCE = 1e-9;

export interface BookRow {
  readonly pupilId: string;
  /** The pupil's number on the list, from 1, kept when the rows are sorted. */
  readonly number: number;
  /** In primary, the pupil's total in each of the book's months; empty otherwise. */
  readonly months: readonly (number | null)[];
  readonly T: number | null;
  readonly F: number | null;
  readonly E: number | 'absent' | null;
  /** Lycée's practical work, when the formula weighs it. */
  readonly P: number | 'absent' | null;
  /** Lycée's oral, when the formula weighs it. */
  readonly O: number | 'absent' | null;
  readonly average: number | null;
  /** By average, highest first, equal values sharing a rank; null without an average. */
  readonly rank: number | null;
}

export interface BookFigures {
  readonly mean: number | null;
  readonly highest: number | null;
  readonly lowest: number | null;
  /** The pupils whose average reaches the threshold. */
  readonly reached: number;
  /** The pupils with an average. */
  readonly counted: number;
}

export interface GradeBook {
  /** The formula the class and subject follows; null for a subject with continuous assessment only. */
  readonly formula: Formula | null;
  readonly scale: number;
  /** The pass threshold, half the scale: 10 on 20, 5 on 10. */
  readonly threshold: number;
  /** The parts shown: those the formula weighs, in its order with the exam last, or T alone without a formula. */
  readonly parts: readonly AveragePart[];
  /** In primary, the term's months the teacher marked for the course, in order. */
  readonly months: readonly string[];
  readonly rows: readonly BookRow[];
  readonly figures: BookFigures;
}

/** Whether a level keeps its continuous assessment month by month. */
export function monthlyLevel(level: string): boolean {
  return level === 'primary';
}

/** A value as the book shows it: two decimals, rounded half up. */
export function shownMark(value: number): string {
  return (Math.round((value + TOLERANCE) * 100) / 100).toFixed(2);
}

/** A value in full: truncated to four decimals, never fewer than two, so it never rounds up to a threshold. */
export function fullMark(value: number): string {
  const cut = (Math.floor((value + TOLERANCE) * 10000) / 10000).toFixed(4);
  return cut.replace(/(\.\d\d\d?)0+$/, '$1').replace(/(\.\d\d)0$/, '$1');
}

/** Whether a value reaches a threshold, on its full value. */
export function reaches(value: number, threshold: number): boolean {
  return value + TOLERANCE >= threshold;
}

/** Whether a value shows at or above a threshold while its full value is below it, as 9.996 shows 10.00. */
export function shownAtThreshold(value: number, threshold: number): boolean {
  return Number(shownMark(value)) >= threshold && !reaches(value, threshold);
}

/** The term's months that have a mark for one of the course's components. */
function markedMonths(context: Context, courseId: string, term: number, lines: readonly SetupLine[]): string[] {
  const ids = new Set(lines.map((line) => line.id));
  const marked = new Set<string>();
  for (const mark of context.state.marks.values()) {
    if (mark.courseId !== courseId || mark.term !== term || mark.value === null) continue;
    const { target } = mark;
    if (target.kind === 'component' && target.month !== undefined && ids.has(target.componentId)) {
      marked.add(target.month);
    }
  }
  return termMonths(context, term).filter((month) => marked.has(month));
}

/** The mean of the values, or null when one is missing or there are none. */
function meanOf(values: readonly (number | null)[]): number | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  return (values as number[]).reduce((sum, value) => sum + value, 0) / values.length;
}

/** Each average's rank: one more than the averages above it. */
function ranksOf(averages: readonly (number | null)[]): (number | null)[] {
  const known = averages.filter((value): value is number => value !== null);
  return averages.map((value) =>
    value === null ? null : 1 + known.filter((other) => other > value + TOLERANCE).length,
  );
}

/** A course's grade book for a term; null for a course the book is not kept for. */
export function gradeBook(context: Context, data: AssessmentData, courseId: string, term: number): GradeBook | null {
  const { state } = context;
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  const dates = context.ref.year.terms.find((one) => one.number === term);
  if (course === undefined || room === undefined || dates === undefined) return null;
  const preset = presetFor(data, room.level, course.subject);
  const formula = courseFormula(state, data, courseId) ?? null;
  const scale = data.presets.find((one) => one.level === room.level)?.scale;
  if (scale === undefined || (preset === undefined && formula === null)) return null;
  const weighed = BOOK_ORDER.filter((part) => (formula?.weights[part] ?? 0) > 0);
  const parts: AveragePart[] = formula === null ? ['T'] : weighed;
  const lines: readonly SetupLine[] = preset === undefined ? [] : assessmentFor(state, preset, courseId, term).lines;
  const months = preset !== undefined && monthlyLevel(room.level) ? markedMonths(context, courseId, term, lines) : [];
  const listed = examList(context, courseId, termExams(context, courseId, term)?.from ?? dates.to);
  const tests = termTests(context, courseId, term);
  const sat = (part: 'E' | 'P' | 'O') => {
    const kind = part === 'E' ? 'exam' : part === 'P' ? 'practical' : 'oral';
    return parts.includes(part) ? marksFor(state, courseId, term, { kind }) : new Map<string, MarkValue>();
  };
  const [exams, practical, oral] = [sat('E'), sat('P'), sat('O')];
  const rows = listed.map((pupilId, index) => {
    const monthly = months.map((month) => componentTotal(state, courseId, term, lines, pupilId, month).total);
    const T = !parts.includes('T')
      ? null
      : monthlyLevel(room.level)
        ? meanOf(monthly)
        : componentTotal(state, courseId, term, lines, pupilId).total;
    const F = parts.includes('F') ? testMean(context, term, tests, pupilId) : null;
    const [E, P, O] = [exams.get(pupilId) ?? null, practical.get(pupilId) ?? null, oral.get(pupilId) ?? null];
    const known = (value: number | 'absent' | null) => (typeof value === 'number' ? value : null);
    const average = formula === null ? null : termAverage(formula, { T, F, E: known(E), P: known(P), O: known(O) });
    return { pupilId, number: index + 1, months: monthly, T, F, E, P, O, average };
  });
  const ranks = ranksOf(rows.map((row) => row.average));
  const averages = rows.flatMap((row) => (row.average === null ? [] : [row.average]));
  const threshold = scale / 2;
  return {
    formula,
    scale,
    threshold,
    parts,
    months,
    rows: rows.map((row, index) => ({ ...row, rank: ranks[index] ?? null })),
    figures: {
      mean: averages.length === 0 ? null : averages.reduce((sum, value) => sum + value, 0) / averages.length,
      highest: averages.length === 0 ? null : Math.max(...averages),
      lowest: averages.length === 0 ? null : Math.min(...averages),
      reached: averages.filter((value) => reaches(value, threshold)).length,
      counted: averages.length,
    },
  };
}
