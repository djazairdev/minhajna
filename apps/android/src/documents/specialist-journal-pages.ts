// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary specialist's daily journal (#216, PS-Journal, R-3.8-11): the
// French, English or Tamazight teacher's sessions of the day, from the record
// book, on A4 landscape pages in the subject's language and direction. A
// language the app does not speak yet, such as Tamazight's until its script is
// settled, keeps the book's words and direction.
// - One journal for all classes: a page for the day, with a band for each
//   school and half-day in the day's order, and a director's visa for each
//   school taught that day.
// - One journal per class: a page for each class with a session that day, with
//   its school's visa.
// Sessions follow the clock within a half-day, each school's own bells
// included, or the slots' order when a session of that half-day has no time.
// Each session gives its time from the school's bells, or its slot, the class
// with its level in a multigrade class, and the activity, content and domain as
// primary-cells.ts gives them; the competence indicator is left for the pen. A
// teacher of two such subjects in two languages gets each language's pages in
// turn, in the profile's order of subjects. The blank version gives a page with
// a morning and an afternoon band of empty rows, for all classes or for each.

import {
  clockMinutes,
  compareSlots,
  courseGrade,
  courseSetup,
  isJoint,
  todayView,
  type SchoolClass,
  type TodaySession,
} from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { i18n, isLanguage, type Language } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';
import { isolate, slotSpoken } from '../week/grid-labels';
import { dayTitle, yearShown, type DocumentData, type Translate } from './document-data';
import type { JournalLayout } from './journal-pages';
import { sessionCells } from './primary-cells';
import {
  BLANK_ROWS,
  PRIMARY_CSS,
  primaryPageHtml,
  type PrimaryBand,
  type PrimaryDay,
  type PrimaryEntry,
  type PrimaryTexts,
} from './primary-journal-html';
import { printDocument } from './print-html';
import { specialistCourses } from './specialists';
import { directionOf, subjectLanguage, wordsFor } from './texts-book-pages';
import { documentSignature, drawnMark } from './drawn-mark';

/** The columns: the time, the class, the activity, the content, the indicator, and the domain with the note. */
const WIDTHS = ['28mm', '24mm', '30mm', 'auto', '44mm', '38mm'];

const HALVES = ['morning', 'afternoon'] as const;

/** A specialist's journal for `data.day`, in each of their subjects' languages, or blank pages. */
export function specialistJournalPages(data: DocumentData, _t: Translate, blank: boolean, layout?: string): string {
  const context = coreContext(data);
  const perClass = (layout as JournalLayout | undefined) === 'per-class';
  const book: Language = isLanguage(data.profile.language) ? data.profile.language : data.lang;
  const courses = specialistCourses(data);
  const languageOf = (subject: string) => subjectLanguage(data.profile, subject, data.lang);
  const taught = data.profile.subjects.filter((one) => courses.some(({ course }) => course.subject === one.code));
  const languages = [...new Set(taught.map((one) => languageOf(one.code)))];
  const found = blank
    ? []
    : todayView(context, data.day).sessions.filter(
        (item) => item.status !== 'calendar' && courses.some(({ course }) => course.id === item.course.id),
      );
  const clocks = new Map(
    found.map((item) => {
      const school = data.state.schools.get(courseSetup(context, item.course.id).schoolClass.schoolId);
      const from = sessionTime(data, school, item.session.slot, item.session.day)?.from;
      return [item, from === undefined ? undefined : clockMinutes(from)] as const;
    }),
  );
  const timed = new Set(
    HALVES.filter((name) => found.every((item) => halfOf(item) !== name || clocks.get(item) !== undefined)),
  );
  const minutes = (item: TodaySession) => (timed.has(halfOf(item)) ? (clocks.get(item) ?? 0) : 0);
  const today = [...found].sort(
    (a, b) => (halfOf(a) === halfOf(b) ? minutes(a) - minutes(b) : 0) || compareSlots(a.session.slot, b.session.slot),
  );
  const pages = (
    language: string,
  ): { readonly texts: PrimaryTexts; readonly days: PrimaryDay[]; readonly none: PrimaryDay } => {
    const words = wordsFor(language, book);
    const dir = directionOf(isLanguage(language) ? language : book);
    const own: DocumentData = { ...data, lang: words, dir };
    const tl: Translate = i18n.getFixedT(words);
    const mine = courses.filter(({ course }) => languageOf(course.subject) === language);
    const sessions = today.filter((item) => mine.some(({ course }) => course.id === item.course.id));
    const schoolName = (schoolClass: SchoolClass) => {
      const name = data.state.schools.get(schoolClass.schoolId)?.name;
      return name === undefined ? '' : isolate(name);
    };
    const classOf = (item: TodaySession) => courseSetup(context, item.course.id).schoolClass;
    const half = (name: (typeof HALVES)[number]) => tl(`documents.primaryJournal.${name}`);
    const entry = (item: TodaySession): PrimaryEntry => {
      const { setup, ...cells } = sessionCells(own, tl, context, item);
      const school = data.state.schools.get(setup.schoolClass.schoolId);
      const time = sessionTime(data, school, item.session.slot, item.session.day);
      return {
        ...cells,
        when: time === null ? slotSpoken(tl, item.session.slot) : span(time.from, time.to, dir),
        what: isJoint(setup.schoolClass)
          ? `${isolate(setup.schoolClass.name)} · ${yearShort(tl, courseGrade(item.course, setup.schoolClass))}`
          : isolate(setup.schoolClass.name),
      };
    };
    const blankBands = HALVES.map((one) => ({ name: half(one), entries: [], blank: BLANK_ROWS[one] }));
    const title = blank ? '' : dayTitle(own, tl, data.day);
    const classes = [...new Map(mine.map(({ schoolClass }) => [schoolClass.id, schoolClass])).values()];
    const schools = [...new Set(classes.map(schoolName))];
    const days: PrimaryDay[] = perClass
      ? classes
          .filter((one) => blank || sessions.some((item) => item.course.classId === one.id))
          .map((one) => ({
            title,
            className: tl('documents.textsBook.className', { name: isolate(one.name) }),
            school: schoolName(one),
            bands: blank
              ? blankBands
              : HALVES.map((name) => ({
                  name: half(name),
                  entries: sessions
                    .filter((item) => item.course.classId === one.id && halfOf(item) === name)
                    .map(entry),
                })),
            visas: [schoolName(one)],
            book: `${language}/${one.id}`,
          }))
      : sessions.length > 0 || blank
        ? [
            {
              title,
              className: '',
              bands: blank ? blankBands : bandsOf(sessions, (item) => schoolName(classOf(item)), half, entry, tl),
              visas: blank ? schools : [...new Set(sessions.map((item) => schoolName(classOf(item))))],
              book: language,
            },
          ]
        : [];
    return {
      texts: {
        lang: words,
        dir,
        book: tl('documents.primaryJournal.name'),
        school: schools.filter(Boolean).join(' · '),
        year: tl('documents.year', { year: yearShown(data) }),
        heads: (['time', 'class', 'activity', 'content', 'indicator', 'domain'] as const).map((head) =>
          tl(`documents.primaryJournal.heads.${head}`),
        ),
        widths: WIDTHS,
        teacher: tl('documents.primaryJournal.teacher'),
        director: tl('documents.director'),
        empty: tl('documents.empty'),
        colon: tl('documents.journalLines.colon'),
        mark: drawnMark(documentSignature(data, blank)),
      },
      days,
      none: { title, className: '', bands: [], visas: [''] },
    };
  };
  const sets = (languages.length > 0 ? languages : [book]).map(pages);
  const days = sets.flatMap(({ texts, days }) =>
    days.map((day) => ({ day, html: wrapped(texts, primaryPageHtml(texts, day, blank)) })),
  );
  const html = days.map((one) => one.html);
  const first = sets[0];
  return printDocument({
    lang: first.texts.lang,
    dir: first.texts.dir,
    title: first.texts.book,
    landscape: true,
    css: PRIMARY_CSS,
    pages: html.length > 0 ? html : [wrapped(first.texts, primaryPageHtml(first.texts, first.none, false))],
    books: days.map((one) => one.day.book ?? ''),
  });
}

function halfOf(item: TodaySession): 'morning' | 'afternoon' {
  return item.session.slot.half === 'morning' ? 'morning' : 'afternoon';
}

/** The day's sessions in bands of one school and half-day each, in the day's order. */
function bandsOf(
  sessions: readonly TodaySession[],
  school: (item: TodaySession) => string,
  half: (name: 'morning' | 'afternoon') => string,
  entry: (item: TodaySession) => PrimaryEntry,
  t: Translate,
): PrimaryBand[] {
  const bands: { name: string; entries: PrimaryEntry[] }[] = [];
  let last = '';
  for (const item of sessions) {
    const name = t('documents.specialistJournal.band', { school: school(item), half: half(halfOf(item)) });
    if (name !== last) bands.push({ name, entries: [] });
    bands.at(-1)!.entries.push(entry(item));
    last = name;
  }
  return bands;
}

/** A page in its own language and direction, in the Latin face when it runs left to right. */
function wrapped(texts: PrimaryTexts, page: string): string {
  return `<div lang="${texts.lang}" dir="${texts.dir}"${texts.dir === 'ltr' ? ' class="latin"' : ''}>${page}</div>`;
}
