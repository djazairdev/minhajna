// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind «إضافة حصة» (#228, Catchup-add, answers 354 and 357):
// the class's school, the slots of the teacher's week that have a bell time
// there on a day, a time as the lists say it, the day then the bell time,
// never a clock time of its own (PRD §3.3), and whether slots of two
// schools meet by their bell times (answer 358), and a scheduled support
// session as the extra-session form fills it in (answer 362).

import {
  clockMinutes,
  slotKey,
  weekGrid,
  type Day,
  type Meets,
  type School,
  type Slot,
  type State,
} from '@minhajna/core';
import type { AppData } from '../storage/AppData';
import { currentLanguage, type useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';
import { dayName } from '../today/DayMark';

type Translate = ReturnType<typeof useText>;
type Data = Pick<AppData, 'state' | 'bells' | 'calendar' | 'profile'>;

/** The school of a course's class. */
export function courseSchool(state: State, courseId: string): School | undefined {
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  return schoolClass && state.schools.get(schoolClass.schoolId);
}

/** The slots of the teacher's week that have a bell time at `school` on `day`. */
export function timedSlots(data: Data, school: School, day: Day): Slot[] {
  return weekGrid(data.profile, data.state.timetables.at(-1)?.version.options).slots.filter(
    (slot) => sessionTime(data, school, slot, day) !== null,
  );
}

/** The day and the bell time, or the slot's name when it has no time. */
export function whenLine(
  t: Translate,
  data: Data,
  school: School | undefined,
  day: Day,
  slot: Slot,
  direction: 'rtl' | 'ltr',
): string {
  const time = sessionTime(data, school, slot, day);
  const at =
    time === null
      ? t(slot.half === 'morning' ? 'week.slotMorning' : 'week.slotAfternoon', { index: slot.index })
      : span(time.from, time.to, direction);
  return `${dayName(t, day, currentLanguage(), data.profile)}\u00a0·\u00a0${at}`;
}

/**
 * Slots of one school meet by their number; slots of two schools when their
 * bell times overlap, or by number without times.
 */
export function meetsByBells(data: Data): Meets {
  return (day, a, b) => {
    const first = sessionTime(data, a.school, a.slot, day);
    const second = sessionTime(data, b.school, b.slot, day);
    if (a.school.id === b.school.id || first === null || second === null) return slotKey(a.slot) === slotKey(b.slot);
    return clockMinutes(first.from) < clockMinutes(second.to) && clockMinutes(second.from) < clockMinutes(first.to);
  };
}

/**
 * A scheduled support session as the extra-session form takes it: its day
 * and its slot's bell times, or none to type.
 */
export function scheduledLog(
  data: Data,
  id: string | undefined,
): { readonly id: string; readonly day: Day; readonly from: string; readonly to: string } | undefined {
  const catchUp = id === undefined ? undefined : data.state.catchUps.get(id);
  if (catchUp?.kind !== 'support') return undefined;
  const time = sessionTime(data, courseSchool(data.state, catchUp.courseId), catchUp.slot, catchUp.day);
  return { id: catchUp.id, day: catchUp.day, from: time?.from ?? '', to: time?.to ?? '' };
}
