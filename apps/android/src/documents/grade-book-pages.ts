// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «كشف النقاط» among the documents (#240, Gradebook-print, answers 461 and
// 462): the term holding the chosen day, or between terms the one just ended,
// and a page for each class and subject with a grade book, by class name, then
// subject's name; or one class and subject's page,
// from the grade-book screen. Each page carries its formula, its months in
// primary, its parts in two decimals and the class's figures, or only the
// numbers and names when blank. The drawn signature goes in the teacher's
// box of a middle-school page only, never on a blank one.

import { compareDays, courseGrade, gradeBook, isJoint, type GradeBook } from '@minhajna/core';
import { subjectName } from '../extra/extra-rules';
import { cellText, figuresLine, partLabel, partValue } from '../marks/book-rules';
import { periodName } from '../marks/component-rules';
import { assessmentData, formulaText, termWord } from '../marks/marks-rules';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import type { DocumentKind } from './catalogue';
import { schoolNames, yearLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { documentSignature, drawnMark } from './drawn-mark';
import { gradeBookHtml, type BookSheet } from './grade-book-html';

/** The term the documents' day falls in; between terms the one just ended, and before them the first. */
export function bookTerm(data: Pick<DocumentData, 'year' | 'day'>): number {
  const terms = [...data.year.terms].sort((a, b) => compareDays(a.from, b.from));
  const holding = terms.find((term) => compareDays(term.from, data.day) <= 0 && compareDays(data.day, term.to) <= 0);
  const ended = terms.filter((term) => compareDays(term.to, data.day) < 0).at(-1);
  return (holding ?? ended ?? terms[0])?.number ?? 1;
}

/** The courses with a grade book in the term, by class name, then subject, each with its book. */
export function bookCourses(
  data: DocumentData,
  term: number,
): { readonly courseId: string; readonly book: GradeBook }[] {
  const assessment = assessmentData(data.profile);
  if (assessment === null) return [];
  const context = coreContext(data);
  const { state } = data;
  const named = (classId: string) => state.classes.get(classId)?.name ?? '';
  const subject = (code: string) => subjectName(data.profile, code);
  return [...state.courses.values()]
    .sort(
      (a, b) =>
        named(a.classId).localeCompare(named(b.classId), 'ar') ||
        subject(a.subject).localeCompare(subject(b.subject), 'ar'),
    )
    .flatMap((course) => {
      const book = gradeBook(context, assessment, course.id, term);
      return book === null ? [] : [{ courseId: course.id, book }];
    });
}

/** One class and subject's page. */
function sheetOf(data: DocumentData, t: Translate, courseId: string, book: GradeBook, term: number, blank: boolean) {
  const { state, profile } = data;
  const course = state.courses.get(courseId)!;
  const room = state.classes.get(course.classId)!;
  const className = isJoint(room) ? `${room.name} · ${yearShort(t, courseGrade(course, room))}` : room.name;
  const subject = subjectName(profile, course.subject);
  const months = book.months.map((month) =>
    periodName(t, profile.months, { kind: 'component', componentId: '', month }, term),
  );
  const averaged = book.formula !== null;
  const heads = [
    ...months,
    ...book.parts.map((part) => partLabel(t, part)),
    ...(averaged ? [t('marks.book.average')] : []),
  ];
  const release = assessmentData(profile)?.release ?? '';
  return {
    book: `${className} · ${subject}`,
    scope: t('documents.gradeBook.scope', { class: className, subject, term: termWord(t, term) }),
    formula: t('documents.gradeBook.formula', {
      formula:
        book.formula === null
          ? t('marks.formula.none')
          : `${t('marks.book.average')} = ${formulaText(t, book.formula)}`,
      scale: book.scale,
      release,
    }),
    heads,
    rows: book.rows.map((row) => ({
      number: row.number,
      name: state.pupils.get(row.pupilId)?.name ?? '',
      cells: blank
        ? heads.map(() => '')
        : [
            ...row.months.map((value) => cellText(t, value)),
            ...book.parts.map((part) => cellText(t, partValue(row, part))),
            ...(averaged ? [cellText(t, row.average)] : []),
          ],
    })),
    figures: blank || !averaged ? '' : figuresLine(t, book),
    mark: room.level === 'cem' ? drawnMark(documentSignature(data, blank)) : '',
  } satisfies BookSheet;
}

/** The grade books of the day's term, or of the term and course given, as HTML, recorded or blank. */
export function gradeBookPages(
  data: DocumentData,
  t: Translate,
  blank: boolean,
  one?: { readonly courseId: string; readonly term: number },
): string {
  const term = one?.term ?? bookTerm(data);
  const courses = bookCourses(data, term).filter((course) => one === undefined || course.courseId === one.courseId);
  return gradeBookHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('documents.gradeBook.name'),
      schools: schoolNames(data),
      year: yearShown(data),
      heading: t('documents.gradeBook.heading'),
      number: t('documents.number'),
      name: t('documents.name'),
      teacher: t('documents.teacher'),
      director: t('documents.director'),
      date: t('rollPrint.date'),
      confidential: t('documents.confidential'),
    },
    courses.map(({ courseId, book }) => sheetOf(data, t, courseId, book, term, blank)),
  );
}

export const BOOK_KIND: DocumentKind = {
  id: 'grade-book',
  drawn: 'box',
  icon: 'pupils',
  pupils: true,
  landscape: false,
  empty: (data) => bookCourses(data, bookTerm(data)).length === 0,
  period: (data) => `term-${bookTerm(data)}`,
  fileTitle: (data, t) => `${termWord(t, bookTerm(data))} ${yearLabel(data)}`,
  title: (t) => t('documents.gradeBook.name'),
  line: (data, t) => {
    const term = bookTerm(data);
    const classes = new Set(bookCourses(data, term).map(({ courseId }) => data.state.courses.get(courseId)?.classId));
    return `${t('documents.list.classes', { count: classes.size })} · ${termWord(t, term)}`;
  },
  blankLine: (t) => t('documents.output.blankGradeBook'),
  signatureLine: (t) => t('documents.output.signatureGradeBook'),
  emptyLine: (t) => t('documents.output.noGradeBook'),
  byDay: true,
  pages: (data, t, blank) => gradeBookPages(data, t, blank),
};
