// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The CEM and lycée daily journal's front pages (#216, Journal-front,
// R-3.8-12), from the record book and the calendar:
// - the teacher's card: the name and rank as the teacher gave them, the
//   subjects, schools and classes taught this school year, and the year as
//   «2026-2027» (R-3.8-61), with the director's visa;
// - seminars, training and meetings: the teacher's own calendar entries and
//   the school's and zone's events, an entry still to come in grey;
// - holidays and national days: the days off of the national and zone
//   calendar, each with its confidence (R-4.5-04).
// Dates are day first, «01/11/2026», as the journal's pages are (R-3.8-59),
// and a range reads in the page's direction. A row's wrapped lines are
// counted, safe side, so the empty rules after it still fit the page. The
// blank version keeps the labels and the tables' heads, and leaves
// everything else for the pen.

import { appliesTo, classGrades, forGrade, type CalendarEntry, type Day } from '@minhajna/core';
import { schoolNames, yearLabel, type DocumentData, type Translate } from './document-data';
import { journalFrontHtml, type FrontRow, type FrontTable } from './journal-front-html';
import { bookClasses, bookCourses } from './texts-book-pages';
import { span } from '../times/TimeTable';
import { isolate } from '../week/grid-labels';
import { wrappedRules } from './texts-book-rows';

/** Characters a rule of the activity column holds, and of the occasion column, measured safe side. */
const EVENT_CHARACTERS = 40;
const OCCASION_CHARACTERS = 44;

type FrontKey =
  | 'name'
  | 'card'
  | 'teacherName'
  | 'rank'
  | 'subject'
  | 'school'
  | 'year'
  | 'classes'
  | 'and'
  | 'events'
  | 'eventsNote'
  | 'date'
  | 'activity'
  | 'remarks'
  | 'holidays'
  | 'holidaysNote'
  | 'occasion'
  | 'status';

/** Whether an entry belongs on the seminars page: the teacher's own, or the school's and zone's events. */
function isEvent(entry: CalendarEntry): boolean {
  if (entry.layer === 'teacher') return entry.effect !== 'adds-sessions';
  return (entry.layer === 'school' || entry.layer === 'zone') && entry.effect === 'marker';
}

/** Whether an entry belongs on the holidays page: a day off of the national or zone calendar. */
function isHoliday(entry: CalendarEntry): boolean {
  return (entry.layer === 'national' || entry.layer === 'zone') && entry.effect === 'no-school';
}

/** The journal's front pages for the school year of `data`, or blank ones with their labels and heads. */
export function journalFrontPages(data: DocumentData, t: Translate, blank: boolean): string {
  const key = (name: FrontKey) => `documents.journalFront.${name}` as const;
  const schools = [...data.state.schools.values()];
  const courses = bookCourses(data);
  const name = (entry: CalendarEntry) => entry.name[data.lang] ?? entry.name.ar ?? Object.values(entry.name)[0] ?? '';
  const date = (day: Day) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
  const dates = (entry: CalendarEntry) =>
    entry.from === entry.to ? date(entry.from) : span(date(entry.from), date(entry.to), data.dir);
  const inYear = (entry: CalendarEntry) => entry.from <= data.year.to && entry.to >= data.year.from;
  const taught = bookClasses(data);
  const covers = (entry: CalendarEntry) =>
    schools.length === 0
      ? entry.layer === 'national'
      : schools.some(
          (school) =>
            appliesTo(entry, school) ||
            taught.some(
              (one) =>
                one.schoolId === school.id &&
                classGrades(one).some((grade) => appliesTo(entry, school, forGrade(one, grade))),
            ),
        );
  const entries = (keep: (entry: CalendarEntry) => boolean, said: (entry: CalendarEntry) => string) => {
    const seen = new Set<string>();
    return [...data.calendar, ...data.state.calendar]
      .filter((entry) => keep(entry) && inYear(entry) && covers(entry))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
      .filter((entry) => {
        const same = `${entry.from}/${entry.to}/${said(entry)}`;
        if (seen.has(same)) return false;
        seen.add(same);
        return true;
      });
  };
  const later = (day: Day) => day > data.day;
  const place = (entry: CalendarEntry) => {
    const school = entry.schoolId === undefined ? undefined : data.state.schools.get(entry.schoolId);
    return school === undefined ? name(entry) : `${name(entry)} · ${school.name}`;
  };
  const events: FrontRow[] = blank
    ? []
    : entries(isEvent, place).map((entry) => ({
        cells: [dates(entry), place(entry), ''],
        later: later(entry.from),
        rules: wrappedRules(place(entry), EVENT_CHARACTERS),
      }));
  const holidays: FrontRow[] = blank
    ? []
    : entries(isHoliday, name).map((entry) => ({
        cells: [name(entry), dates(entry), t(`documents.journalFront.confidences.${entry.confidence}`)],
        later: false,
        rules: wrappedRules(name(entry), OCCASION_CHARACTERS),
      }));
  const subjects = [...new Set(courses.map(({ course }) => course.subject))].map(
    (code) => data.profile.subjects.find((one) => one.code === code)?.name[data.lang] ?? code,
  );
  const classes = taught.map((one) => isolate(one.name));
  const value = (text: string | undefined) => (blank ? '' : (text ?? ''));
  const tables: FrontTable[] = [
    {
      title: t(key('events')),
      heads: [t(key('date')), t(key('activity')), t(key('remarks'))],
      widths: ['56mm', 'auto', '34mm'],
      dateColumn: 0,
      rows: events,
      ...(!blank && { note: t(key('eventsNote')) }),
    },
    {
      title: t(key('holidays')),
      heads: [t(key('occasion')), t(key('date')), t(key('status'))],
      widths: ['auto', '56mm', '26mm'],
      dateColumn: 1,
      rows: holidays,
      note: t(key('holidaysNote')),
    },
  ];
  return journalFrontHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: t('documents.journal'),
      front: t(key('name')),
      school: blank ? '' : schoolNames(data),
      year: t('documents.year', { year: yearLabel(data) }),
      card: t(key('card')),
      director: t('documents.director'),
    },
    [
      { label: t(key('teacherName')), value: value(data.state.personal?.name) },
      { label: t(key('rank')), value: value(data.state.teacher?.rank) },
      { label: t(key('subject')), value: value(subjects.join(t(key('and')))) },
      { label: t(key('school')), value: value(schoolNames(data)) },
      { label: t(key('year')), value: yearLabel(data) },
      { label: t(key('classes')), value: value(classes.join(' · ')) },
    ],
    tables,
  );
}
