// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's subject pages for a month (#213, PRD §3.8): for each
// class and subject the teacher teaches, its confirmed sessions of the
// month, page after page. The head is in the book's language, the profile's;
// the columns and the rows in the subject's, with its direction (R-3.1-18,
// R-3.8-63). A subject whose language the app does not speak yet, such as
// German, keeps the book's words and direction, each line of its own text
// running in its own. The blank version gives each class and subject a page
// with its head filled and its rules empty.

import {
  addDays,
  courseGrade,
  isJoint,
  type Course,
  type CountryProfile,
  type Day,
  type SchoolClass,
} from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { i18n, isLanguage, type Language } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { taughtClasses, yearLabel, type DocumentData, type Translate } from './document-data';
import { printDocument } from './print-html';
import { TEXTS_BOOK_CSS, textsBookPage, type TextsBookPage } from './texts-book-html';
import { bookRows, pageRules, pagesBefore, paginate, type Direction } from './texts-book-rows';

const RIGHT_TO_LEFT = new Set(['ar', 'fa', 'he', 'ur', 'ckb']);

/** The language a subject is taught in: its own, or the profile's; the interface's for an older profile. */
export function subjectLanguage(profile: CountryProfile, subject: string, fallback: Language): string {
  return profile.subjects.find((one) => one.code === subject)?.language ?? profile.language ?? fallback;
}

export function directionOf(language: string): Direction {
  return RIGHT_TO_LEFT.has(language) ? 'rtl' : 'ltr';
}

/** The catalogue that writes a language's words: its own, or else the book's. */
function wordsFor(language: string, book: Language): Language {
  return isLanguage(language) ? language : book;
}

/** Each taught course of the school year, by class as the Classes tab lists them, then by subject. */
export function bookCourses(data: DocumentData): { readonly course: Course; readonly schoolClass: SchoolClass }[] {
  return taughtClasses(data).flatMap((schoolClass) =>
    [...data.state.courses.values()]
      .filter((course) => course.classId === schoolClass.id && course.year === data.year.id)
      .sort((a, b) => `${a.subject}/${a.grade ?? ''}`.localeCompare(`${b.subject}/${b.grade ?? ''}`))
      .map((course) => ({ course, schoolClass })),
  );
}

function monthName(data: DocumentData, month: string, language: Language): string {
  const name = data.profile.months?.[Number(month.slice(5, 7)) - 1]?.[language] ?? month.slice(5, 7);
  return `${name} ${month.slice(0, 4)}`;
}

/** The whole document: the month of `data.day`, as recorded or blank. */
export function textsBookPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const month = data.day.slice(0, 7);
  const first = `${month}-01` as Day;
  const from = first < data.year.from ? data.year.from : first;
  const end = addDays(`${addDays(first, 31).slice(0, 7)}-01` as Day, -1);
  const to = end > data.year.to ? data.year.to : end;
  const book: Language = isLanguage(data.profile.language) ? data.profile.language : data.lang;
  const bookT = i18n.getFixedT(book);
  const pages: string[] = [];
  const empty: string[] = [];
  for (const { course, schoolClass } of bookCourses(data)) {
    const language = subjectLanguage(data.profile, course.subject, data.lang);
    const words = wordsFor(language, book);
    const dir = directionOf(words);
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    const st = i18n.getFixedT(words);
    const subject = data.profile.subjects.find((one) => one.code === course.subject);
    const name = (lang: Language) =>
      isolate(
        [schoolClass.name, grade === undefined ? null : yearShort(i18n.getFixedT(lang), grade)]
          .filter((part) => part !== null)
          .join(' · '),
      );
    const school = data.state.schools.get(schoolClass.schoolId)?.name ?? '';
    const pageOf = (number: number | null, rows: TextsBookPage['rows'], used: number, note?: string) =>
      textsBookPage({
        head: {
          lang: book,
          school,
          year: bookT('documents.year', { year: yearLabel(data) }),
          className: bookT('documents.textsBook.className', { name: name(book) }),
          subject: bookT('documents.textsBook.subject', { name: subject?.name[book] ?? course.subject }),
          title:
            number === null
              ? bookT('documents.textsBook.blankTitle')
              : bookT('documents.textsBook.title', { page: number }),
        },
        lang: words,
        ...(language !== words && { textLang: language }),
        dir,
        caption: st('documents.textsBook.caption', {
          className: name(words),
          subject: subject?.name[words] ?? course.subject,
          month: monthName(data, month, words),
        }),
        columns: [
          st('documents.textsBook.date'),
          st('documents.textsBook.time'),
          st('documents.textsBook.topic'),
          st('documents.textsBook.signature'),
        ],
        rows,
        used,
        ...(note !== undefined && { note }),
      });
    if (blank) {
      pages.push(pageOf(null, null, 0));
      continue;
    }
    const rows = bookRows(data, context, course, from, to, st, dir);
    if (rows.length === 0) {
      empty.push(pageOf(null, [], 0, st('documents.textsBook.none')));
      continue;
    }
    const before = pagesBefore(data, context, course, month, st, dir);
    paginate(rows, dir).forEach((page, index) => {
      pages.push(pageOf(before + index + 1, page, pageRules(page, dir)));
    });
  }
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('documents.textsBook.name'),
    landscape: false,
    css: TEXTS_BOOK_CSS,
    pages: pages.length > 0 ? pages : empty,
  });
}
