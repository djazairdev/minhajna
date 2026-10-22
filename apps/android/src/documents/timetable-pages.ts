// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's weekly timetable (#215, Timetable-doc, R-3.8-37, R-4.6-04),
// from the timetable version in force on the chosen day with this school
// year's courses, or else the first such version to apply after it, never
// last year's. Each version is printed with the day it applies from, so a
// change brings a new copy.
// - The head: the schools of its classes, and the year; the teacher's name
//   as given in setup, the subjects and the classes.
// - The grid: the week's days and slots, each slot with its usual bell time
//   when the schools agree on it, or its name, and each cell as the week's
//   grid shows it: the class, its school in a week of two schools, a half
//   group, week A or B, and the teacher's own time.
// - Each class's hours a week, an A or B week slot counting half, rounded
//   to the half hour, and their total.
// The blank version keeps the school, the year, the labels, the days and the
// slots, and leaves the rest for the pen.

import {
  bellTimes,
  courseSetup,
  versionOn,
  weekday,
  weekGrid,
  type Day,
  type SchoolClass,
  type TimetableEntry,
  type Slot,
  type TimetableVersion,
} from '@minhajna/core';
import { coreContext } from '../storage/core-context';
import { span } from '../times/TimeTable';
import { levelOf } from '../times/times-rules';
import { gridCell, isolate, slotSpoken, weekMarks } from '../week/grid-labels';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { frontDate } from './front-tables';
import { timetableHtml, type TimetableRow } from './timetable-html';
import { documentSignature, drawnMark } from './drawn-mark';

type Key = 'title' | 'teacher' | 'subject' | 'subjects' | 'classes' | 'teacherBox' | 'inspector' | 'date';

/** Whether an entry's course is one of this school year's. */
function ofYear(data: DocumentData, entry: TimetableEntry): boolean {
  const course = data.state.courses.get(entry.courseId);
  return course?.year === data.year.id && data.state.classes.has(course.classId);
}

/**
 * The version printed for `data.day`: the one in force with this school year's classes, or the first such one to apply
 * after it; none when the week in force has no class of the year, and no later one has.
 */
export function printedVersion(data: DocumentData): { readonly from: Day; readonly version: TimetableVersion } | null {
  const { from, to } = data.year;
  const on = data.day < from ? from : data.day > to ? to : data.day;
  const found = data.state.timetables.filter((one) => one.from <= to);
  const at = (day: Day) => {
    const version = versionOn(found, day);
    const record = [...found].reverse().find((one) => one.version === version);
    return record !== undefined && record.version.entries.some((entry) => ofYear(data, entry)) ? record : undefined;
  };
  const days = [...new Set(found.map((one) => one.from))].sort();
  const current =
    at(on) ??
    days
      .filter((day) => day > on)
      .map(at)
      .find(Boolean);
  return current === undefined ? null : { from: current.from, version: current.version };
}

/** «ساري من الإثنين 21/09/2026» for the printed version, or the label alone. */
export function inForce(t: Translate, day: Day | undefined): string {
  const said = day === undefined ? '' : `${t(`week.days.${weekday(day)}`)} ${frontDate(day)}`;
  return t('documents.timetable.from', { day: said }).trim();
}

/** The Documents tab's line: the day the printed version applies from, or that none is drawn yet. */
export function timetableLine(data: DocumentData, t: Translate): string {
  const printed = printedVersion(data);
  return printed === null ? t('documents.timetable.none') : inForce(t, printed.from);
}

/** The weekly timetable for `data.day`, or blank with its labels. */
export function timetablePages(data: DocumentData, t: Translate, blank: boolean): string {
  const key = (name: Key) => t(`documents.timetable.${name}`);
  const colon = t('documents.journalLines.colon');
  const context = coreContext(data);
  const printed = printedVersion(data);
  const version =
    blank || printed === null
      ? undefined
      : { ...printed.version, entries: printed.version.entries.filter((entry) => ofYear(data, entry)) };
  const grid = weekGrid(data.profile, printed?.version.options);
  const classOf = (courseId: string): SchoolClass | undefined => {
    const course = data.state.courses.get(courseId);
    return course && data.state.classes.get(course.classId);
  };
  const entries = version?.entries ?? [];
  const classes = [...data.state.classes.values()].filter((one) =>
    entries.some((entry) => classOf(entry.courseId)?.id === one.id),
  );
  const schools = [
    ...new Set(
      (classes.length > 0 ? classes.map((one) => one.schoolId) : [...data.state.schools.keys()]).flatMap(
        (id) => data.state.schools.get(id) ?? [],
      ),
    ),
  ];
  const shift = printed?.version.options?.doubleShift ? 'double' : 'single';
  const time = (slot: Slot) => {
    const times = schools.map(
      (school) => bellTimes(data.bells, school, levelOf(school) ?? '', shift, 'usual', [slot])[0] ?? null,
    );
    const [first] = times;
    const same = first != null && times.every((one) => one?.from === first.from && one.to === first.to);
    return same ? span(first.from, first.to, data.dir) : slotSpoken(t, slot);
  };
  const lookup = {
    course: (id: string) => data.state.courses.get(id),
    schoolClass: (id: string) => data.state.classes.get(id),
  };
  const marks = version && weekMarks(version, data.state, classes);
  const row = (slot: Slot): TimetableRow => ({
    time: time(slot),
    cells: grid.days.map((day) =>
      version === undefined
        ? []
        : (gridCell(t, version, lookup, { weekday: day, slot }, { schools: marks?.schools })?.label.split('\n') ?? []),
    ),
  });
  const minutes = new Map<string, number>();
  for (const entry of entries) {
    const id = classOf(entry.courseId)!.id;
    const share = entry.weeks === 'every' ? 1 : 0.5;
    minutes.set(id, (minutes.get(id) ?? 0) + share * courseSetup(context, entry.courseId).sessionMinutes);
  }
  const halves = (total: number) => Math.round(total / 30) / 2;
  const hours = (count: number) =>
    t('ready.hours', { count }).replace(String(count), String(count).replace('.', data.lang === 'en' ? '.' : ','));
  const total = [...minutes.values()].reduce((sum, one) => sum + halves(one), 0);
  const subjects = [...new Set(entries.map((entry) => data.state.courses.get(entry.courseId)!.subject))].map(
    (code) => data.profile.subjects.find((one) => one.code === code)?.name[data.lang] ?? code,
  );
  const and = t('documents.journalFront.and');
  return timetableHtml({
    lang: data.lang,
    dir: data.dir,
    school: schools.map((school) => isolate(school.name)).join(' · '),
    year: t('documents.year', { year: yearShown(data) }),
    title: key('title'),
    lines: [
      [
        `${key('teacher')}${colon}${blank ? '' : (data.state.personal?.name ?? '')}`.trimEnd(),
        `${key(subjects.length > 1 ? 'subjects' : 'subject')}${colon}${subjects.join(and)}`.trimEnd(),
      ].join(' · '),
      `${key('classes')}${colon}${classes.map((one) => isolate(one.name)).join(and)}`.trimEnd(),
    ],
    days: grid.days.map((day) => t(`week.days.${day}`)),
    morning: grid.slots.filter((slot) => slot.half === 'morning').map(row),
    afternoon: grid.slots.filter((slot) => slot.half !== 'morning').map(row),
    hours:
      classes.length === 0
        ? ''
        : [
            ...classes.map((one) => `${isolate(one.name)}${colon}${hours(halves(minutes.get(one.id) ?? 0))}`),
            t('documents.timetable.total', { hours: hours(total) }),
          ].join(' · '),
    from: inForce(t, blank ? undefined : printed?.from),
    boxes: [key('teacherBox'), t('documents.director'), key('inspector')],
    mark: drawnMark(documentSignature(data, blank)),
    date: key('date'),
  });
}
