// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A strip of a day's entries to cut out and paste into the paper texts book
// (#214, Print-strip, R-3.8-15), for schools that accept it: for each class
// and subject, the day's confirmed sessions at the book's column widths and
// line spacing, across the page's full width as the book's pages print,
// in a dashed box with crop marks above and below its corners, since
// nothing prints in the page's margins, in the subject's language and
// direction. Each piece
// says where it goes: the page the book's pages give it, after the rule the
// entries before it end on as written, counted on the safe side, or from
// the first rule of the next page when the day runs on to it. The
// signature column carries the drawn signature while it is in use (#236,
// answer 412), and is otherwise left blank, to sign by hand. There is no
// blank version: a strip is the entries.

import { compareDays, courseGrade, isJoint, type Day } from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { i18n, isLanguage, type Language } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { DocumentData, Translate } from './document-data';
import { documentSignature, drawnMark } from './drawn-mark';
import { escapeHtml, printDocument } from './print-html';
import { BOOK_COLUMNS, TEXTS_BOOK_CSS, entryRows } from './texts-book-html';
import { bookCourses, directionOf, subjectLanguage, wordsFor } from './texts-book-pages';
import { bookRows, pagesBefore, paginate, rowRules, type BookRow } from './texts-book-rows';

const CSS =
  TEXTS_BOOK_CSS +
  '.strip{margin:6mm 0 12mm;break-inside:avoid;page-break-inside:avoid}' +
  '.strip .cut{font-size:9.5pt;margin:0 0 7mm}' +
  '.strip .box{position:relative;border:.3mm dashed #000}.strip table.book{border:0}' +
  '.strip .m{position:absolute;width:0;height:5mm;border-left:.3mm solid #000}' +
  '.strip .tl{top:-6mm;left:-.3mm}.strip .tr{top:-6mm;right:-.3mm}' +
  '.strip .bl{bottom:-6mm;left:-.3mm}.strip .br{bottom:-6mm;right:-.3mm}';

/** One piece of the strip: a course's entries of the day that fall on one page of its book. */
interface Piece {
  readonly label: string;
  readonly lang: string;
  readonly textLang: string | undefined;
  readonly dir: 'rtl' | 'ltr';
  readonly rows: readonly BookRow[];
}

/** Whether any class and subject has a session confirmed on the day. */
export function stripEmpty(data: DocumentData): boolean {
  const context = coreContext(data);
  return bookCourses(data).every(({ course }) => {
    const dir = directionOf(wordsFor(subjectLanguage(data.profile, course.subject, data.lang), bookOf(data)));
    return bookRows(data, context, course, data.day, data.day, i18n.getFixedT(bookOf(data)), dir).length === 0;
  });
}

const bookOf = (data: DocumentData): Language =>
  isLanguage(data.profile.language) ? data.profile.language : data.lang;

function pieces(data: DocumentData): Piece[] {
  const context = coreContext(data);
  const book = bookOf(data);
  const day = data.day;
  const month = day.slice(0, 7);
  const first = `${month}-01` as Day;
  const from = compareDays(first, data.year.from) < 0 ? data.year.from : first;
  return bookCourses(data).flatMap(({ course, schoolClass }) => {
    const language = subjectLanguage(data.profile, course.subject, data.lang);
    const words = wordsFor(language, book);
    const dir = directionOf(words);
    const st = i18n.getFixedT(words);
    const rows = bookRows(data, context, course, from, day, st, dir);
    if (!rows.some((row) => row.day === day)) return [];
    const before = pagesBefore(data, context, course, month, st, dir);
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    const name = isolate(grade === undefined ? schoolClass.name : `${schoolClass.name} · ${yearShort(st, grade)}`);
    const subject = data.profile.subjects.find((one) => one.code === course.subject)?.name[words] ?? course.subject;
    return paginate(rows, dir).flatMap((page, index) => {
      const today = page.filter((row) => row.day === day);
      if (today.length === 0) return [];
      const used = page.filter((row) => row.day !== day).reduce((sum, row) => sum + rowRules(row, dir), 0);
      const where =
        used === 0
          ? st('documents.strip.from', { page: before + index + 1 })
          : st('documents.strip.after', { page: before + index + 1, rule: used });
      return [
        {
          label: `${name} · ${subject} · ${where}`,
          lang: words,
          textLang: language === words ? undefined : language,
          dir,
          rows: today,
        },
      ];
    });
  });
}

function pieceHtml(piece: Piece, mark: string): string {
  const latin = piece.dir === 'ltr' ? ' latin' : '';
  return (
    `<div class="strip"><p class="cut" lang="${escapeHtml(piece.lang)}" dir="${piece.dir}">✂ ${escapeHtml(piece.label)}</p>` +
    '<div class="box"><span class="m tl"></span><span class="m tr"></span><span class="m bl"></span><span class="m br"></span>' +
    `<table class="book${latin}" lang="${escapeHtml(piece.lang)}" dir="${piece.dir}">${BOOK_COLUMNS}` +
    `<tbody>${entryRows(piece.rows, piece.textLang, mark)}</tbody></table></div></div>`
  );
}

/** The whole document: the day's pieces, one after another on as many pages as they take. */
export function stripPages(data: DocumentData, t: Translate): string {
  const all = pieces(data);
  const mark = drawnMark(documentSignature(data, false));
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('documents.strip.name'),
    landscape: false,
    css: CSS,
    pages: [all.map((piece) => pieceHtml(piece, mark)).join('')],
  });
}
