// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher's threshold pages say of a room (#601, answer 633): an exam
// by its term, the mock exam and the BEM a demo world adds by their names, a
// plan item as the pack the world's reference holds names it, or by its place
// in the plan when the reference does not hold the pack, an ID the reference
// does not name kept apart from the words around it, where the cut stands, with
// the day the cut proposed was first signed, whether it waits for this phone,
// each setter's latest cut with its day, the item every class reached on the
// figures day, and the chart of each class's item reached and forecast, each as
// its place in the plan, none counting as 0.

import type { Day, ExamChart, ExamRoom } from '@minhajna/core';
import type { TFunction } from 'i18next';
import { termName } from '../director/dashboard-text';
import type { TermReference } from '../director/seeded-fill';
import type { ChartSpec } from '../drawing/drawing-kit';
import { subjectName } from '../extra/extra-rules';
import { gradeName } from '../setup/names';
import { isolate } from '../week/grid-labels';
import type { TeacherRoom } from './teacher-rooms';

/** A room's key in a joined page's view: its exam, subject and grade. */
export const roomId = (room: Pick<ExamRoom, 'exam' | 'subject' | 'grade'>) =>
  JSON.stringify([room.exam, room.subject, room.grade]);

/** The exams a demo world adds above the school, by their IDs. */
const MADE = ['mock', 'bem'] as const;

/** An exam by its term, the directorate's mock exam and the BEM by their names, or another by its ID. */
export function examName(t: TFunction, exam: string): string {
  const made = MADE.find((one) => one === exam);
  if (made !== undefined) return t(`demo.threshold.exams.${made}`);
  const term = /^term-(\d+)/u.exec(exam)?.[1];
  return term === undefined ? isolate(exam) : t('demo.threshold.termExam', { term: termName(t, Number(term)) });
}

/** An exam's heading: its name, subject and grade, named by the reference when it is there. */
export function headText(
  t: TFunction,
  chart: Pick<ExamChart, 'exam' | 'subject' | 'grade'>,
  reference: TermReference | undefined,
): string {
  const named = (code: string, name: string | undefined) =>
    name === undefined || name === code ? isolate(code) : name;
  const subject = named(chart.subject, reference && subjectName(reference.profile, chart.subject));
  const grade = named(chart.grade, reference && gradeName(reference.profile, chart.grade));
  return t('demo.threshold.head', { exam: examName(t, chart.exam), subject, grade });
}

/** A plan item's name, quoted, as the room's pack names it, or by its place in the plan. */
export function itemNamer(
  t: TFunction,
  chart: Pick<ExamChart, 'pack' | 'items'>,
  packs: TermReference['packs'] | undefined,
) {
  const pack = packs?.find((one) => one.id === chart.pack.id && one.release === chart.pack.release);
  const titles = new Map(pack?.items.map((one) => [one.id, one.title]));
  return (item: string | null): string => {
    if (item === null) return t('demo.threshold.noItem');
    const title = titles.get(item) ?? t('demo.threshold.itemAt', { n: chart.items.indexOf(item) + 1 });
    return t('demo.threshold.quoted', { item: isolate(title) });
  };
}

/** Whether the cut proposed waits for this phone's signature: unsettled, and this phone a setter whose cut differs. */
export function awaitingMine({ state, mine }: Pick<TeacherRoom, 'state' | 'mine'>): boolean {
  const { settled, proposed } = state;
  return settled === null && proposed !== null && mine !== null && state.signed.get(mine.assignment) !== proposed.item;
}

/** Where a room's cut stands, as one line. */
export function stateText(
  t: TFunction,
  room: TeacherRoom,
  item: (id: string | null) => string,
  dayText: (day: Day) => string,
): string {
  const { state, chart } = room;
  const { settled, proposed } = state;
  if (settled?.by === 'director') {
    return settled.item === null
      ? t('demo.threshold.state.directorNone')
      : t('demo.threshold.state.director', { item: item(settled.item) });
  }
  if (settled !== null && settled.item !== null) return t('demo.threshold.state.settled', { item: item(settled.item) });
  if (state.director) return t('demo.threshold.state.toDirector');
  if (proposed === null) return t('demo.threshold.state.none');
  const by = chart.setters.find((one) => one.assignment === proposed.by)?.name ?? '';
  const key = awaitingMine(room) ? 'awaiting' : 'proposed';
  return t(`demo.threshold.state.${key}`, { item: item(proposed.item), name: isolate(by), day: dayText(proposed.day) });
}

/** Each setter's latest cut with its day, as one line each by their assignment, in the chart's order. */
export function setterLines(
  t: TFunction,
  room: TeacherRoom,
  item: (id: string | null) => string,
  dayText: (day: Day) => string,
): { readonly key: string; readonly line: string }[] {
  return room.chart.setters.map(({ assignment: key, name: who }) => {
    const [cut, day] = [room.state.signed.get(key), room.state.days.get(key)];
    const name = isolate(who);
    if (cut === undefined || day === undefined) return { key, line: t('demo.threshold.setter.waiting', { name }) };
    if (cut === null) return { key, line: t('demo.threshold.setter.none', { name, day: dayText(day) }) };
    return { key, line: t('demo.threshold.setter.cut', { name, item: item(cut), day: dayText(day) }) };
  });
}

/** The earliest item every class of the chart reached on the figures day, or null when one reached none. */
export function everyReached(chart: ExamChart): string | null {
  const places = chart.classes.map((one) => (one.position === null ? -1 : chart.items.indexOf(one.position)));
  const lowest = Math.min(...places);
  return places.length === 0 || lowest < 0 ? null : chart.items[lowest];
}

/** The chart of each class's item reached and forecast, as their places in the plan. */
export function chartSpec(t: TFunction, chart: ExamChart, day: string): Omit<ChartSpec, 'rightToLeft'> {
  const place = (item: string | null) => (item === null ? 0 : chart.items.indexOf(item) + 1);
  return {
    kind: 'bar',
    label: t('demo.threshold.chart', { day }),
    categories: chart.classes.map((one) => one.name),
    series: [
      { name: t('demo.threshold.reached'), values: chart.classes.map((one) => place(one.position)) },
      { name: t('demo.threshold.forecast'), values: chart.classes.map((one) => place(one.forecast)) },
    ],
  };
}
