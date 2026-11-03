// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's charts for its exams, as the director's device works them out
// from the school's signed weeks (#601, answers 631 and 632): the school exams
// whose figures day the world's date has reached, up to their last day, and
// those whose last day it has passed, up to the year's last day (#602, answer
// 634); for each, every grade and subject the timetable gives a class that sits
// it, with the teachers it names for them, in the timetable's order, those of
// classes pinning another pack among them, as they set the same paper, and the
// pack most of those classes pin, ties to the first pinned; the classes pinning
// that pack, each named once, with their position on the figures day, or on a
// day before it the teacher's phone gives, the furthest item their signed weeks
// to then worked on (course-standings.ts), and their forecast on the last
// school day before the exam, at their own pace over the school days to that
// day, the country's working days that are school days without a closure or an
// exam for the class, each class's days counted once for an exam. A pack the
// reference does not hold, with no item, or with more than a chart holds, has
// no chart.

import {
  addDays,
  CalendarView,
  CHART_MOST,
  demoSchoolClass,
  demoSchoolPlace,
  examsFor,
  forecastAt,
  forecastDayOf,
  openDays,
  weekday,
  worldExams,
  type ChartClass,
  type Day,
  type DemoClass,
  type DemoSchool,
  type ExamChart,
  type PinnedPack,
  type WorldExam,
} from '@minhajna/core';
import { courseStandings, type StandingRecords } from '../director/course-standings';
import { termReference, type TermReference } from '../director/seeded-fill';

/** A chart as the school's records give it, before its setters, with the teachers the timetable names for it. */
export interface ChartDraft {
  readonly chart: Omit<ExamChart, 'world' | 'school' | 'setters'>;
  readonly teachers: readonly string[];
}

/** The school exams whose figures day the date has reached, up to their last day. */
export function examsOpen(reference: Pick<TermReference, 'calendar'>, date: Day): WorldExam[] {
  const { year, entries } = reference.calendar;
  return worldExams(year, entries).filter((one) => one.setBy === 'school' && one.figuresDay <= date && date <= one.to);
}

/** The school exams whose last day the date has passed, up to the year's last day. */
export function examsAfter(reference: Pick<TermReference, 'calendar'>, date: Day): WorldExam[] {
  const { year, entries } = reference.calendar;
  if (date > year.to) return [];
  return worldExams(year, entries).filter((one) => one.setBy === 'school' && one.to < date);
}

const pinKey = (pin: PinnedPack | undefined) => (pin === undefined ? '' : JSON.stringify([pin.id, pin.release]));

/** The pack most of the classes pin in the subject, ties to the first pinned, or undefined when none pins one. */
function mostPinned(classes: readonly DemoClass[], subject: string): PinnedPack | undefined {
  const counts = new Map<string, { pin: PinnedPack; count: number }>();
  for (const one of classes) {
    const pin = one.packs[subject];
    if (pin === undefined) continue;
    const held = counts.get(pinKey(pin)) ?? { pin, count: 0 };
    counts.set(pinKey(pin), { pin, count: held.count + 1 });
  }
  return [...counts.values()].reduce<{ pin: PinnedPack; count: number } | undefined>(
    (best, one) => (best === undefined || one.count > best.count ? one : best),
    undefined,
  )?.pin;
}

/** The school's classes that sit the exam. */
function sittingClasses(exam: WorldExam, school: DemoSchool): DemoClass[] {
  const where = { level: school.level, zone: school.wilaya, schoolId: school.id };
  return school.classes.filter((one) => examsFor([exam], { ...where, grade: one.grade }).length > 0);
}

/** A grade and subject the timetable gives a class sitting an exam, with those classes and their teachers. */
export interface ExamGroup {
  readonly grade: string;
  readonly subject: string;
  readonly classes: ReadonlySet<string>;
  readonly teachers: readonly string[];
}

/** Each grade and subject the timetable gives the classes sitting an exam, in the timetable's order. */
export function examGroups(exam: WorldExam, school: DemoSchool): ExamGroup[] {
  const sitting = sittingClasses(exam, school);
  const groups = new Map<string, { grade: string; subject: string; classes: Set<string>; teachers: string[] }>();
  for (const session of school.week) {
    const one = sitting.find((each) => each.id === session.classId);
    if (one === undefined) continue;
    const key = `${one.grade}\n${session.subject}`;
    const group = groups.get(key) ?? { grade: one.grade, subject: session.subject, classes: new Set(), teachers: [] };
    group.classes.add(one.id);
    if (!group.teachers.includes(session.teacherId)) group.teachers.push(session.teacherId);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The exam's charts, one for each grade and subject its sitting classes are taught. */
export function chartDrafts(
  exam: WorldExam,
  school: DemoSchool,
  records: readonly StandingRecords[],
  reference: TermReference,
  asOf: Day = exam.figuresDay,
): ChartDraft[] {
  const calendar = termReference(reference);
  const view = new CalendarView(calendar, []);
  const place = demoSchoolPlace(school);
  const standing = courseStandings(records, school, reference, asOf);
  const working = (day: Day) => calendar.country.workingDays.includes(weekday(day));
  const opens = (one?: DemoClass) => {
    const of = one === undefined ? undefined : demoSchoolClass(school, one);
    return (day: Day) => {
      if (!working(day)) return false;
      const info = view.info(day, place, of);
      return info.schoolDay && info.closure === null && info.exam === null;
    };
  };
  const pace = new Map<string, { before: number; left: number }>();
  const forecastDay = forecastDayOf(asOf, exam.from, opens());
  const drafts: ChartDraft[] = [];
  for (const { grade, subject, classes, teachers } of examGroups(exam, school)) {
    const taught = school.classes.filter((one) => classes.has(one.id));
    const pin = mostPinned(taught, subject);
    const pack = reference.packs.find((one) => one.id === pin?.id && one.release === pin.release);
    if (pin === undefined || pack === undefined || pack.items.length === 0 || pack.items.length > CHART_MOST.items)
      continue;
    const items = pack.items.map((one) => one.id);
    const named = new Set<string>();
    const rows: ChartClass[] = [];
    for (const one of taught) {
      if (pinKey(one.packs[subject]) !== pinKey(pin) || named.has(one.name)) continue;
      named.add(one.name);
      const at = items.indexOf(standing(one.id, subject)?.position?.id ?? '');
      const open = opens(one);
      const counted = pace.get(one.id) ?? {
        before: openDays(reference.calendar.year.from, asOf, open),
        left: openDays(addDays(asOf, 1), forecastDay, open),
      };
      pace.set(one.id, counted);
      const { before, left } = counted;
      const ahead = forecastAt(at, items.length, before, left);
      rows.push({ name: one.name, position: items[at] ?? null, forecast: at < 0 ? null : items[ahead] });
    }
    const { from, figuresDay, signBy } = exam;
    const chart = { exam: exam.id, subject, grade, from, figuresDay, signBy, forecastDay, pack: pin, items };
    drafts.push({ chart: { ...chart, classes: rows }, teachers });
  }
  return drafts;
}
