// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's page 08, for supervised or additional lessons (#213,
// Decision 835 of 13/09/1991, R-3.8-26): for each class taught this school
// year, every session logged outside the timetable and every session of a
// support or revision day, numbered in order through the year, with its
// subject, its kind, its date and its time (R-3.3-18). It is in the book's
// language, Arabic, right to left, on the book's head. A class with no such
// session gets the page blank, with its heads (R-3.8-29); so does every
// class in the blank version. Rows never break across pages, and a year
// with more rows than a page holds runs on to another. A long subject name
// wraps rather than being cut, and the rules it takes are counted.

import {
  courseGrade,
  isJoint,
  supervisedRows,
  type Context,
  type SchoolClass,
  type SupervisedRow,
} from '@minhajna/core';
import { supportRows } from '../extra/add-sessions-rules';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { i18n, isLanguage, type Language } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { yearLabel, type DocumentData, type Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';
import { span } from '../times/TimeTable';
import { bookClasses } from './texts-book-pages';
import { TEXTS_BOOK_CSS, bookHead } from './texts-book-html';
import { bookClock } from '../entry/book-lines';
import { bookDate, wrappedRules } from './texts-book-rows';

/** The rules a page holds below its head, its title and its column heads, and the characters of a subject's rule. */
export const SUPERVISED_RULES = 24;
const SUBJECT_CHARACTERS = 30;

interface LessonRow {
  readonly cells: readonly string[];
  readonly rules: number;
}

const CSS =
  TEXTS_BOOK_CSS +
  '.lessons-title{text-align:center;font-family:Ruqaa,Naskh,serif;font-weight:700;font-size:15pt;margin:1mm 0 2mm}' +
  '.lessons-title sup{font-family:Naskh,serif;font-size:8pt}' +
  'table.lessons td{text-align:center;height:7mm;border-bottom:.3mm solid #9a9a9a;line-height:7mm;white-space:nowrap}' +
  'table.lessons td.subject{text-align:start;white-space:normal}' +
  '.lessons-note{font-size:9.5pt;margin:2mm 0 0}';

const COLUMNS =
  '<colgroup><col style="width:7%"><col style="width:33%"><col style="width:18%"><col style="width:19%"><col style="width:23%"></colgroup>';

/** A class's rows for the year: its sessions outside the timetable and those of support and revision days. */
export function lessonRows(data: DocumentData, context: Context, schoolClass: SchoolClass): SupervisedRow[] {
  return supervisedRows(data.state, schoolClass.id, data.year.id, supportRows(data, context));
}

function lessonRow(data: DocumentData, row: SupervisedRow, t: Translate, book: Language): LessonRow {
  const schoolClass = data.state.classes.get(row.course.classId);
  const grade = schoolClass !== undefined && isJoint(schoolClass) ? courseGrade(row.course, schoolClass) : undefined;
  const name = data.profile.subjects.find((one) => one.code === row.course.subject)?.name[book] ?? row.course.subject;
  const subject = grade === undefined ? name : `${name} · ${isolate(yearShort(t, grade))}`;
  const time = span(bookClock(row.from, t), bookClock(row.to, t), 'rtl');
  const cells = [String(row.number), subject, t(`extra.kinds.${row.kind}`), bookDate(row.day, 'rtl'), time];
  return { cells, rules: wrappedRules(subject, SUBJECT_CHARACTERS) };
}

function rowHtml(row: LessonRow): string {
  return `<tr>${row.cells.map((cell, index) => `<td${index === 1 ? ' class="subject"' : ''}>${escapeHtml(cell)}</td>`).join('')}</tr>`;
}

/** The whole document: page 08 of each class's book, as recorded or blank. */
export function supervisedPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const book: Language = isLanguage(data.profile.language) ? data.profile.language : data.lang;
  const bt = i18n.getFixedT(book);
  const pages = bookClasses(data).flatMap((schoolClass) => {
    const rows = blank ? [] : lessonRows(data, context, schoolClass).map((row) => lessonRow(data, row, bt, book));
    const chunks = rows.length === 0 ? [[]] : byRules(rows);
    const head = bookHead({
      lang: book,
      school: data.state.schools.get(schoolClass.schoolId)?.name ?? '',
      year: bt('documents.year', { year: yearLabel(data) }),
      className: bt('documents.textsBook.className', { name: isolate(schoolClass.name) }),
      title: bt('documents.supervised.page'),
    });
    return chunks.map(
      (page) =>
        head +
        `<div class="lessons-title" lang="${escapeHtml(book)}" dir="rtl">${escapeHtml(bt('documents.supervised.title'))}<sup>(1)</sup></div>` +
        `<table class="book lessons" lang="${escapeHtml(book)}" dir="rtl">${COLUMNS}<thead><tr>` +
        (['number', 'subject', 'kind', 'date', 'time'] as const)
          .map((column) => `<th>${escapeHtml(bt(`documents.supervised.${column}`))}</th>`)
          .join('') +
        '</tr></thead><tbody>' +
        page.map(rowHtml).join('') +
        '<tr><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(Math.max(0, SUPERVISED_RULES - rulesOf(page))) +
        '</tbody></table>' +
        `<p class="lessons-note" lang="${escapeHtml(book)}" dir="rtl">${escapeHtml(bt('documents.supervised.note'))}</p>`,
    );
  });
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('documents.supervised.name'),
    landscape: false,
    css: CSS,
    pages,
  });
}

const rulesOf = (rows: readonly LessonRow[]) => rows.reduce((sum, row) => sum + row.rules, 0);

/** The rows in pages of at most `SUPERVISED_RULES` rules. */
function byRules(rows: readonly LessonRow[]): LessonRow[][] {
  const pages: LessonRow[][] = [];
  let page: LessonRow[] = [];
  for (const row of rows) {
    if (page.length > 0 && rulesOf(page) + row.rules > SUPERVISED_RULES) {
      pages.push(page);
      page = [];
    }
    page.push(row);
  }
  if (page.length > 0) pages.push(page);
  return pages;
}
