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
// weeks counting under the keys that signed them on the channels of the
// teachers the timetable names for it, so a week another teacher signed for a
// course not theirs never counts, with each subject's staffing as the timetable
// shows it (school-dashboard.ts), and how far each grade got, from each
// course's plan as the timetable and the classes' pinned packs give it
// (share-plans.ts, answer 631), each class's position taken over the year's
// weeks up to the day, and put on the server under the share's ID, so a share
// sent again replaces the first; a share the same as the last one put for its
// day in the last ten minutes is not put again. A day the server does not take,
// not announced or not reached on its side, is passed over; any other answer
// throws, with world-session.ts's codes, and the dashboard tries again when it
// next reads.

import {
  announcedDaysOf,
  courseId,
  prepareShare,
  schoolPlans,
  schoolStaffing,
  type Day,
  type DemoSchool,
  type PinnedPack,
  type SchoolCalendar,
  type TotalsShare,
  type WorldMac,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { caKey } from '../school/space-read';
import type { ClassRecords } from './records-session';
import type { TermReference } from './seeded-fill';
import type { IssueDesk } from './school-desk';

type ShareWorld = Pick<OpenWorld, 'world' | 'date'>;

/** How long a share put stays remembered, so one the same is put again after it, as a server may lose it. */
const REMEMBERED_MS = 10 * 60 * 1000;
/** The last share put for each world, day and ID, as JSON, and when, so one the same is not put again meanwhile. */
const lastPut = new Map<string, { readonly text: string; readonly at: number }>();

/**
 * Puts a share for its day, unless the same was put in the last ten minutes: answers whether it was put, the same,
 * or refused for a day the server does not take; any other answer throws.
 */
export async function putShare(world: string, share: TotalsShare, send: Send): Promise<'put' | 'same' | 'refused'> {
  const [key, text] = [JSON.stringify([world, share.day, share.id]), JSON.stringify(share)];
  const last = lastPut.get(key);
  if (last?.text === text && Date.now() - last.at <= REMEMBERED_MS) return 'same';
  const answer = await send({ method: 'PUT', path: `/worlds/${world}/totals/${share.day}/shares`, body: share });
  if (answer.status === 422) return 'refused';
  if (answer.status !== 200 && answer.status !== 201) throw unexpected(answer);
  lastPut.set(key, { text, at: Date.now() });
  return 'put';
}

/** By course, the keys its records were signed with on the channels of the teachers the timetable names for it. */
export async function courseSigners(
  space: string,
  school: Pick<DemoSchool, 'classes' | 'week'>,
  records: readonly ClassRecords[],
  mac: WorldMac,
): Promise<Record<string, string[]>> {
  const made = new Map<string, string>();
  const teachersOf = new Map<string, Set<string>>();
  for (const session of school.week) {
    const name = school.classes.find((one) => one.id === session.classId)?.name;
    if (name === undefined) continue;
    const at = `${session.classId}\n${session.subject}`;
    const course = made.get(at) ?? (await courseId(space, name, session.subject, mac));
    made.set(at, course);
    teachersOf.set(course, (teachersOf.get(course) ?? new Set()).add(session.teacherId));
  }
  const signers: Record<string, string[]> = {};
  for (const record of records.flatMap((one) => one.courses)) {
    const teacher = record.key.slice(0, record.key.indexOf('\n'));
    if (teachersOf.get(record.course)?.has(teacher) !== true) continue;
    const keys = record.weeks.map((one) => one.signed.certificate.publicKey);
    signers[record.course] = [...new Set([...(signers[record.course] ?? []), ...keys])];
  }
  return signers;
}

/** The announced days the world's date has reached, after the first term's end, each with its term's first day. */
export function sharedDays(calendar: SchoolCalendar, date: Day): { day: Day; from: Day }[] {
  const { terms } = calendar.year;
  if (terms.length === 0) return [];
  return announcedDaysOf(calendar.year, calendar.entries, terms[0].to)
    .filter((day) => day <= date)
    .flatMap((day) => {
      const from = termStart(calendar, day);
      return from === null ? [] : [{ day, from }];
    });
}

/** The first day of the term a day falls in: the latest that has begun by then, or null before the first. */
export function termStart(calendar: SchoolCalendar, day: Day): Day | null {
  return calendar.year.terms.filter((one) => one.from <= day).at(-1)?.from ?? null;
}

/** The school's shares for the announced days reached, prepared from its records and put on the server. */
export async function sendShares(
  world: ShareWorld,
  desk: IssueDesk,
  school: DemoSchool,
  records: readonly ClassRecords[],
  reference: Pick<TermReference, 'calendar' | 'packs'>,
  kit: WorldKit,
  send: Send,
): Promise<TotalsShare[]> {
  const { calendar, packs } = reference;
  const days = sharedDays(calendar, world.date);
  if (days.length === 0 || desk.held.seeded === true) return [];
  const courses = records.flatMap((one) => one.courses);
  const weeks = courses.flatMap((course) => course.weeks.map((one) => one.signed));
  const signers = await kitStep(() => courseSigners(desk.held.school, school, records, kit.mac));
  const ca = { world: world.world, key: await caKey(world.world, send), checker: kit };
  const staffing = schoolStaffing(school);
  const itemsOf = ({ id, release }: PinnedPack) =>
    packs.find((pack) => pack.id === id && pack.release === release)?.items.map((item) => item.id);
  const plans = await kitStep(() => schoolPlans(desk.held.school, school, itemsOf, kit.mac));
  const yearFrom = calendar.year.from;
  const sent: TotalsShare[] = [];
  for (const { day, from } of days) {
    const input = { school: desk.opened, day, from, yearFrom, directorate: school.directorateId, weeks, signers };
    const share = await kitStep(() => prepareShare({ ...input, ca, staffing, plans }, desk.crypto));
    if ((await putShare(world.world, share, send)) !== 'refused') sent.push(share);
  }
  return sent;
}
