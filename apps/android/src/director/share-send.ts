// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's share of the totals, sent from the director's device (#596,
// answer 628): for a school whose key the device started or was added to, never
// a seeded school's, whose share the starter's device sends from the term
// generator alone, so no share mixes generated weeks with signed ones; with the
// school key held, once the dashboard has read the school's signed weeks, for
// every announced day of the world's calendar after its first term's end, when
// a world starts, that the world's date has reached, the share prepared from
// those weeks for the term the day falls in (total-shares.ts), each course's
// weeks counting under the keys that signed them on its teachers' channels,
// with each subject's staffing as the timetable shows it (school-dashboard.ts),
// and put on the server under the share's ID, so a share sent again replaces
// the first. A day the server does not take, not announced or not reached on
// its side, is passed over; any other answer throws, with world-session.ts's
// codes, and the dashboard tries again when it next reads.

import {
  announcedDaysOf,
  prepareShare,
  schoolStaffing,
  type Day,
  type DemoSchool,
  type SchoolCalendar,
  type TotalsShare,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { caKey } from '../school/space-read';
import type { ClassRecords } from './records-session';
import type { IssueDesk } from './school-desk';

type ShareWorld = Pick<OpenWorld, 'world' | 'date'>;

/** The announced days the world's date has reached, after the first term's end, each with its term's first day. */
export function sharedDays(calendar: SchoolCalendar, date: Day): { day: Day; from: Day }[] {
  const { terms } = calendar.year;
  if (terms.length === 0) return [];
  return announcedDaysOf(calendar.year, calendar.entries, terms[0].to)
    .filter((day) => day <= date)
    .flatMap((day) => {
      const term = terms.filter((one) => one.from <= day).at(-1);
      return term === undefined ? [] : [{ day, from: term.from }];
    });
}

/** The school's shares for the announced days reached, prepared from its records and put on the server. */
export async function sendShares(
  world: ShareWorld,
  desk: IssueDesk,
  school: DemoSchool,
  records: readonly ClassRecords[],
  calendar: SchoolCalendar,
  kit: WorldKit,
  send: Send,
): Promise<TotalsShare[]> {
  const days = sharedDays(calendar, world.date);
  if (days.length === 0 || desk.held.seeded === true) return [];
  const courses = records.flatMap((one) => one.courses);
  const weeks = courses.flatMap((course) => course.weeks.map((one) => one.signed));
  const signers: Record<string, string[]> = {};
  for (const course of courses) {
    const keys = new Set([
      ...(signers[course.course] ?? []),
      ...course.weeks.map((one) => one.signed.certificate.publicKey),
    ]);
    signers[course.course] = [...keys];
  }
  const ca = { world: world.world, key: await caKey(world.world, send), checker: kit };
  const staffing = schoolStaffing(school);
  const sent: TotalsShare[] = [];
  for (const { day, from } of days) {
    const input = { school: desk.opened, day, from, directorate: school.directorateId, weeks, signers, ca, staffing };
    const share = await kitStep(() => prepareShare(input, desk.crypto));
    const answer = await send({ method: 'PUT', path: `/worlds/${world.world}/totals/${day}/shares`, body: share });
    if (answer.status === 422) continue;
    if (answer.status !== 200 && answer.status !== 201) throw unexpected(answer);
    sent.push(share);
  }
  return sent;
}
