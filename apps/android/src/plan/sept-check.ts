// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check as printed for an inspector (#225, Sept-check,
// R-4.11-06, R-4.7-23, answers 296 to 300): one table for every class of the
// teacher's in the same school with the subject and grade of the class it is
// opened from and a pinned pack, by name, counted from the print day to the
// exams of the term under way, or the next term's once those have begun.
// For each class, the sessions the timetable gives, what each holiday,
// closure or test takes by name and day, what each make-up day gives, the
// lessons left, what the plan needs, and the difference, which is spare
// time and never free time; then TD, counted apart. An entry of the
// teacher's own calendar is private (PRD §4.5), so it prints without its
// name. Below, the exams, the pack each class follows and where it comes
// from, where the figures come from, and boxes to sign by hand. The QR
// code waits for signing (#223, answer 296). The screen and the printed
// page read the same sheet.

import {
  addDays,
  compareDays,
  courseOf,
  courseGrade,
  courseSetup,
  formatDay,
  termCheck,
  termCheckDetail,
  weekday,
  type CheckChange,
  type Context,
  type Day,
  type TermCheckDetail,
} from '@minhajna/core';
import type { Translate } from '../documents/document-data';
import { localized } from '../setup/names';
import { isolate } from '../week/grid-labels';
import { termName } from '../classes/plan-labels';
import { groupName, packSource } from './pack-labels';
import { planGroups } from './plan-rules';

/** A line of the table: a heading when it has no values, else one value for each class. */
export interface SheetRow {
  readonly key: string;
  readonly label: string;
  readonly values?: readonly number[];
  readonly strong?: boolean;
}

export interface SeptSheet {
  /** The school and the year, and the print day. */
  readonly school: string;
  readonly date: string;
  /** The teacher and the subject, then the days counted. */
  readonly who: string;
  readonly period: string;
  readonly classes: readonly string[];
  readonly rows: readonly SheetRow[];
  readonly notes: readonly string[];
  readonly packs: readonly { readonly title: string; readonly lines: readonly string[] }[];
  readonly sources: string;
}

/** A figure as the sheet shows it: below zero with a minus sign, kept left of its digits in Arabic too. */
export function figure(value: number): string {
  return value < 0 ? `\u2066\u2212${-value}\u2069` : String(value);
}

/** A day as the sheet prints it, such as «الأحد 01/11/2026». */
function dayLong(t: Translate, day: Day): string {
  return `${t(`week.days.${weekday(day)}`)} ${isolate(formatDay(day))}`;
}

/** The changes of every class, one row each, by their first day. */
function merged(lists: readonly (readonly CheckChange[])[]): CheckChange[] {
  const key = (change: CheckChange) => JSON.stringify([change.kind, change.id, change.mark]);
  const found = new Map<string, CheckChange>();
  for (const change of lists.flat()) {
    const known = found.get(key(change));
    if (known === undefined || known.day > change.day) found.set(key(change), change);
  }
  return [...found.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** The September check of the classes sharing `courseId`'s subject and grade, from `day`; null when none has one. */
export function septSheet(context: Context, t: Translate, courseId: string, day: Day): SeptSheet | null {
  const { state, ref } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  if (course === undefined || schoolClass === undefined) return null;
  const term = ref.year.terms
    .filter((one) => compareDays(day, one.to) <= 0)
    .map((one) => one.number)
    .find((number) => {
      const check = termCheck(context, courseId, day, number);
      return check === null || compareDays(day, check.before) < 0;
    });
  if (term === undefined) return null;
  const grade = courseGrade(course, schoolClass);
  const group = planGroups(state).find((one) => one.grade === grade && one.subject === course.subject);
  const classes = (group?.classes ?? [])
    .filter((one) => one.schoolId === schoolClass.schoolId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const columns = classes.flatMap((one) => {
    const own = courseOf(state, one.id, course.subject, course.year, grade);
    const detail = own === undefined || own.pack === null ? null : termCheckDetail(context, own.id, day, term);
    return detail === null ? [] : [{ schoolClass: one, courseId: own!.id, detail }];
  });
  const first = columns[0];
  if (first === undefined) return null;
  const details = columns.map((one) => one.detail);
  const school = state.schools.get(schoolClass.schoolId);
  const entryName = (id: string | null) =>
    id === null || school === undefined
      ? undefined
      : context.calendar.entriesFor(school).find((entry) => entry.id === id)?.name;
  const what = (change: CheckChange): string => {
    if (change.kind === 'test') return state.tests.get(change.id ?? '')?.title ?? t('septCheck.test');
    if (change.mark === 'teacher') return t('septCheck.marks.teacher');
    const name = entryName(change.id);
    if (name !== undefined) return localized(name);
    return change.kind === 'added' ? t('septCheck.addedDay') : t(`septCheck.marks.${change.mark ?? 'holiday'}`);
  };
  const values = (pick: (detail: TermCheckDetail) => number) => details.map(pick);
  const weekly = (key: 'septCheck.all' | 'septCheck.main', pick: (detail: TermCheckDetail) => number) => {
    const counts = new Set(details.map(pick));
    return counts.size === 1 ? t(`${key}Weekly`, { count: [...counts][0] }) : t(key);
  };
  const changeRows = (queue: 'main' | 'td', kind: 'taken' | 'added'): SheetRow[] =>
    merged(details.map((detail) => detail[queue][kind])).map((change) => ({
      key: JSON.stringify([kind, change.kind, change.id, change.mark]),
      label: t(`septCheck.${kind}`, { what: isolate(what(change)), day: dayLong(t, change.day) }),
      values: details.map(
        (detail) =>
          detail[queue][kind].find(
            (one) => one.kind === change.kind && one.id === change.id && one.mark === change.mark,
          )?.sessions ?? 0,
      ),
    }));
  const spare = values((detail) => detail.main.left - detail.check.needs);
  const hasTd = details.some((detail) => detail.td.scheduled > 0 || detail.check.td.items > 0);
  const rows: SheetRow[] = [
    { key: 'all', label: weekly('septCheck.all', (detail) => detail.weekly.all), values: values((d) => d.scheduled) },
    { key: 'main-head', label: t('septCheck.mainHead') },
    { key: 'main', label: weekly('septCheck.main', (d) => d.weekly.main), values: values((d) => d.main.scheduled) },
    ...changeRows('main', 'taken'),
    ...changeRows('main', 'added'),
    { key: 'left', label: t('septCheck.left'), values: values((d) => d.main.left), strong: true },
    { key: 'needs', label: t('septCheck.needs'), values: values((d) => d.check.needs) },
    {
      key: 'spare',
      label: t(spare.some((one) => one < 0) ? 'septCheck.short' : 'septCheck.spare'),
      values: spare,
      strong: true,
    },
    ...(hasTd
      ? [
          { key: 'td-head', label: t('septCheck.tdHead') },
          { key: 'td', label: t('septCheck.tdLeft'), values: values((d) => d.td.left) },
          { key: 'td-items', label: t('septCheck.tdItems'), values: values((d) => d.check.td.items) },
          {
            key: 'td-spare',
            label: t('septCheck.tdSpare'),
            values: values((d) => d.td.left - d.check.td.items),
            strong: true,
          },
        ]
      : []),
  ];

  const { check } = first.detail;
  let last = addDays(check.before, -1);
  for (let back = 0; back < 6 && !ref.country.workingDays.includes(weekday(last)); back += 1) last = addDays(last, -1);
  const termWord = termName(t, check.term);
  const notes = [
    check.basis === 'exam-window'
      ? t('septCheck.exams', {
          term: termWord,
          day: dayLong(t, check.before),
          confidence: t(`septCheck.confidences.${check.confidence ?? 'projected'}`),
        })
      : t('septCheck.termEnd', { term: termWord, day: dayLong(t, last) }),
    t('septCheck.spareNote'),
    ...(hasTd ? [t('septCheck.tdNote')] : []),
  ];
  const packs = new Map<string, { lines: string[]; names: string[] }>();
  for (const column of columns) {
    const pack = courseSetup(context, column.courseId).pack;
    if (pack === null) continue;
    const key = `${pack.id}@${pack.release}`;
    const known = packs.get(key) ?? {
      lines: [
        `${pack.provenance.issuer} · ${pack.provenance.edition}`,
        `${isolate(pack.id)} · ${t('plan.release', { release: isolate(pack.release) })}`,
        packSource(t, pack),
      ],
      names: [],
    };
    known.names.push(isolate(column.schoolClass.name));
    packs.set(key, known);
  }
  const setup = courseSetup(context, first.courseId);
  const timetable = state.timetables.filter((one) => one.from <= day).at(-1);
  return {
    school: t('septCheck.school', {
      school: isolate(school?.name ?? ''),
      year: isolate(`${ref.year.from.slice(0, 4)}-${ref.year.to.slice(0, 4)}`),
    }),
    date: t('septCheck.date', { day: isolate(formatDay(day)) }),
    who: t('septCheck.who', {
      name: isolate(state.personal?.name?.trim() || '…………………'),
      subject: groupName(t, ref.country, { grade, subject: course.subject }),
    }),
    period: t(check.basis === 'exam-window' ? 'septCheck.period' : 'septCheck.periodEnd', {
      from: dayLong(t, day),
      to: dayLong(t, last),
      term: termWord,
    }),
    classes: columns.map((one) => isolate(one.schoolClass.name)),
    rows,
    notes,
    packs: [...packs.values()].map(({ lines, names }) => ({
      title: t('septCheck.packFor', { classes: names.join(t('septCheck.and')) }),
      lines,
    })),
    sources: t('septCheck.sources', {
      day: dayLong(t, timetable?.from ?? day),
      year: isolate(`${ref.year.from.slice(0, 4)}-${ref.year.to.slice(0, 4)}`),
      minutes: setup.sessionMinutes,
    }),
  };
}
