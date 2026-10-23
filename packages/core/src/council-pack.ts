// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The class-council pack (#244, Council, R-3.7-11 to R-3.7-17, answer 470):
// a course's term figures taken over the pupils with an average, on the full
// value (R-3.5-17). The class average, highest, lowest and the population's
// standard deviation; how many reach 10, or 5 in primary; the bands, fixed on
// 20 and halved on 10; boys and girls apart; the grade book's ranks; from
// term 2, the previous term's figures and ranks; the pupils below the
// teacher's remediation threshold and those at or above the distinction one,
// which no text sets; and the class's roll-call book over the term. The
// thresholds are one setting for every class, kept on 20 and private.

import type { AssessmentData } from './assessment.ts';
import type { Context } from './context.ts';
import { compareDays, minDay, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { gradeBook, reaches, type GradeBook } from './grade-book.ts';
import { countRollCalls, DEFAULT_COUNTING } from './roll-call-counts.ts';
import type { State } from './state.ts';

/** The teacher's thresholds, on 20: remediation below the first, distinction from the second. */
export interface CouncilThresholds {
  readonly remedial: number;
  readonly distinction: number;
}

export const DEFAULT_THRESHOLDS: CouncilThresholds = { remedial: 8, distinction: 15 };

/** Each band's lower bound on 20; the last band has no upper one. */
export const BAND_FLOORS = [0, 5, 8, 10, 12, 14, 16] as const;

export interface CouncilBand {
  readonly from: number;
  /** Null for the last band. */
  readonly to: number | null;
  readonly count: number;
}

export interface SexFigures {
  readonly sex: 'm' | 'f';
  /** The pupils with an average. */
  readonly counted: number;
  readonly reached: number;
  readonly mean: number | null;
}

export interface CouncilRank {
  readonly pupilId: string;
  readonly number: number;
  readonly average: number;
  readonly rank: number;
  /** The rank in the previous term; null in term 1, or without an average then. */
  readonly previous: number | null;
}

export interface TermFigures {
  readonly mean: number | null;
  readonly reached: number;
  readonly counted: number;
}

export interface CouncilAttendance {
  /** Half-days missed, a whole day counting 2. */
  readonly absent: number;
  readonly late: number;
  /** Actual over possible attendance; null when none was possible. */
  readonly rate: number | null;
}

export interface CouncilPack {
  readonly book: GradeBook;
  readonly mean: number | null;
  readonly highest: number | null;
  readonly lowest: number | null;
  /** Over the pupils with an average, divided by their number; null without one. */
  readonly deviation: number | null;
  readonly reached: number;
  readonly counted: number;
  readonly bands: readonly CouncilBand[];
  readonly sexes: readonly SexFigures[];
  /** Highest first, equal values sharing a rank, then in list order. */
  readonly ranks: readonly CouncilRank[];
  /** The previous term's figures; null in term 1, or when it has no average. */
  readonly previous: TermFigures | null;
  /** The thresholds on the book's scale. */
  readonly thresholds: CouncilThresholds;
  readonly remedial: readonly CouncilRank[];
  readonly distinction: readonly CouncilRank[];
  /** Null when the class has no roll call taken in the term. */
  readonly attendance: CouncilAttendance | null;
}

/** The teacher's thresholds, or the defaults. */
export function thresholdsOf(state: Pick<State, 'councilThresholds'>): CouncilThresholds {
  return state.councilThresholds ?? DEFAULT_THRESHOLDS;
}

/** Why thresholds cannot be kept: a value outside 0 to 20 or with more than two decimals, or out of order. */
export function thresholdsProblem(thresholds: CouncilThresholds): 'range' | 'decimals' | 'order' | null {
  const values = [thresholds.remedial, thresholds.distinction];
  if (values.some((value) => !Number.isFinite(value) || value <= 0 || value > 20)) return 'range';
  if (values.some((value) => Math.abs(Math.round(value * 100) - value * 100) > 1e-6)) return 'decimals';
  return thresholds.remedial < thresholds.distinction ? null : 'order';
}

/** Whether a value is a pair of thresholds, as a stored or incoming one must be. */
export function isThresholds(value: unknown): value is CouncilThresholds {
  if (typeof value !== 'object' || value === null) return false;
  const { remedial, distinction } = value as Record<string, unknown>;
  return (
    Object.keys(value).length === 2 &&
    typeof remedial === 'number' &&
    typeof distinction === 'number' &&
    thresholdsProblem({ remedial, distinction }) === null
  );
}

/** The event that keeps the thresholds; refused when they cannot be kept. */
export function setThresholds(thresholds: CouncilThresholds): RecordEvent {
  const problem = thresholdsProblem(thresholds);
  if (problem !== null) throw new RangeError(`Council thresholds refused: ${problem}`);
  return {
    kind: 'council-thresholds.set',
    thresholds: { remedial: thresholds.remedial, distinction: thresholds.distinction },
  };
}

/** The mean of the values; null without one. */
function meanOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** A book's figures as the comparison gives them. */
function termFigures(book: GradeBook): TermFigures {
  return { mean: book.figures.mean, reached: book.figures.reached, counted: book.figures.counted };
}

/**
 * The class's roll-call book over the term's dates up to `today`; null with no roll call taken, even when the
 * teacher counts the units without one as present.
 */
function attendanceOf(context: Context, classId: string, from: Day, to: Day): CouncilAttendance | null {
  if (compareDays(from, to) > 0) return null;
  const counts = countRollCalls(context, classId, from, to);
  const rules = context.state.counting ?? DEFAULT_COUNTING;
  if (counts.units - (rules.untaken === 'present' ? counts.untaken : 0) === 0) return null;
  const sum = (pick: (one: (typeof counts.pupils)[number]) => number) =>
    counts.pupils.reduce((total, one) => total + pick(one), 0);
  const possible = sum((one) => one.possible);
  return {
    absent: sum((one) => one.absent),
    late: sum((one) => one.late.length),
    rate: possible === 0 ? null : sum((one) => one.present) / possible,
  };
}

/** A course's council pack for a term; null without a grade book whose formula gives averages. */
export function councilPack(
  context: Context,
  data: AssessmentData,
  courseId: string,
  term: number,
  today: Day,
): CouncilPack | null {
  const { state } = context;
  const course = state.courses.get(courseId);
  const dates = context.ref.year.terms.find((one) => one.number === term);
  const book = gradeBook(context, data, courseId, term);
  if (course === undefined || dates === undefined || book === null || book.formula === null) return null;
  const ratio = book.scale / 20;
  const known = book.rows.flatMap((row) =>
    row.average === null || row.rank === null ? [] : [{ ...row, average: row.average, rank: row.rank }],
  );
  const averages = known.map((row) => row.average);
  const mean = meanOf(averages);
  const deviation =
    mean === null ? null : Math.sqrt(averages.reduce((sum, value) => sum + (value - mean) ** 2, 0) / averages.length);
  const floors = BAND_FLOORS.map((floor) => floor * ratio);
  const bands = floors.map((from, index) => {
    const to = floors[index + 1] ?? null;
    const count = averages.filter((value) => reaches(value, from) && (to === null || !reaches(value, to))).length;
    return { from, to, count };
  });
  const sexes = (['m', 'f'] as const).map((sex) => {
    const theirs = known.filter((row) => state.pupils.get(row.pupilId)?.sex === sex).map((row) => row.average);
    const reached = theirs.filter((value) => reaches(value, book.threshold)).length;
    return { sex, counted: theirs.length, reached, mean: meanOf(theirs) };
  });
  const before = term > 1 ? gradeBook(context, data, courseId, term - 1) : null;
  const earlier = new Map((before?.rows ?? []).map((row) => [row.pupilId, row.rank]));
  const ranks = known
    .map((row) => ({
      pupilId: row.pupilId,
      number: row.number,
      average: row.average,
      rank: row.rank,
      previous: earlier.get(row.pupilId) ?? null,
    }))
    .sort((a, b) => a.rank - b.rank || a.number - b.number);
  const set = thresholdsOf(state);
  const thresholds = { remedial: set.remedial * ratio, distinction: set.distinction * ratio };
  const byNumber = [...ranks].sort((a, b) => a.number - b.number);
  return {
    book,
    mean,
    highest: book.figures.highest,
    lowest: book.figures.lowest,
    deviation,
    reached: book.figures.reached,
    counted: book.figures.counted,
    bands,
    sexes,
    ranks,
    previous: before === null || before.figures.counted === 0 ? null : termFigures(before),
    thresholds,
    remedial: byNumber.filter((row) => !reaches(row.average, thresholds.remedial)),
    distinction: byNumber.filter((row) => reaches(row.average, thresholds.distinction)),
    attendance: attendanceOf(context, course.classId, dates.from, minDay(dates.to, today)),
  };
}
