// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The term export (#242, PRD §3.7, answer 466): for a course and term with a
// grade book, each pupil in list order, the order of the school's grid, with
// the parts the formula weighs, their average and the appreciation chosen; and
// whether it is ready, which it is not while any part or appreciation is still
// missing (R-3.6-07). An absence is a value, «غائب», and not a gap. A term
// whose marks descriptive observations replace has no export.

import { appreciationGaps, appreciationsFor } from './appreciations.ts';
import type { AssessmentData, AveragePart } from './assessment.ts';
import type { Context } from './context.ts';
import { gradeBook } from './grade-book.ts';
import { courseObserved } from './observations.ts';

export type ExportValue = number | 'absent' | null;

export interface ExportRow {
  readonly pupilId: string;
  /** The pupil's number on the list, from 1. */
  readonly number: number;
  /** Each part the export carries, in the book's order. */
  readonly values: Readonly<Partial<Record<AveragePart, ExportValue>>>;
  /** The term average by the formula; null without a formula or while a part has no number. */
  readonly average: number | null;
  /** The appreciation chosen, as it was recorded. */
  readonly appreciation: string | null;
}

export interface TermExport {
  readonly parts: readonly AveragePart[];
  /** Whether the course has a formula, so the export carries an average. */
  readonly averaged: boolean;
  readonly scale: number;
  readonly rows: readonly ExportRow[];
  /** The cells with no value yet, as pupil and part, in list order. */
  readonly missingMarks: readonly { readonly pupilId: string; readonly part: AveragePart }[];
  /** The pupils with no appreciation yet, in list order. */
  readonly missingAppreciations: readonly string[];
  readonly ready: boolean;
}

/** A course's term export; null without a grade book, or for a term observations replace. */
export function termExport(context: Context, data: AssessmentData, courseId: string, term: number): TermExport | null {
  if (courseObserved(context.state, data, courseId, term)) return null;
  const book = gradeBook(context, data, courseId, term);
  if (book === null) return null;
  const chosen = appreciationsFor(context.state, courseId, term);
  const rows = book.rows.map((row) => ({
    pupilId: row.pupilId,
    number: row.number,
    values: Object.fromEntries(book.parts.map((part) => [part, row[part]])),
    average: row.average,
    appreciation: chosen.get(row.pupilId)?.text ?? null,
  }));
  const missingMarks = rows.flatMap((row) =>
    book.parts.filter((part) => row.values[part] === null).map((part) => ({ pupilId: row.pupilId, part })),
  );
  const missingAppreciations = appreciationGaps(
    rows.map((row) => row.pupilId),
    chosen,
  );
  return {
    parts: book.parts,
    averaged: book.formula !== null,
    scale: book.scale,
    rows,
    missingMarks,
    missingAppreciations,
    ready: rows.length > 0 && missingMarks.length === 0 && missingAppreciations.length === 0,
  };
}
