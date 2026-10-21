// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two calendar tables of a journal's front pages (#216, Journal-front,
// P-Journal-front), for the schools and classes a journal covers:
// - seminars, training and meetings: the teacher's own calendar entries and
//   the school's and zone's events, including one for a grade taught or a
//   level of a multigrade class, an entry still to come in grey; a class
//   council once the teacher says it was held, or in grey until its day ends;
// - holidays and national days: the days off of the national and zone
//   calendar, each with its confidence (R-4.5-04).
// Dates are day first, «01/11/2026», as the journal's pages are (R-3.8-59),
// and a range reads in the page's direction. A row's wrapped lines are
// counted, safe side, so the empty rules after it still fit the page. The
// blank version keeps the heads and leaves every rule empty.

import {
  appliesTo,
  classGrades,
  forGrade,
  type CalendarEntry,
  type Day,
  type School,
  type SchoolClass,
} from '@minhajna/core';
import { span } from '../times/TimeTable';
import type { DocumentData, Translate } from './document-data';
import type { FrontRow, FrontTable } from './journal-front-html';
import { wrappedRules } from './texts-book-rows';

/** Characters a rule of the activity column holds, and of the occasion column, measured safe side. */
const EVENT_CHARACTERS = 40;
const OCCASION_CHARACTERS = 44;

type TableKey =
  'events' | 'eventsNote' | 'date' | 'activity' | 'remarks' | 'holidays' | 'holidaysNote' | 'occasion' | 'status';

/** Whether an entry belongs on the seminars page on `day`: the teacher's own, or the school's and zone's events. */
function isEvent(entry: CalendarEntry, day: Day): boolean {
  if (entry.council !== undefined) return entry.council.held === true || entry.from >= day;
  if (entry.layer === 'teacher') return entry.effect !== 'adds-sessions';
  return (entry.layer === 'school' || entry.layer === 'zone') && entry.effect === 'marker';
}

/** Whether an entry belongs on the holidays page: a day off of the national or zone calendar. */
function isHoliday(entry: CalendarEntry): boolean {
  return (entry.layer === 'national' || entry.layer === 'zone') && entry.effect === 'no-school';
}

/** A date as the front pages write it, day first. */
export function frontDate(day: Day): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

/** The seminars table and the holidays table for `schools` and the `classes` taught there. */
export function frontTables(
  data: DocumentData,
  t: Translate,
  blank: boolean,
  schools: readonly School[],
  classes: readonly SchoolClass[],
): { readonly events: FrontTable; readonly holidays: FrontTable } {
  const key = (name: TableKey) => t(`documents.journalFront.${name}`);
  const name = (entry: CalendarEntry) => entry.name[data.lang] ?? entry.name.ar ?? Object.values(entry.name)[0] ?? '';
  const dates = (entry: CalendarEntry) =>
    entry.from === entry.to ? frontDate(entry.from) : span(frontDate(entry.from), frontDate(entry.to), data.dir);
  const inYear = (entry: CalendarEntry) => entry.from <= data.year.to && entry.to >= data.year.from;
  const covers = (entry: CalendarEntry) =>
    schools.length === 0
      ? entry.layer === 'national'
      : schools.some(
          (school) =>
            appliesTo(entry, school) ||
            classes.some(
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
  const place = (entry: CalendarEntry) => {
    const school = entry.schoolId === undefined ? undefined : data.state.schools.get(entry.schoolId);
    return school === undefined ? name(entry) : `${name(entry)} · ${school.name}`;
  };
  const events: FrontRow[] = blank
    ? []
    : entries((entry) => isEvent(entry, data.day), place).map((entry) => ({
        cells: [dates(entry), place(entry), ''],
        later: entry.from > data.day || (entry.council !== undefined && entry.council.held !== true),
        rules: wrappedRules(place(entry), EVENT_CHARACTERS),
      }));
  const holidays: FrontRow[] = blank
    ? []
    : entries(isHoliday, name).map((entry) => ({
        cells: [name(entry), dates(entry), t(`documents.journalFront.confidences.${entry.confidence}`)],
        later: false,
        rules: wrappedRules(name(entry), OCCASION_CHARACTERS),
      }));
  return {
    events: {
      title: key('events'),
      heads: [key('date'), key('activity'), key('remarks')],
      widths: ['56mm', 'auto', '34mm'],
      dateColumn: 0,
      rows: events,
      ...(!blank && { note: key('eventsNote') }),
    },
    holidays: {
      title: key('holidays'),
      heads: [key('occasion'), key('date'), key('status')],
      widths: ['auto', '56mm', '26mm'],
      dateColumn: 1,
      rows: holidays,
      note: key('holidaysNote'),
    },
  };
}
