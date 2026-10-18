// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's rows (#213, PRD §3.8, R-3.8-14): for one course, each
// confirmed session as the book takes it, in the subject's language; a
// session awaiting confirmation never prints (R-2.3-14). The date is
// Gregorian with Western digits (R-3.8-59), year first on a right-to-left
// page as the book is written by hand; the time comes from the school's
// bells, Ramadan's when the day falls then, so a shortened session prints
// its real length (R-4.5-14), and is written as by hand too, «08سا – 09سا».
// Each month starts a page, and the pages of a course are numbered from the
// school year's first, so a month printed later carries on where the one
// before stopped.

import {
  courseSetup,
  current,
  formatTextsBookDay,
  sessionsBetween,
  type Context,
  type Course,
  type Day,
  type PlanPack,
  type School,
  type Session,
  type SessionRecord,
} from '@minhajna/core';
import { bookClock, bookLines, type BookLine } from '../entry/book-lines';
import { sessionTime } from '../times/times-rules';
import { span } from '../times/TimeTable';
import type { DocumentData, Translate } from './document-data';

/** The rules a page holds below its head, and the characters a rule holds in each direction, kept on the safe side. */
export const PAGE_RULES = 28;
const RULE_CHARACTERS = { rtl: 44, ltr: 46 } as const;
/** An entry's ruled foot, in millimetres, on top of its rules of 7.3 mm. */
export const ENTRY_FOOT = 0.3;
export const RULE = 7.3;

export type Direction = 'rtl' | 'ltr';

export interface BookRow {
  /** The session's key, for the book's pages in the app to open it. */
  readonly key: string;
  readonly day: Day;
  readonly date: string;
  readonly time: string;
  readonly lines: readonly BookLine[];
}

/** A day as the book writes it: 2026/10/01 on a right-to-left page, 01/10/2026 on a left-to-right one. */
export function bookDate(day: Day, dir: Direction): string {
  return dir === 'rtl' ? formatTextsBookDay(day) : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/** The rules a text wraps onto, word by word as the web engine wraps it; a word longer than a rule breaks. */
export function wrappedRules(text: string, room: number): number {
  let rules = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    if (used > 0 && used + 1 + word.length <= room) {
      used += 1 + word.length;
      continue;
    }
    if (used > 0) rules += 1;
    rules += Math.ceil(word.length / room) - 1;
    used = word.length % room || room;
  }
  return rules;
}

/** The rules a row takes: each line wraps onto as many as its words need. */
export function rowRules(row: Pick<BookRow, 'lines'>, dir: Direction): number {
  const room = RULE_CHARACTERS[dir];
  return (
    row.lines.reduce(
      (sum, line) => sum + wrappedRules(line.label === undefined ? line.text : `${line.label}: ${line.text}`, room),
      0,
    ) || 1
  );
}

/** The rules a page's rows take, their ruled feet included. */
export function pageRules(rows: readonly Pick<BookRow, 'lines'>[], dir: Direction): number {
  return rows.reduce((sum, row) => sum + rowRules(row, dir), 0) + Math.ceil((rows.length * ENTRY_FOOT) / RULE);
}

/** The rows in pages of at most `PAGE_RULES` rules; a row longer than a page has one to itself. */
export function paginate<Row extends Pick<BookRow, 'lines'>>(rows: readonly Row[], dir: Direction): Row[][] {
  const pages: Row[][] = [];
  let page: Row[] = [];
  for (const row of rows) {
    if (page.length > 0 && pageRules([...page, row], dir) > PAGE_RULES) {
      pages.push(page);
      page = [];
    }
    page.push(row);
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

/** A session's row as the book takes it, from its record or from what confirming it would record. */
export function bookRow(
  data: Pick<DocumentData, 'bells' | 'calendar' | 'state'>,
  where: { readonly school: School | undefined; readonly pack: PlanPack | null },
  session: Session,
  record: SessionRecord,
  t: Translate,
  dir: Direction,
): BookRow {
  const time = sessionTime(data, where.school, session.slot, session.day);
  return {
    key: session.key,
    day: session.day,
    date: bookDate(session.day, dir),
    time: time === null ? '' : span(bookClock(time.from, t), bookClock(time.to, t), dir),
    lines: bookLines(t, where.pack, record, (day) => bookDate(day, dir)),
  };
}

/** The course's confirmed sessions from `from` to `to`, as the book's rows. */
export function bookRows(
  data: DocumentData,
  context: Context,
  course: Course,
  from: Day,
  to: Day,
  t: Translate,
  dir: Direction,
): BookRow[] {
  const { state } = data;
  const pack = courseSetup(context, course.id).pack;
  const schoolClass = state.classes.get(course.classId);
  const school = schoolClass && state.schools.get(schoolClass.schoolId);
  return sessionsBetween(context, from, to, new Set([course.id])).flatMap((session) => {
    const record = current(state.sessions.get(session.key));
    return record === null ? [] : [bookRow(data, { school, pack }, session, record, t, dir)];
  });
}

/** The pages a course's confirmed sessions fill from the year's first day to the day before `month` starts. */
export function pagesBefore(
  data: DocumentData,
  context: Context,
  course: Course,
  month: string,
  t: Translate,
  dir: Direction,
): number {
  const rows = bookRows(data, context, course, data.year.from, `${month}-01` as Day, t, dir).filter(
    (row) => row.day < `${month}-01`,
  );
  const months = new Map<string, BookRow[]>();
  for (const row of rows) months.set(row.day.slice(0, 7), [...(months.get(row.day.slice(0, 7)) ?? []), row]);
  return [...months.values()].reduce((sum, monthRows) => sum + paginate(monthRows, dir).length, 0);
}

/** The rules rows take together. */
export const rulesOf = (rows: readonly { readonly rules: number }[]) => rows.reduce((sum, row) => sum + row.rules, 0);

/** Rows in pages of at most `max` rules; a row never breaks across pages. */
export function byRules<Row extends { readonly rules: number }>(rows: readonly Row[], max: number): Row[][] {
  const pages: Row[][] = [];
  let page: Row[] = [];
  for (const row of rows) {
    if (page.length > 0 && rulesOf(page) + row.rules > max) {
      pages.push(page);
      page = [];
    }
    page.push(row);
  }
  if (page.length > 0) pages.push(page);
  return pages;
}
