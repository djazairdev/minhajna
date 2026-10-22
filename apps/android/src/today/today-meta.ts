// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session card's head on Today: the class, with the group for a half class or
// the year in a joint class (#43), the time from the school's bells, or the
// slot's name without them, and the subject where it helps. The next session's
// line, on a day with none left (#36), says its class, slot and day.

import {
  courseGrade,
  isJoint,
  type BellData,
  type CalendarEntry,
  type CountryProfile,
  type Session,
  type State,
  type TodaySession,
} from '@minhajna/core';
import type { SessionMeta } from '../components/SessionCard';
import { localized, yearShort } from '../setup/names';
import type { Language, useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';
import { slotSpoken } from '../week/grid-labels';
import { dayName } from './DayMark';

export type MetaData = {
  readonly state: State;
  readonly profile: CountryProfile;
  readonly bells: BellData;
  readonly calendar: readonly CalendarEntry[];
};

export function sessionMeta(
  data: MetaData,
  t: ReturnType<typeof useText>,
  direction: 'rtl' | 'ltr',
  item: TodaySession,
  withSubject: boolean,
): SessionMeta {
  const { state, profile, bells, calendar } = data;
  const schoolClass = state.classes.get(item.course.classId);
  const group = schoolClass?.groups.find((candidate) => candidate.id === item.session.groupId);
  const year = schoolClass && isJoint(schoolClass) ? yearShort(t, courseGrade(item.course, schoolClass)) : null;
  const className = [schoolClass?.name ?? '', group !== undefined && group.kind !== 'whole' ? group.name : null, year]
    .filter(Boolean)
    .join(' · ');
  const school = schoolClass && state.schools.get(schoolClass.schoolId);
  const time = sessionTime({ bells, calendar, state }, school, item.session.slot, item.session.day);
  const subject = profile.subjects.find((candidate) => candidate.code === item.course.subject);
  return {
    className,
    slot: time === null ? slotSpoken(t, item.session.slot) : span(time.from, time.to, direction),
    ...(withSubject && { subject: subject ? localized(subject.name) : item.course.subject }),
  };
}

/** The next session's line: its class, its slot and its day. */
export function nextLine(
  data: MetaData,
  t: ReturnType<typeof useText>,
  direction: 'rtl' | 'ltr',
  language: Language,
  session: Session,
): string {
  const course = data.state.courses.get(session.courseId);
  const item = course && {
    session,
    course,
    status: 'awaiting' as const,
    proposal: null,
    record: null,
    packMissing: false,
  };
  const meta = item && sessionMeta(data, t, direction, item, false);
  return [meta?.className, meta?.slot, dayName(t, session.day, language, data.profile)].filter(Boolean).join(' · ');
}
