// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the threshold pages, the teacher's and the director's D-Threshold, say
// of a school exam's cut after the exam (#602, T-Threshold-after, R-3.3-39,
// R-7.10-04, answer 634): an exam is over from the day after its last day as
// the world's calendar now has it, an exam the calendar no longer holds never;
// and its cut as published: the cut that applied, signed by every setter or
// decided by the director, or none, either because the director decided no cut
// or because none was settled, so the paper was set as usual.

import type { Day, ExamChart, WorldExam } from '@minhajna/core';
import type { TFunction } from 'i18next';
import type { TeacherRoom } from './teacher-rooms';

/** Whether a room's exam is over on the world's date: past its last day as the calendar now has it. */
export function examOver(chart: Pick<ExamChart, 'exam'>, exams: ReadonlyMap<string, WorldExam>, date: Day): boolean {
  const exam = exams.get(chart.exam);
  return exam !== undefined && exam.to < date;
}

/** The cut as published after the exam, as one line. */
export function publishedText(
  t: TFunction,
  { state }: Pick<TeacherRoom, 'state'>,
  item: (id: string | null) => string,
): string {
  const { settled } = state;
  if (settled === null) return t('demo.threshold.after.none');
  if (settled.item === null) return t('demo.threshold.after.directorNone');
  return t(`demo.threshold.after.${settled.by}`, { item: item(settled.item) });
}
