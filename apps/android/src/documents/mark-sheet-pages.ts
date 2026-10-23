// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «كشف النقاط والتقديرات» for a class, subject and term (#242, Marks-sheet,
// answer 466), from its term export: the school of the class and the school
// year, the class, subject, term and teacher, then each pupil in the grid's
// order with their parts and average in two decimals, «غ» for a part missed,
// and the appreciation chosen. The drawn signature goes in the teacher's box of
// a middle-school page only, as on the grade book (answer 462).

import { courseGrade, isJoint, type TermExport } from '@minhajna/core';
import { subjectName } from '../extra/extra-rules';
import { cellText, partLabel } from '../marks/book-rules';
import { termWord } from '../marks/marks-rules';
import { yearShort } from '../setup/names';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { documentSignature, drawnMark } from './drawn-mark';
import { isolate } from '../week/grid-labels';
import { markSheetHtml } from './mark-sheet-html';

/** The mark sheet of a course's term export as HTML. */
export function markSheetPages(
  data: DocumentData,
  t: Translate,
  courseId: string,
  term: number,
  sheet: TermExport,
): string {
  const { state, profile } = data;
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  const className =
    room === undefined || course === undefined
      ? ''
      : isJoint(room)
        ? `${room.name} · ${yearShort(t, courseGrade(course, room))}`
        : room.name;
  const subject = course === undefined ? '' : subjectName(profile, course.subject);
  const teacher = state.personal?.name?.trim() ?? '';
  const where = { class: className, subject, term: termWord(t, term) };
  const scope =
    teacher === ''
      ? t('documents.markSheet.scope', where)
      : t('documents.markSheet.scopeNamed', { ...where, teacher: isolate(teacher) });
  return markSheetHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('documents.markSheet.name'),
      school: state.schools.get(room?.schoolId ?? '')?.name ?? '',
      year: yearShown(data),
      heading: t('documents.markSheet.heading'),
      number: t('documents.number'),
      name: t('documents.name'),
      appreciation: t('documents.markSheet.appreciation'),
      teacher: t('documents.teacher'),
      date: t('rollPrint.date'),
      confidential: t('documents.confidential'),
    },
    {
      book: `${className} · ${subject}`,
      scope,
      heads: [...sheet.parts.map((part) => partLabel(t, part)), ...(sheet.averaged ? [t('marks.book.average')] : [])],
      rows: sheet.rows.map((row) => ({
        number: row.number,
        name: state.pupils.get(row.pupilId)?.name ?? '',
        cells: [
          ...sheet.parts.map((part) => cellText(t, row.values[part] ?? null)),
          ...(sheet.averaged ? [cellText(t, row.average)] : []),
        ],
        appreciation: row.appreciation ?? '',
      })),
      mark: room?.level === 'cem' ? drawnMark(documentSignature(data, false)) : '',
    },
  );
}
