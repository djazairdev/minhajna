// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What capture during the session says (#239, Capture, answers 441, 449 and
// 450): the four items in the board's order; a tile's value, «+2» for taps or
// the state's words, nothing at zero; today's session line, «حصة اليوم ·
// 08:00 – 09:00», with no time when the school has no bell times; and a chip
// for each of today's sessions, its time, else «الحصة 2».

import { CAPTURE_ITEMS, type CaptureItem, type SessionRef } from '@minhajna/core';
import type { AppData } from '../storage/AppData';
import type { useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';

type Translate = ReturnType<typeof useText>;

export const ITEMS: readonly CaptureItem[] = CAPTURE_ITEMS;

const STATES = {
  homework: ['marks.during.state.notDone', 'marks.during.state.helped'],
  notebook: ['marks.during.state.incomplete'],
} as const;

/** A tile's value: the taps, or the state's words; null at zero. */
export function captureValue(t: Translate, item: CaptureItem, value: number): string | null {
  if (value === 0) return null;
  if (item === 'homework' || item === 'notebook') {
    const key = STATES[item][value - 1];
    return key === undefined ? null : t(key);
  }
  return t('marks.during.taps', { n: value });
}

function timeOf(data: Pick<AppData, 'state' | 'bells' | 'calendar'>, session: SessionRef) {
  const course = data.state.courses.get(session.courseId);
  const schoolClass = course && data.state.classes.get(course.classId);
  const school = schoolClass && data.state.schools.get(schoolClass.schoolId);
  return sessionTime(data, school, session.slot, session.day);
}

/** Today's session, with its bell time when the school has one. */
export function captureLine(
  t: Translate,
  data: Pick<AppData, 'state' | 'bells' | 'calendar'>,
  session: SessionRef,
): string {
  const time = timeOf(data, session);
  return time === null ? t('marks.during.today') : t('marks.during.todayAt', { from: time.from, to: time.to });
}

/** A chip for one of today's sessions: its bell time, else its place in the day. */
export function sessionChip(
  t: Translate,
  data: Pick<AppData, 'state' | 'bells' | 'calendar'>,
  session: SessionRef,
  n: number,
): string {
  const time = timeOf(data, session);
  return time === null
    ? t('marks.during.sessionN', { n })
    : t('marks.during.sessionAt', { from: time.from, to: time.to });
}
