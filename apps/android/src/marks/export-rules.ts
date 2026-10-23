// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «التصدير الفصلي» says (#242, Export, answer 466): the term's export,
// none for a term observations replace or while the list of appreciations is
// refused; the parts' names, «التقويم والفرض والاختبار»; what is complete or
// still missing, by count; the hub's line; the school whose route it is; and
// each pupil's values for the ostad grid, as the register shows them.

import {
  shownMark,
  termExport,
  type AveragePart,
  type Context,
  type CountryProfile,
  type ExportValue,
  type GradeBook,
  type School,
  type State,
  type TermExport,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { appreciationList } from './appreciation-rules';
import { assessmentData } from './marks-rules';

type Translate = ReturnType<typeof useText>;

export const PART_TEXTS: Readonly<Record<AveragePart, string>> = {
  T: 'marks.book.T',
  F: 'marks.book.F',
  E: 'marks.book.E',
  P: 'marks.book.P',
  O: 'marks.book.O',
};

/** A part's name, «الفرض». */
export function partName(t: Translate, part: AveragePart): string {
  return t(PART_TEXTS[part] as 'marks.book.T');
}

/** A course's term export; null without the files it needs, without a grade book, or for an observed term. */
export function courseExport(
  context: Context,
  profile: CountryProfile,
  courseId: string,
  term: number,
  book?: GradeBook | null,
): TermExport | null {
  const data = assessmentData(profile);
  if (data === null || appreciationList(profile) === null) return null;
  return termExport(context, data, courseId, term, book);
}

/** The school the course's class belongs to. */
export function courseSchool(state: State, courseId: string): School | undefined {
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  return state.schools.get(room?.schoolId ?? '');
}

/** The hub's line: ready, or how many marks and appreciations are missing. */
export function exportLine(t: Translate, sheet: TermExport): string {
  if (sheet.ready) return t('marks.export.ready');
  if (sheet.rows.length === 0) return t('marks.export.noPupils');
  return t('marks.export.missing', {
    marks: sheet.missingMarks.length,
    appreciations: sheet.missingAppreciations.length,
  });
}

/** The marks line: complete, with the parts' names, or how many cells and pupils are short. */
export function marksLine(t: Translate, sheet: TermExport): string {
  if (sheet.missingMarks.length === 0) {
    return t('marks.export.marksDone', {
      parts: sheet.parts.map((part) => partName(t, part)).join(t('marks.export.and')),
    });
  }
  const pupils = new Set(sheet.missingMarks.map((one) => one.pupilId)).size;
  return t('marks.export.marksMissing', { count: sheet.missingMarks.length, pupils, total: sheet.rows.length });
}

/** A value as the ostad view shows it: two decimals, or the absence's word. */
export function ostadValue(t: Translate, value: ExportValue): string {
  return value === null ? '—' : value === 'absent' ? t('marks.export.absent') : shownMark(value);
}
