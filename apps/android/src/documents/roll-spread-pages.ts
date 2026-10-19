// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's monthly spread from the record book (#217,
// Roll-print, answers 253, 258, 260 and 261), for one book or every one: a
// book is a class and the group its courses are taught to, the year's in a
// joint class. The marks and counts are the Month screen's, up to today. A
// day with a session for the book's group stays white, after today too, to
// be filled by hand, and is dotted only before counting starts; any other
// day is grey when there is no school, a make-up day aside, and dotted
// otherwise. The blank spread keeps the names and the shading, and leaves
// the marks and figures empty. Rows run to 50.

import {
  compareDays,
  courseGrade,
  isJoint,
  levelGroups,
  monthRange,
  parseDay,
  weekday,
  wholeGroup,
  type AbsenceMark,
  type Day,
  type PupilCount,
} from '@minhajna/core';
import { hijriOf } from '../rollbook/hijri-months';
import { bookUnits, monthView, percent, totals } from '../rollbook/month-rules';
import { coreContext } from '../storage/core-context';
import { monthLabel, type DocumentData, type Translate } from './document-data';
import { rollSpreadHtml, type DayShade, type RollSpread, type SpreadRow } from './roll-spread-html';

/** A roll-call book: a class, the group its courses are taught to, and the subject when it has one course. */
export interface RollBook {
  readonly classId: string;
  readonly groupId: string;
  readonly subject: string | null;
}

/** The paper book's rows. */
const ROWS = 50;

/** Every book of the teacher's classes, by class name. */
export function rollBooks(data: DocumentData): RollBook[] {
  const books = new Map<string, { classId: string; groupId: string; subjects: Set<string> }>();
  for (const course of data.state.courses.values()) {
    const schoolClass = data.state.classes.get(course.classId);
    if (schoolClass === undefined) continue;
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    const groupId = levelGroups(schoolClass).find((group) => group.grade === grade)?.id ?? wholeGroup(schoolClass).id;
    const key = `${schoolClass.id}/${groupId}`;
    const book = books.get(key) ?? { classId: schoolClass.id, groupId, subjects: new Set<string>() };
    book.subjects.add(course.subject);
    books.set(key, book);
  }
  const name = (classId: string) => data.state.classes.get(classId)?.name ?? '';
  return [...books.values()]
    .map(({ classId, groupId, subjects }) => ({
      classId,
      groupId,
      subject: subjects.size === 1 ? ([...subjects][0] ?? null) : null,
    }))
    .sort((a, b) => name(a.classId).localeCompare(name(b.classId), 'ar') || a.groupId.localeCompare(b.groupId));
}

/** The head's scope: the class, the subject when the book has one, the school, then the Hijri months if given. */
export function bookScope(data: DocumentData, book: RollBook, extra: string | null): string {
  const schoolClass = data.state.classes.get(book.classId);
  const group = schoolClass?.groups.find((one) => one.id === book.groupId);
  const year = schoolClass !== undefined && group !== undefined && group.id !== wholeGroup(schoolClass).id;
  const subject =
    book.subject === null
      ? null
      : (data.profile.subjects.find((one) => one.code === book.subject)?.name[data.lang] ?? book.subject);
  const school = schoolClass === undefined ? undefined : data.state.schools.get(schoolClass.schoolId)?.name;
  return [schoolClass?.name, year ? group.name : null, subject, school, extra]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' · ');
}

/** The rows of the paper book: each pupil, then empty numbered rows up to 50. */
export function padRows<T extends { readonly number: number }>(rows: readonly T[], empty: (number: number) => T): T[] {
  const last = rows.reduce((most, row) => Math.max(most, row.number), 0);
  return [...rows, ...Array.from({ length: Math.max(ROWS - rows.length, 0) }, (_, index) => empty(last + index + 1))];
}

/** A pupil's absence dates, «م» after a day justified, «م½» after a whole day half justified. */
function absenceDates(absences: readonly AbsenceMark[], separator: string): string {
  const days = [...new Set(absences.map((absence) => absence.day))];
  return days
    .map((day) => {
      const marks = absences.filter((absence) => absence.day === day);
      const justified = marks.filter((absence) => absence.justified).length;
      return `${day.slice(8)}${justified === 0 ? '' : justified === marks.length ? 'م' : 'م½'}`;
    })
    .join(separator);
}

function spread(data: DocumentData, t: Translate, blank: boolean, book: RollBook, month: string): RollSpread {
  const context = coreContext(data);
  const today = data.today ?? monthRange(month).to;
  const view = monthView(context, book.classId, book.groupId, month, today);
  const { from, to } = monthRange(month);
  const length = Number(to.slice(8));
  const schoolClass = data.state.classes.get(book.classId);
  const school = schoolClass === undefined ? undefined : data.state.schools.get(schoolClass.schoolId);
  const first = compareDays(from, data.year.from) < 0 ? data.year.from : from;
  const last = compareDays(to, data.year.to) > 0 ? data.year.to : to;
  const whole = schoolClass === undefined ? book.groupId : wholeGroup(schoolClass).id;
  const units = compareDays(first, last) > 0 ? [] : bookUnits(context, book.classId, first, last);
  const sessions = new Set(
    units
      .filter((unit) => book.groupId === whole || unit.groupId === whole || unit.groupId === book.groupId)
      .map((unit) => unit.day),
  );
  const days: DayShade[] = Array.from({ length }, (_, index) => {
    const day = parseDay(`${month}-${String(index + 1).padStart(2, '0')}`);
    if (sessions.has(day)) return view.countsFrom !== null && compareDays(day, view.countsFrom) < 0 ? 'none' : null;
    const info = school === undefined ? null : context.calendar.info(day, school, schoolClass);
    const working = context.ref.country.workingDays.includes(weekday(day));
    return info === null || !info.schoolDay || !working ? 'off' : 'none';
  });
  const separator = data.lang === 'ar' ? '، ' : ', ';
  const counts = view.rows.map((row) => row.count);
  const possibles = new Set(counts.map((count) => count?.possible ?? 0));
  const figure = (count: PupilCount | null, pick: (one: PupilCount) => number) =>
    blank || count === null || count.possible === 0 ? '' : String(pick(count));
  const rows: SpreadRow[] = view.rows.map((row) => ({
    number: row.number,
    name: row.name,
    marks: Array.from({ length }, (_, index) =>
      blank ? '' : (row.marks.get(parseDay(`${month}-${String(index + 1).padStart(2, '0')}`)) ?? ''),
    ),
    absent: figure(row.count, (one) => one.absent),
    present: figure(row.count, (one) => one.present),
    possible: figure(row.count, (one) => one.possible),
    dates: blank || row.count === null ? '' : absenceDates(row.count.absences, separator),
    late: blank || row.count === null ? '' : [...new Set(row.count.late)].map((day) => day.slice(8)).join(separator),
  }));
  const sum = totals(counts);
  const [each] = possibles;
  const shown = (day: Day) => `\u2066${day.slice(8)}/${day.slice(5, 7)}\u2069`;
  const figures =
    blank || sum.possible === 0
      ? []
      : [
          t(possibles.size === 1 ? 'rollBook.each' : 'rollBook.sum', {
            possible: each,
            absent: t('classPage.absences', { count: sum.absent }),
            total: sum.possible,
            rate: `\u2066${percent(sum.rate)}%\u2069`,
          }),
          compareDays(today, to) < 0 ? t('rollPrint.until', { day: shown(today) }) : '',
        ];
  const start = blank || view.countsFrom === null ? '' : t('rollBook.countsFrom', { day: shown(view.countsFrom) });
  return {
    title: t('rollPrint.spreadTitle', { month: monthLabel(data, from) }),
    scope: bookScope(data, book, hijriOf(month, data.lang)),
    days,
    rows: padRows(rows, (number) => ({
      number,
      name: '',
      marks: [],
      absent: '',
      present: '',
      possible: '',
      dates: '',
      late: '',
    })),
    possibleColumn: possibles.size > 1,
    footer: [...figures, start].filter((part) => part !== '').join(' '),
    book: book.classId,
  };
}

/** The spread of `month` for each book given, or for every book, as recorded or blank. */
export function rollSpreadPages(
  data: DocumentData,
  t: Translate,
  blank: boolean,
  month: string = data.day.slice(0, 7),
  books: readonly RollBook[] = rollBooks(data),
): string {
  const label = monthLabel(data, parseDay(`${month}-01`));
  return rollSpreadHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('rollPrint.spreadTitle', { month: label }),
      number: t('documents.number'),
      name: t('documents.name'),
      absent: t('rollBook.absent'),
      present: t('rollBook.present'),
      possible: t('rollBook.possible'),
      dates: t('rollPrint.dates'),
      late: t('rollPrint.late'),
      legend: [
        `- ${t('rollBook.legend.morning')}`,
        `ǀ ${t('rollBook.legend.afternoon')}`,
        `+ ${t('rollBook.legend.day')}`,
        `(-) ${t('rollBook.legend.justified')}`,
        `+م½ ${t('rollBook.legend.half')}`,
        t('rollPrint.datesKey'),
      ],
      off: t('rollPrint.off'),
      none: t('rollPrint.none'),
      teacher: t('rollPrint.teacher'),
      director: t('rollPrint.director'),
      inspector: t('rollPrint.inspector'),
      date: t('rollPrint.date'),
      confidential: t('documents.confidential'),
    },
    books.map((book) => spread(data, t, blank, book, month)),
  );
}
