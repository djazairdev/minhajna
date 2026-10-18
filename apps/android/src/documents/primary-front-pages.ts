// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary journal's front pages (#216, P-Journal-front, R-3.8-08), a
// set for each primary class taught this school year, from the record book
// and the calendar:
// - the cover: the school, the year, the class and the teacher's name;
// - the teacher's card: the name and rank as given, the school, the class
//   with its number of pupils, and the year, with the director's visa;
// - holidays and national days, then seminars and training, for the
//   class's school, as front-tables.ts gives them;
// - the pupil list on the day it is printed, numbered as the class list
//   orders it: the name and the registration number only, never a birth
//   date, an address or a parent's details;
// - the weekly timetable in force that day: the teacher's sessions with the
//   class, by slot and day, a lesson of week A or B marked so, and the levels
//   when a multigrade session is not for all of them; with the usual bell
//   times, even in Ramadan, as the timetable is for the year; the
//   specialists' hours and the approval date are for the director to fill.
// Printed before the school year or after it, the pages show its first or
// last day, and before the first timetable, the first one drawn.
// The pages hold pupils' names, so they carry «داخلي · سري» (R-5.9-15).
// The blank version keeps the labels and heads, the class on the cover, the
// card and the timetable, and empty rules, one page of them for the pupil
// list.

import {
  bellTimes,
  classGrades,
  courseGrade,
  entryCourses,
  groupPupils,
  isJoint,
  versionOn,
  weekGrid,
  wholeGroup,
  type SchoolClass,
  type TimetableEntry,
} from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { span } from '../times/TimeTable';
import { isolate, slotSpoken } from '../week/grid-labels';
import { yearLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { frontTables } from './front-tables';
import { primaryFrontHtml, type PrimaryFront, type WeekRow } from './primary-front-html';
import { bySpecialist, classTeacherClasses } from './specialists';

/** Rules on a table's page, fewer than the CEM's as the confidential band takes room. */
const PRIMARY_RULES = 23;

type Key =
  | 'className'
  | 'pupils'
  | 'pupilsNote'
  | 'number'
  | 'pupilName'
  | 'registration'
  | 'week'
  | 'time'
  | 'approved'
  | 'seal'
  | 'weekNote';

/** The primary journal's front pages for the school year of `data`, or blank ones with their labels and heads. */
export function primaryFrontPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const key = (name: Key) => t(`documents.primaryFront.${name}`);
  const front = (name: 'name' | 'card' | 'teacherName' | 'rank' | 'school' | 'year') =>
    t(`documents.journalFront.${name}`);
  const { from, to } = data.year;
  const on = data.day < from ? from : data.day > to ? to : data.day;
  const version =
    versionOn(data.state.timetables, on) ??
    data.state.timetables.find((one) => one.from > on && one.from <= to)?.version ??
    null;
  const shift = version?.options?.doubleShift ? 'double' : 'single';
  const grid = weekGrid(data.profile, version?.options);
  const value = (text: string | undefined) => (blank ? '' : (text ?? ''));
  const teacher = data.state.personal?.name;
  const subjectOf = (code: string) => data.profile.subjects.find((one) => one.code === code)?.name[data.lang] ?? code;
  const said = (schoolClass: SchoolClass, entry: TimetableEntry): string[] => {
    const course = data.state.courses.get(entry.courseId);
    if (course === undefined || course.classId !== schoolClass.id || bySpecialist(data, course, schoolClass)) return [];
    const grades = entryCourses(data.state, course).map((one) => courseGrade(one, schoolClass));
    const levels = isJoint(schoolClass) && classGrades(schoolClass).some((grade) => !grades.includes(grade));
    const week = entry.weeks === 'every' ? '' : ` ${t(entry.weeks === 'A' ? 'week.weekShortA' : 'week.weekShortB')}`;
    const subject = subjectOf(course.subject);
    const named = levels
      ? `${subject} · ${grades.map((grade) => yearShort(t, grade)).join(t('documents.journalFront.and'))}`
      : subject;
    return [`${named}${week}`];
  };
  const set = (schoolClass: SchoolClass): PrimaryFront => {
    const school = data.state.schools.get(schoolClass.schoolId);
    const pupils = blank ? [] : groupPupils(context, schoolClass.id, wholeGroup(schoolClass).id, on);
    const className = isolate(schoolClass.name);
    const { events, holidays } = frontTables(data, t, blank, school === undefined ? [] : [school], [schoolClass]);
    const cell = (day: number, slot: (typeof grid.slots)[number]) =>
      [
        ...new Set(
          (version?.entries ?? [])
            .filter(
              (entry) => entry.weekday === day && entry.slot.half === slot.half && entry.slot.index === slot.index,
            )
            .flatMap((entry) => said(schoolClass, entry)),
        ),
      ].join(' / ');
    const row = (slot: (typeof grid.slots)[number]): WeekRow => {
      const time =
        school === undefined
          ? null
          : (bellTimes(data.bells, school, schoolClass.level, shift, 'usual', [slot])[0] ?? null);
      return {
        time: time === null ? slotSpoken(t, slot) : span(time.from, time.to, data.dir),
        cells: grid.days.map((day) => (blank ? '' : cell(day, slot))),
      };
    };
    return {
      cover: {
        school: value(school?.name),
        year: t('documents.year', { year: yearShown(data) }),
        book: t('documents.primaryJournal.name'),
        className: t('documents.textsBook.className', { name: className }),
        teacher: `${front('teacherName')}${t('documents.journalLines.colon')}${value(teacher)}`,
      },
      card: [
        { label: front('teacherName'), value: value(teacher) },
        { label: front('rank'), value: value(data.state.teacher?.rank) },
        { label: front('school'), value: value(school?.name) },
        {
          label: key('className'),
          value: blank ? className : `${className} · ${t('setup.pupils', { count: pupils.length })}`,
        },
        { label: front('year'), value: yearLabel(data) },
      ],
      tables: [
        { ...holidays, rules: PRIMARY_RULES },
        { ...events, rules: PRIMARY_RULES },
        {
          title: key('pupils'),
          heads: [key('number'), key('pupilName'), key('registration')],
          widths: ['20mm', 'auto', '50mm'],
          dateColumn: 0,
          rows: pupils.map((pupil, at) => ({
            cells: [String(at + 1), pupil.name, pupil.registration ?? ''],
            later: false,
            rules: 1,
          })),
          rules: blank ? PRIMARY_RULES : 0,
          note: key('pupilsNote'),
        },
      ],
      week: {
        title: `${key('week')} · ${className}`,
        time: key('time'),
        days: grid.days.map((day) => t(`week.days.${day}`)),
        bands: (['morning', 'afternoon'] as const).map((half) => ({
          name: t(`documents.primaryJournal.${half}`),
          rows: grid.slots.filter((slot) => slot.half === half).map(row),
        })),
        approved: key('approved'),
        signature: key('seal'),
        note: key('weekNote'),
      },
    };
  };
  const classes = classTeacherClasses(data);
  const schools = [...new Set(classes.map((one) => data.state.schools.get(one.schoolId)?.name ?? ''))];
  return primaryFrontHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: t('documents.primaryJournal.name'),
      front: front('name'),
      school: blank ? '' : schools.filter(Boolean).join(' · '),
      year: t('documents.year', { year: yearShown(data) }),
      card: front('card'),
      director: t('documents.director'),
    },
    classes.map(set),
    t('documents.confidential'),
  );
}
