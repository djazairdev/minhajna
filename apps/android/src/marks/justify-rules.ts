// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «تبرير التقويم المستمر» says of a pupil (#239, Marks-pupil, answers 443
// and 454): the pupil, the class and subject with «التقويم المستمر» and the
// period; T out of the scale once every component has a mark, else «—» with how
// many are still empty; for a term, the test mean, lycée's practical work or
// oral when the formula weighs them (#240, answer 463), the exam, and the
// average by the class and subject's formula, each once the term has it; and
// each component with what was recorded, as component entry says it, and its
// mark. The classes and subjects it can be made for are those with continuous
// assessment, by class name; a term whose marks descriptive observations
// replace has none (answer 464).

import {
  componentList,
  componentPeriod,
  componentTotal,
  courseObserved,
  marksFor,
  shownMark,
  termAverage,
  termTests,
  testMean,
  type AssessmentData,
  type AveragePart,
  type Context,
  type CountryProfile,
  type Day,
} from '@minhajna/core';
import { courseLabel } from '../exams/course-label';
import type { useText } from '../text/i18n';
import { componentSheet, periodName, recordedFor, termLines } from './component-rules';
import { levelScale } from './entry-rules';
import { courseMarks } from './marks-rules';

type Translate = ReturnType<typeof useText>;

export interface JustifyRow {
  readonly id: string;
  readonly name: string;
  readonly recorded: string;
  readonly mark: string;
}

export interface JustifyPage {
  readonly pupil: string;
  readonly line: string;
  /** T, such as «13.50», or «—» while a component is empty. */
  readonly total: string;
  readonly scale: number;
  /** How many components are still empty. */
  readonly empty: number;
  /** The test mean, the exam and the average, as the term has them; null for a month or without a formula. */
  readonly parts: string | null;
  readonly rows: readonly JustifyRow[];
}

/** The courses a justification can be made for: with continuous assessment and a mark scale, by class name. */
export function justifyCourses(context: Context, data: AssessmentData): string[] {
  const { state } = context;
  return [...state.courses.values()]
    .filter((course) => {
      const room = state.classes.get(course.classId);
      if (room === undefined || levelScale(data, room.level) === null) return false;
      return termLines(context, data, course.id, 1).lines.length > 0;
    })
    .sort((a, b) => {
      const named = (id: string) => state.classes.get(id)?.name ?? '';
      return named(a.classId).localeCompare(named(b.classId), 'ar') || a.subject.localeCompare(b.subject);
    })
    .map((course) => course.id);
}

/** The pupils a justification is for: the period's list. */
export function justifyPupils(context: Context, courseId: string, term: number, month: string | undefined, today: Day) {
  const period = componentPeriod(context, term, month);
  return period === null ? [] : componentList(context, courseId, period, today);
}

const SAT = [
  { part: 'P', kind: 'practical', mark: 'marks.justify.practical', absent: 'marks.justify.practicalAbsent' },
  { part: 'O', kind: 'oral', mark: 'marks.justify.oral', absent: 'marks.justify.oralAbsent' },
  { part: 'E', kind: 'exam', mark: 'marks.justify.exam', absent: 'marks.justify.examAbsent' },
] as const;

/** The test mean, the parts sat and the average, as a line; null when the formula weighs none or none is in. */
function partsLine(
  t: Translate,
  context: Context,
  data: AssessmentData,
  courseId: string,
  term: number,
  pupilId: string,
  total: number | null,
): string | null {
  const formula = courseMarks(context.state, data, courseId, term)?.formula;
  if (formula === undefined) return null;
  const weighs = (part: AveragePart) => (formula.weights[part] ?? 0) > 0;
  const test = weighs('F') ? testMean(context, term, termTests(context, courseId, term), pupilId) : null;
  const sat = SAT.filter((one) => weighs(one.part)).map((one) => ({
    ...one,
    value: marksFor(context.state, courseId, term, { kind: one.kind }).get(pupilId),
  }));
  const known = Object.fromEntries(sat.map((one) => [one.part, typeof one.value === 'number' ? one.value : null]));
  const average = termAverage(formula, { T: total, F: test, ...known });
  const said = [
    ...(test === null ? [] : [t('marks.justify.test', { mark: shownMark(test) })]),
    ...sat.flatMap(({ value, mark, absent }) =>
      value === undefined ? [] : [value === 'absent' ? t(absent) : t(mark, { mark: shownMark(value) })],
    ),
    ...(average === null ? [] : [t('marks.justify.average', { mark: shownMark(average) })]),
  ];
  return said.length === 0 ? null : said.join(' · ');
}

/** A pupil's page; null for a course or period the justification is not made for, or a term observed instead. */
export function justifyPage(
  t: Translate,
  context: Context,
  data: AssessmentData,
  options: {
    readonly courseId: string;
    readonly term: number;
    readonly month: string | undefined;
    readonly pupilId: string;
    readonly today: Day;
    readonly profile: CountryProfile;
  },
): JustifyPage | null {
  const { courseId, term, month, pupilId, today } = options;
  const { state } = context;
  const { profile } = options;
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  const scale = room === undefined ? null : levelScale(data, room.level);
  const { lines } = termLines(context, data, courseId, term);
  if (scale === null || lines.length === 0 || componentPeriod(context, term, month) === null) return null;
  if (courseObserved(state, data, courseId, term)) return null;
  const counted = componentTotal(state, courseId, term, lines, pupilId, month);
  const rows = counted.marks.map(({ line, mark }) => {
    const sheet = componentSheet(context, data, courseId, term, line.id, month, today);
    return {
      id: line.id,
      name: sheet?.title ?? line.id,
      recorded: sheet === null ? '' : recordedFor(t, context, courseId, sheet, pupilId).text,
      mark: `${mark === null ? '—' : shownMark(mark)} / ${line.points}`,
    };
  });
  const period = periodName(
    t,
    profile.months,
    { kind: 'component', componentId: '', ...(month !== undefined && { month }) },
    term,
  );
  return {
    pupil: state.pupils.get(pupilId)?.name ?? pupilId,
    line: t('marks.justify.line', { class: courseLabel(t, state, profile, courseId, true), period }),
    total: counted.total === null ? '—' : shownMark(counted.total),
    scale,
    empty: counted.empty,
    parts: month === undefined ? partsLine(t, context, data, courseId, term, pupilId, counted.total) : null,
    rows,
  };
}
