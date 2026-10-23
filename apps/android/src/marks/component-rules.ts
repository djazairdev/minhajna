// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What entering a component's marks reads (#239, answers 442 and 451): the
// period, the term or, in primary, a month of it; the sheet, out of the
// component's points, for the pupils on the period's list; what was recorded
// that the component is set beside, said under the current pupil, with the
// attendance proposal when the setup takes it from the roll-call book; and how
// many of the term's component cells are filled, for the hub, a mark above
// points since lowered left out (answer 452).

import {
  attendanceProposal,
  componentEvidence,
  componentList,
  componentPeriod,
  evidence,
  homeworkEvidence,
  monthOf,
  termMonths,
  type AssessmentData,
  type CountryProfile,
  type Context,
  type Day,
  type MarkTarget,
  type Period,
  type SetupLine,
} from '@minhajna/core';
import { useMemo } from 'react';
import { currentLanguage, type useText } from '../text/i18n';
import { entryDone, type EntrySheet } from './entry-rules';
import { courseMarks, lineName, termWord } from './marks-rules';

type Translate = ReturnType<typeof useText>;

export interface ComponentSheet extends EntrySheet {
  readonly line: SetupLine;
  readonly period: Period;
  /** Whether the setup takes attendance from the roll-call book. */
  readonly rollCall: boolean;
}

/** Whether a sheet is a component's. */
export function isComponent(sheet: EntrySheet): sheet is ComponentSheet {
  return sheet.target.kind === 'component';
}

/** A component's period in words: its month, or the term. */
export function periodName(t: Translate, months: CountryProfile['months'], target: MarkTarget, term: number): string {
  if (target.kind !== 'component' || target.month === undefined) return termWord(t, term);
  return months?.[Number(target.month.slice(5, 7)) - 1]?.[currentLanguage()] ?? target.month;
}

/** Whether a level keeps its component marks month by month: primary does. */
export function monthly(level: string): boolean {
  return level === 'primary';
}

/** The months a course's component marks are kept by in a term; none when by the term. */
export function periodMonths(context: Context, courseId: string, term: number): string[] {
  const course = context.state.courses.get(courseId);
  const room = course && context.state.classes.get(course.classId);
  return room !== undefined && monthly(room.level) ? termMonths(context, term) : [];
}

/** The month component entry opens on: today's within the term, else its first. */
export function openingMonth(months: readonly string[], today: Day): string | undefined {
  return months.find((month) => month === monthOf(today)) ?? months[0];
}

/** The term's setup lines for a course; none without continuous assessment. */
export function termLines(context: Context, data: AssessmentData, courseId: string, term: number) {
  const assessment = courseMarks(context.state, data, courseId, term)?.assessment ?? null;
  return { lines: assessment?.lines ?? [], rollCall: assessment?.rollCall ?? false };
}

/** A component's sheet for a period; null for an unknown component or a month the course does not keep. */
export function componentSheet(
  context: Context,
  data: AssessmentData,
  courseId: string,
  term: number,
  componentId: string,
  month: string | undefined,
  today: Day,
): ComponentSheet | null {
  const months = periodMonths(context, courseId, term);
  if (months.length === 0 ? month !== undefined : month === undefined || !months.includes(month)) return null;
  const { lines, rollCall } = termLines(context, data, courseId, term);
  const line = lines.find((one) => one.id === componentId);
  const period = componentPeriod(context, term, month);
  if (line === undefined || period === null) return null;
  const target: MarkTarget = { kind: 'component', componentId, ...(month !== undefined && { month }) };
  const named = componentList(context, courseId, period, today).map((id) => ({
    id,
    name: context.state.pupils.get(id)?.name ?? '',
  }));
  return { target, title: lineName(line), day: period.to, max: line.points, listed: named, line, period, rollCall };
}

export interface ComponentEvidenceLine {
  /** What was recorded, then the attendance proposal on a line of its own when there is one. */
  readonly text: string;
  /** The attendance proposal, when the setup takes it from the roll-call book. */
  readonly proposed: number | null;
}

/** What was recorded for a pupil that a component is set beside, in words. */
export function evidenceLine(
  t: Translate,
  context: Context,
  courseId: string,
  sheet: ComponentSheet,
  pupilId: string,
): ComponentEvidenceLine {
  const { from, to } = sheet.period;
  const kind = componentEvidence(sheet.line);
  const taps = evidence(context.state, courseId, pupilId, from, to);
  if (kind === 'participation')
    return { text: t('marks.componentMarks.participation', { n: taps.participation }), proposed: null };
  if (kind === 'homework') {
    const said = homeworkEvidence(context, courseId, pupilId, sheet.period);
    return { text: t('marks.componentMarks.homework', { ...said }), proposed: null };
  }
  if (kind === 'notebook')
    return { text: t('marks.componentMarks.notebook', { n: taps.notebookIncomplete }), proposed: null };
  if (kind === 'attendance') {
    const classId = context.state.courses.get(courseId)?.classId ?? '';
    const counted = attendanceProposal(context, classId, pupilId, from, to, sheet.max);
    const text = t('marks.componentMarks.attendance', { ...counted, behaviour: taps.behaviour });
    const proposed = sheet.rollCall ? counted.proposed : null;
    const line = proposed === null ? '' : `\n${t('marks.componentMarks.proposed', { mark: proposed })}`;
    return { text: text + line, proposed };
  }
  return { text: t('marks.componentMarks.nothing'), proposed: null };
}

/** The current pupil's evidence on a component's sheet, worked out again only when they or the records change. */
export function useEvidence(
  t: Translate,
  context: Context,
  courseId: string,
  sheet: EntrySheet | null,
  pupilId: string | undefined,
): ComponentEvidenceLine | null {
  return useMemo(
    () =>
      pupilId !== undefined && sheet !== null && isComponent(sheet)
        ? evidenceLine(t, context, courseId, sheet, pupilId)
        : null,
    [t, context, courseId, sheet, pupilId],
  );
}

/** How many of the term's component cells are filled, over every component and period. */
export function componentProgress(
  context: Context,
  data: AssessmentData,
  courseId: string,
  term: number,
  today: Day,
): { readonly done: number; readonly total: number } {
  const months = periodMonths(context, courseId, term);
  let done = 0;
  let total = 0;
  for (const line of termLines(context, data, courseId, term).lines) {
    for (const month of months.length === 0 ? [undefined] : months) {
      const sheet = componentSheet(context, data, courseId, term, line.id, month, today);
      if (sheet === null) continue;
      done += entryDone(context, courseId, term, sheet).done;
      total += sheet.listed.length;
    }
  }
  return { done, total };
}
