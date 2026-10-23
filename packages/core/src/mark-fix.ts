// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Corrections after the term (#243, R-3.7-10, R-5.5-02, R-5.5-03, answer
// 468). Circular 376 locks the system on the term's last day and reopens it
// for corrections, each with the teacher's report, so a term whose last day
// has passed changes its marks only by a correction: the mark as corrected,
// the value recorded before, a coded reason and an optional detail for the
// report. The history keeps both versions, and the term's corrections are
// listed in the order they were made. Before saving, the effect shows: the
// pupil's term average, the class average and how many reach the threshold,
// before and after.

import type { AssessmentData } from './assessment.ts';
import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { gradeBook } from './grade-book.ts';
import { markKey, setMark, type MarkEntry, type MarkValue } from './marks.ts';
import type { SchoolYear } from './reference.ts';
import type { State } from './state-type.ts';
import type { Version } from './versions.ts';

export const MARK_FIX_REASONS = ['sum-error', 'transcription-error', 'appeal', 'other'] as const;

export type MarkFixReason = (typeof MARK_FIX_REASONS)[number];

/** The longest detail a correction carries, in characters. */
export const FIX_NOTE_LIMIT = 200;

export interface MarkFix {
  /** The mark as corrected. */
  readonly mark: MarkEntry;
  /** What was recorded before; null when nothing was. */
  readonly before: MarkValue | null;
  readonly reason: MarkFixReason;
  /** The detail printed on the teacher's report, never shown in the activity log. */
  readonly note?: string;
}

/** One side of a correction's effect. */
export interface FixSide {
  readonly average: number | null;
  readonly mean: number | null;
  readonly reached: number;
}

export interface FixEffect {
  readonly scale: number;
  readonly threshold: number;
  readonly counted: number;
  readonly before: FixSide;
  readonly after: FixSide;
}

/** Whether the term's last day, by the school year's dates, has passed on `today`. */
export function termEnded(year: Pick<SchoolYear, 'terms'>, term: number, today: Day): boolean {
  const found = year.terms.find((one) => one.number === term);
  return found !== undefined && compareDays(today, found.to) > 0;
}

/** The event that corrects a mark; refused when it changes nothing, or its detail is too long. */
export function correctMark(
  mark: Omit<MarkEntry, 'value'>,
  before: MarkValue | null,
  value: MarkValue,
  max: number,
  reason: MarkFixReason,
  note = '',
): RecordEvent {
  const set = setMark(mark, value, max);
  const kept = set.kind === 'mark.set' ? set.mark.value : null;
  if (kept === null || kept === before) throw new RangeError('A correction changes the mark');
  const detail = note.trim();
  if (detail.length > FIX_NOTE_LIMIT) throw new RangeError('A correction’s detail is too long');
  return {
    kind: 'mark.corrected',
    fix: { mark: { ...mark, value: kept }, before, reason, ...(detail !== '' && { note: detail }) },
  };
}

/** A course's corrections for a term, in the order they were made. */
export function termFixes(
  state: Pick<State, 'markFixes'>,
  courseId: string,
  term: number,
): readonly Version<MarkFix>[] {
  return state.markFixes.filter((one) => one.value.mark.courseId === courseId && one.value.mark.term === term);
}

/** What a corrected mark would change in the grade book; null without one. */
export function fixEffect(context: Context, data: AssessmentData, mark: MarkEntry): FixEffect | null {
  const marks = new Map(context.state.marks);
  marks.set(markKey(mark), mark);
  const before = gradeBook(context, data, mark.courseId, mark.term);
  const after = gradeBook({ ...context, state: { ...context.state, marks } }, data, mark.courseId, mark.term);
  if (before === null || after === null) return null;
  const side = (book: typeof before): FixSide => ({
    average: book.rows.find((row) => row.pupilId === mark.pupilId)?.average ?? null,
    mean: book.figures.mean,
    reached: book.figures.reached,
  });
  return {
    scale: after.scale,
    threshold: after.threshold,
    counted: after.figures.counted,
    before: side(before),
    after: side(after),
  };
}
