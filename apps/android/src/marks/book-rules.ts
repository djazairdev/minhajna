// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «كشف النقاط» says (#240, Marks-book, Marks-book-value, P-Marks, answers
// 457 to 459): each part's cell, two decimals, «غ» for an exam, practical work
// or oral missed (answer 463) and «—» for a part not in yet; primary's months
// under the pupil's name; the rows by the list or by the average, highest
// first, those with none after in list order; the class's figures; the pupils
// shown at the threshold whose full value is below it; and, for one pupil, the
// formula with their values in full and whether the average reaches the
// threshold, with its rank.

import {
  fullMark,
  reaches,
  shownAtThreshold,
  shownMark,
  type AveragePart,
  type BookRow,
  type CountryProfile,
  type FormulaId,
  type GradeBook,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { periodName } from './component-rules';

type Translate = ReturnType<typeof useText>;

export type BookOrder = 'list' | 'average';

const PART_LABELS = {
  T: 'marks.book.T',
  F: 'marks.book.F',
  E: 'marks.book.E',
  P: 'marks.book.P',
  O: 'marks.book.O',
} as const;

const FORMULA_LINES: Readonly<Record<FormulaId, string>> = {
  'primary-examined': 'marks.book.with.primaryExamined',
  'primary-exam-only': 'marks.book.with.examOnly',
  cem: 'marks.book.with.cem',
  lycee: 'marks.book.with.lycee',
  'lycee-practical': 'marks.book.with.lyceePractical',
  'lycee-oral': 'marks.book.with.lyceeOral',
};

/** A part's name, such as «التقويم». */
export function partLabel(t: Translate, part: AveragePart): string {
  return t(PART_LABELS[part]);
}

/** A cell: two decimals, «غ» for a part missed, «—» while it is not in. */
export function cellText(t: Translate, value: number | 'absent' | null): string {
  if (value === null) return '—';
  return value === 'absent' ? t('marks.book.absent') : shownMark(value);
}

/** A part's value in a row. */
export function partValue(row: BookRow, part: AveragePart): number | 'absent' | null {
  if (part === 'T') return row.T;
  if (part === 'F') return row.F;
  if (part === 'E') return row.E;
  return part === 'P' ? row.P : row.O;
}

/** Primary's months under the pupil's name, such as «أكتوبر 8.00 · نوفمبر 6.00»; empty elsewhere. */
export function monthsLine(t: Translate, profile: CountryProfile, book: GradeBook, row: BookRow, term: number) {
  return book.months
    .map((month, index) => {
      const name = periodName(t, profile.months, { kind: 'component', componentId: '', month }, term);
      return `${name} ${cellText(t, row.months[index] ?? null)}`;
    })
    .join(' · ');
}

/** The rows by the list, or by the average, highest first, those with none after in list order. */
export function orderedRows(book: GradeBook, order: BookOrder): BookRow[] {
  if (order === 'list') return [...book.rows];
  return [...book.rows].sort((a, b) => {
    if (a.rank === null || b.rank === null) return a.rank === null ? (b.rank === null ? a.number - b.number : 1) : -1;
    return a.rank - b.rank || a.number - b.number;
  });
}

/** What a row reads to TalkBack: the number, the name, each part and the average. */
export function rowLabel(t: Translate, book: GradeBook, row: BookRow, name: string, months: string): string {
  const parts = book.parts.map((part) => `${partLabel(t, part)} ${cellText(t, partValue(row, part))}`);
  const average = book.formula === null ? [] : [`${t('marks.book.average')} ${cellText(t, row.average)}`];
  return [`${row.number}. ${isolate(name)}`, ...(months === '' ? [] : [months]), ...parts, ...average].join(
    t('marks.book.comma'),
  );
}

/** The class's figures, or that there is no average yet. */
export function figuresLine(t: Translate, book: GradeBook): string {
  const { mean, highest, lowest, reached, counted } = book.figures;
  if (mean === null || highest === null || lowest === null) return t('marks.book.noAverages');
  return t('marks.book.figures', {
    mean: shownMark(mean),
    highest: shownMark(highest),
    lowest: shownMark(lowest),
    threshold: book.threshold,
    reached,
    counted,
  });
}

/** The pupils shown at the threshold whose full value is below it, each as a line. */
export function atThresholdLines(t: Translate, book: GradeBook, nameOf: (pupilId: string) => string): string[] {
  return book.rows.flatMap((row) =>
    row.average !== null && shownAtThreshold(row.average, book.threshold)
      ? [
          t('marks.book.atThreshold', {
            name: isolate(nameOf(row.pupilId)),
            shown: shownMark(row.average),
            full: fullMark(row.average),
            threshold: book.threshold,
          }),
        ]
      : [],
  );
}

/** The formula with the pupil's values in full, such as «((12.726 + 10.25) ÷ 2 + 2 × 9.25) ÷ 3 = 9.996». */
export function formulaWith(t: Translate, book: GradeBook, row: BookRow): string | null {
  if (book.formula === null || row.average === null) return null;
  const full = (value: number | 'absent' | null) => (typeof value === 'number' ? fullMark(value) : '—');
  return t(FORMULA_LINES[book.formula.id] as 'marks.book.with.cem', {
    T: full(row.T),
    F: full(row.F),
    E: full(row.E),
    P: full(row.P),
    O: full(row.O),
    average: fullMark(row.average),
  });
}

/** Whether the average reaches the threshold, with the rank; or that it waits for its parts. */
export function verdictLine(t: Translate, book: GradeBook, row: BookRow): string {
  if (row.average === null || row.rank === null) return t('marks.book.value.none');
  const counts = { threshold: book.threshold, rank: row.rank, counted: book.figures.counted };
  return t(reaches(row.average, book.threshold) ? 'marks.book.value.reached' : 'marks.book.value.below', counts);
}
