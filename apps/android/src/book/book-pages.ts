// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's pages as the app shows them (#213, P09, P10): one
// course's pages through the school year, numbered as they print, each
// month starting a page. A session awaiting confirmation, up to today,
// shows on the page of its month in what confirming it as proposed would
// record, so the teacher sees the row before the book takes it; it never
// counts towards the printed pages or their numbers, and a month of
// awaiting sessions only is named by its month alone (R-2.3-14). The awaiting sessions are
// worked out together, each as if those before it were confirmed as
// proposed, in one pass over the year. A course of another school year has
// no pages here, as it has none in print. A class reshaped after
// reorientation opens its first confirmed row with the reshaping, as in
// print (#231).

import {
  compareDays,
  confirmSessions,
  courseSetup,
  current,
  recordPack,
  sessionsBetween,
  type Context,
  type Course,
  type Day,
  type Session,
} from '@minhajna/core';
import type { DocumentData, Translate } from '../documents/document-data';
import { bookRow, paginate, withReshape, type BookRow, type Direction } from '../documents/texts-book-rows';

export interface ViewRow extends BookRow {
  readonly session: Session;
  readonly awaiting: boolean;
  /** Awaiting, with a lesson proposed, so one tap can confirm it as proposed. */
  readonly proposed: boolean;
}

export interface ViewPage {
  /** The page's number in the year, as it prints; null on a page of awaiting sessions only, which prints none yet. */
  readonly number: number | null;
  /** yyyy-mm. */
  readonly month: string;
  readonly rows: readonly ViewRow[];
}

const monthAfter = (month: string): string => {
  const [year, number] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
};

/** The course's pages from the school year's first day to `today`. */
export function bookViewPages(
  data: DocumentData,
  context: Context,
  course: Course,
  t: Translate,
  dir: Direction,
  today: Day,
): ViewPage[] {
  const last = compareDays(today, data.year.to) < 0 ? today : data.year.to;
  if (compareDays(last, data.year.from) < 0 || course.year !== data.year.id) return [];
  const pack = courseSetup(context, course.id).pack;
  const schoolClass = data.state.classes.get(course.classId);
  const where = { school: schoolClass && data.state.schools.get(schoolClass.schoolId), pack };
  const sessions = sessionsBetween(context, data.year.from, last, new Set([course.id]));
  const awaited = sessions.filter(
    (session) => session.calendar === null && current(data.state.sessions.get(session.key)) === null,
  );
  const previews = new Map(
    confirmSessions(
      context,
      awaited.map((session) => ({ session })),
    ).flatMap((event) =>
      event.kind === 'session.recorded' ? [[event.record.session.key, event.record] as const] : [],
    ),
  );
  const rows = sessions.flatMap((session): ViewRow[] => {
    const record = current(data.state.sessions.get(session.key));
    if (record !== null) {
      const own = { ...where, pack: recordPack(context, record) };
      return [{ ...bookRow(data, own, session, record, t, dir), session, awaiting: false, proposed: false }];
    }
    const preview = previews.get(session.key);
    if (preview === undefined) return [];
    const proposed = preview.coverage.length > 0;
    return [{ ...bookRow(data, where, session, preview, t, dir), session, awaiting: true, proposed }];
  });
  const order = new Map(rows.map((row, index) => [row.key, index]));
  const shown = withReshape(rows, (row) => !row.awaiting && row.session.courseId === course.id, course, t, dir);
  const pages: ViewPage[] = [];
  let numbered = 0;
  for (let month = data.year.from.slice(0, 7); month <= last.slice(0, 7); month = monthAfter(month)) {
    const inMonth = shown.filter((row) => row.day.startsWith(month));
    const printed = paginate(
      inMonth.filter((row) => !row.awaiting),
      dir,
    );
    const first = numbered + 1;
    numbered += printed.length;
    const awaiting = inMonth.filter((row) => row.awaiting);
    if (printed.length === 0 && awaiting.length === 0) continue;
    const monthPages = (printed.length === 0 ? [[]] : printed).map((page, index) => ({
      number: printed.length === 0 ? null : first + index,
      month,
      rows: [...page] as ViewRow[],
    }));
    for (const row of awaiting) {
      const page = monthPages.find((one) => one.rows.some((other) => compareDays(other.day, row.day) > 0));
      (page ?? monthPages[monthPages.length - 1])?.rows.push(row);
    }
    for (const page of monthPages) {
      page.rows.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
      pages.push(page);
    }
  }
  return pages;
}
