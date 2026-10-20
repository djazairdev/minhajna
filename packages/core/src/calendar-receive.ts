// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson } from './canonical.ts';
import { setCalendarEntry, type CalendarMutation } from './calendar-edit.ts';
import { CalendarNoticeError, type CalendarNotice } from './calendar-notice-read.ts';
import type { Context } from './context.ts';
import type { CalendarEntry } from './reference.ts';
import { appliesTo } from './calendar.ts';
import { classGrades, forGrade } from './joint.ts';
import { replacesReceived } from './calendar-received-match.ts';

/** An import is either new, already present, or a conflict requiring review outside this import. */
export type ReceivedNotice =
  | {
      readonly status: 'new';
      readonly event: CalendarMutation;
      readonly entry: CalendarEntry;
      readonly match: 'code' | 'name' | 'zone';
    }
  | { readonly status: 'duplicate'; readonly entry: CalendarEntry };

/** Bind a portable school description, never another phone's local school ID, after explicit teacher review. */
export function receiveCalendarNotice(
  context: Context,
  notice: CalendarNotice,
  schoolId: string,
  acknowledged: boolean,
): ReceivedNotice {
  if (!acknowledged) throw new CalendarNoticeError('acknowledge');
  const school = context.state.schools.get(schoolId);
  if (school === undefined || notice.country !== context.ref.country.code || notice.year !== context.ref.year.id)
    throw new CalendarNoticeError('scope');
  const classes = [...context.state.classes.values()].filter((one) => one.schoolId === schoolId);
  if (notice.entry.levels !== undefined || notice.entry.grades !== undefined) {
    const scope = { ...notice.entry, ...(notice.entry.layer === 'school' && { schoolId }) };
    if (!classes.some((one) => classGrades(one).some((grade) => appliesTo(scope, school, forGrade(one, grade)))))
      throw new CalendarNoticeError('scope');
  }
  let match: 'code' | 'name' | 'zone' = 'zone';
  if (notice.entry.layer === 'zone') {
    if (school.zone === undefined || school.zone !== notice.entry.zone) throw new CalendarNoticeError('scope');
  } else {
    const place = notice.school;
    if (place === undefined || school.zone !== place.zone) throw new CalendarNoticeError('scope');
    if (school.code !== undefined && place.code !== undefined) {
      if (school.code !== place.code) throw new CalendarNoticeError('scope');
      match = 'code';
    } else {
      if (school.name.trim() !== place.name) throw new CalendarNoticeError('scope');
      match = 'name';
    }
  }
  const entry: CalendarEntry = {
    ...notice.entry,
    ...(notice.entry.layer === 'school' && { schoolId }),
    received: { sender: notice.sender, ...(notice.school !== undefined && { school: notice.school }) },
  };
  const base = context.ref.calendar.find((one) => one.id === entry.id);
  if (base !== undefined) {
    if (!replacesReceived(base, entry)) throw new CalendarNoticeError('conflict');
    return { status: 'duplicate', entry: base };
  }
  const old = context.state.calendar.find((one) => one.id === entry.id);
  if (old !== undefined) {
    const content = (one: CalendarEntry) => canonicalJson({ ...one, received: undefined });
    if (content(old) !== content(entry)) throw new CalendarNoticeError('conflict');
    return { status: 'duplicate', entry: old };
  }
  const { received, ...local } = entry;
  const validated = setCalendarEntry(context, local);
  if (validated.kind !== 'calendar.set') throw new CalendarNoticeError('invalid');
  return {
    status: 'new',
    event: { kind: 'calendar.set', entry: { ...validated.entry, received: received! } },
    entry,
    match,
  };
}
