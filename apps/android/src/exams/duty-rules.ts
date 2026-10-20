// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What an exam-week entry says (#221, Today-exams, answer 270): the days
// its form can choose, those an exam window of one of the teacher's
// classes covers; and each entry's lines, its kind, its times as the clock
// was typed, and the room or the classes sitting a class exam.

import { addDays, examWindows, type Context, type Day, type ExamDuty } from '@minhajna/core';
import { span } from '../times/TimeTable';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { courseLabel } from './course-label';

type Translate = ReturnType<typeof useText>;

/** Every day an exam window of the teacher's classes covers, in the school year. */
export function examDays(context: Context): ReadonlySet<Day> {
  const { year } = context.ref;
  const days = new Set<Day>();
  for (const entry of examWindows(context)) {
    for (let day = entry.from; day <= entry.to; day = addDays(day, 1)) {
      if (day >= year.from && day <= year.to) days.add(day);
    }
  }
  return days;
}

export interface DutyText {
  readonly kind: string;
  readonly time: string;
  readonly line: string | null;
}

/** «حراسة», «08:00 – 10:00», and «القاعة 5» or the classes, «4م1، 4م2». */
export function dutyText(
  t: Translate,
  context: Context,
  duty: ExamDuty,
  direction: 'rtl' | 'ltr',
  comma: string,
): DutyText {
  const room = duty.room === undefined ? null : t('duties.roomLine', { room: isolate(duty.room) });
  const classes = (duty.courseIds ?? [])
    .map((id) => courseLabel(t, context.state, context.ref.country, id))
    .join(comma);
  return {
    kind: t(`duties.kinds.${duty.kind}`),
    time: span(duty.from, duty.to, direction),
    line: [classes === '' ? null : classes, room].filter((part) => part !== null).join(' · ') || null,
  };
}
