// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's homework page (#214, P67, R-3.8-19 to 22): for each
// class and subject taught this school year, every homework set, in the
// order it was set, with the day it was set, the day it comes back and the
// activity, then the two counts entered when it came back, each with its
// share of the class list. Counts not entered are left blank, as the
// teacher would leave them on paper; a count the list no longer holds
// prints without a share. Counts only, never names. The page is in the
// subject's language and direction, on the book's head; a subject with no
// homework gets the page blank, with its heads, and so does every subject
// in the blank version. A long activity wraps, and the rules it takes are
// counted, so a year of homework runs on to more pages.

import { courseGrade, homeworkPercent, homeworkRecord, isJoint, type HomeworkItem } from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { i18n, isLanguage, type Language } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';
import { TEXTS_BOOK_CSS, bookHead } from './texts-book-html';
import { bookCourses, directionOf, subjectLanguage, wordsFor } from './texts-book-pages';
import { ENTRY_FOOT, RULE, bookDate, byRules, rulesOf, wrappedRules, type Direction } from './texts-book-rows';

/** The rules a page holds below its head, its caption and its two rows of column heads. */
export const HOMEWORK_RULES = 26;
/** The characters a rule of the activity column holds in each direction, kept on the safe side. */
const ACTIVITY_CHARACTERS = { rtl: 28, ltr: 27 } as const;

interface HomeworkRow {
  readonly cells: readonly string[];
  /** The rules it wraps onto, and the share of one its ruled foot takes. */
  readonly rules: number;
}

const CSS =
  TEXTS_BOOK_CSS +
  'table.homework th{height:6.5mm;font-size:10pt}table.homework thead tr+tr th{font-size:9pt;font-weight:600}' +
  'table.homework td{text-align:center}table.homework td.what{text-align:start;overflow-wrap:anywhere}';

const COLUMNS =
  '<colgroup><col style="width:13.5%"><col style="width:12.5%"><col style="width:31%"><col style="width:10.75%">' +
  '<col style="width:10.75%"><col style="width:10.75%"><col style="width:10.75%"></colgroup>';

function homeworkRow(item: HomeworkItem, dir: Direction): HomeworkRow {
  const count = (value: number | undefined) => {
    if (value === undefined) return ['', ''];
    const percent = homeworkPercent(value, item.listed);
    return [String(value), percent === null ? '' : `${percent}%`];
  };
  return {
    cells: [
      bookDate(item.set, dir),
      bookDate(item.due, dir),
      item.text,
      ...count(item.count?.notDone),
      ...count(item.count?.reliedOn),
    ],
    rules: wrappedRules(item.text, ACTIVITY_CHARACTERS[dir]) + ENTRY_FOOT / RULE,
  };
}

function rowHtml(row: HomeworkRow, textLang: string | undefined): string {
  const cell = (text: string, index: number) =>
    index === 2
      ? `<td class="what">${textLang === undefined ? escapeHtml(text) : `<bdi dir="auto">${escapeHtml(text)}</bdi>`}</td>`
      : `<td${index < 2 ? ' class="when"' : ''}>${escapeHtml(text)}</td>`;
  return `<tr class="entry">${row.cells.map(cell).join('')}</tr>`;
}

/** The whole document: the homework page of each class and subject, as recorded or blank. */
export function homeworkPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const book: Language = isLanguage(data.profile.language) ? data.profile.language : data.lang;
  const bt = i18n.getFixedT(book);
  const pages = bookCourses(data).flatMap(({ course, schoolClass }) => {
    const language = subjectLanguage(data.profile, course.subject, data.lang);
    const words = wordsFor(language, book);
    const dir = directionOf(words);
    const st = i18n.getFixedT(words);
    const textLang = language === words ? undefined : language;
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    const name = (lang: Language) =>
      isolate(
        grade === undefined ? schoolClass.name : `${schoolClass.name} · ${yearShort(i18n.getFixedT(lang), grade)}`,
      );
    const subject = (lang: Language) =>
      data.profile.subjects.find((one) => one.code === course.subject)?.name[lang] ?? course.subject;
    const rows = blank ? [] : homeworkRecord(context, course.id).map((item) => homeworkRow(item, dir));
    const head = bookHead({
      lang: book,
      school: data.state.schools.get(schoolClass.schoolId)?.name ?? '',
      year: bt('documents.year', { year: yearShown(data) }),
      className: bt('documents.textsBook.className', { name: name(book) }),
      subject: bt('documents.textsBook.subject', { name: subject(book) }),
      title: bt('documents.homework.page'),
    });
    const heads = (['notDone', 'reliedOn'] as const)
      .map((column) => `<th colspan="2">${escapeHtml(st(`documents.homework.${column}`))}</th>`)
      .join('');
    const counts = `<th>${escapeHtml(st('documents.homework.number'))}</th><th>%</th>`.repeat(2);
    const latin = dir === 'ltr' ? ' latin' : '';
    return (rows.length === 0 ? [[]] : byRules(rows, HOMEWORK_RULES)).map(
      (page) =>
        head +
        `<p class="caption" lang="${escapeHtml(words)}" dir="${dir}">` +
        `${escapeHtml(st('documents.homework.caption', { className: name(words), subject: subject(words) }))}</p>` +
        `<p class="note" lang="${escapeHtml(words)}" dir="${dir}">${escapeHtml(st('documents.homework.sideNote'))}</p>` +
        `<table class="book homework${latin}" lang="${escapeHtml(words)}" dir="${dir}">${COLUMNS}<thead><tr>` +
        (['date', 'due', 'activity'] as const)
          .map((column) => `<th rowspan="2">${escapeHtml(st(`documents.homework.${column}`))}</th>`)
          .join('') +
        `${heads}</tr><tr>${counts}</tr></thead><tbody>` +
        page.map((row) => rowHtml(row, textLang)).join('') +
        '<tr class="rule"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(
          Math.max(0, Math.floor(HOMEWORK_RULES - rulesOf(page))),
        ) +
        '</tbody></table>',
    );
  });
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('documents.homework.name'),
    landscape: false,
    css: CSS,
    pages,
  });
}
