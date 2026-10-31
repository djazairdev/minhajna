// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing a course's week in a demo world (#582, Week-sign, §3.3, §5.5,
// R-3.3-26 to R-3.3-29, answer 610). The teacher's channel gives the timetable
// parts, the weeks this device signed (week-record.ts) and the visas on them
// (week-visa.ts, #585). The week runs from the school's first working day on or
// before the world's date to that date, its last working day closing it on the
// pages, and each working day's sessions are those of the part in force that
// day, for a one-day part that day's alone; a class, by its name key, and a
// subject, by its country code, or by its name key without one, make one
// course, under the class and subject as first written, so a week signed is
// found again when a later version names its subject in another language. A
// session of week A or B is listed with its week, since a world does not say
// which week this is. A subject's country code comes from its name in any
// language or its code; without one, the week cannot be signed. Each session is
// held, not held or awaiting confirmation, as confirmed on the page and kept in
// memory, by join, school, course and week, for the last world a session was
// confirmed in, until the week is signed; one not confirmed is signed awaiting,
// never an absence. Signing makes the week's text at version 0, signs it with
// the key the teacher joined with and puts it on the channel, refused when this
// key signed that course's week already at that version or above, as when a
// correction (#583) was put meanwhile, or another device joined on the channel
// first.

import {
  addDays,
  channelParts,
  channelVisas,
  channelWeeks,
  courseId,
  partOn,
  sealWeek,
  sessionSlot,
  signWeek,
  timetableNameKey,
  weekday,
  weekRecordText,
  type ChannelWeek,
  type Day,
  type SchoolJoined,
  type SessionState,
  type SignedPart,
  type SignedTimetable,
  type Subject,
  type WeekRecord,
  type WeekSession,
  type WeekVisa,
  type Weekday,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { readChannel } from '../school/school-join-session';
import { caKey } from '../school/space-read';
import { putOnChannel } from '../timetable/send-session';
import { codeOf, sessionsOf } from '../timetable/teacher-session';

type SignWorld = Pick<OpenWorld, 'world' | 'date'>;

/** The parts and the signed weeks on the teacher's channel. */
export interface SignChannel {
  readonly parts: readonly SignedPart[];
  readonly weeks: readonly ChannelWeek[];
  /** The visas on the weeks, the first on each version. */
  readonly visas: readonly SignedTimetable<WeekVisa>[];
}

/** A course's week to sign: its class and subject as the timetable names them, and its sessions. */
export interface WeekToSign {
  readonly class: string;
  readonly subject: string;
  /** The subject's country code, or null when the country does not know it. */
  readonly code: string | null;
  readonly sessions: readonly Omit<WeekSession, 'state'>[];
}

/** The parts and the weeks this device signed on its channel. */
export async function readSignChannel(
  world: SignWorld,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<SignChannel> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const { batches, joined } = await readChannel(code, ca, kit, send);
  if (joined === null) throw failed('No device joined on the channel yet', 'E_TIMETABLE_UNJOINED');
  if (joined.device !== join.device) throw failed('Another device joined first', 'E_JOIN_TAKEN');
  const checker = { key: ca, checker: kit };
  const parts = await kitStep(() => channelParts(code, batches, checker, joined.device, kit.cipher, kit.mac));
  const weeks = await kitStep(() => channelWeeks(code, batches, checker, joined, kit.cipher, kit.mac));
  const visas = await kitStep(() => channelVisas(code, batches, checker, joined, kit.cipher, kit.mac));
  return { parts, weeks, visas };
}

/** The week's first day: the school's first working day on or before the day, in its week. */
export function weekStart(day: Day, workingDays: readonly Weekday[]): Day {
  const first = workingDays[0] ?? 0;
  return addDays(day, -((weekday(day) - first + 7) % 7));
}

/** The week's last working day, from its first day. */
export function weekEnd(start: Day, workingDays: readonly Weekday[]): Day {
  return addDays(start, ((workingDays.at(-1) ?? 4) - (workingDays[0] ?? 0) + 7) % 7);
}

/** A subject's country code from its name in any language or its code, as their name keys read, or null. */
export function subjectCode(subjects: readonly Subject[], name: string): string | null {
  const key = timetableNameKey(name);
  const names = (one: Subject) => [one.code, ...Object.values(one.name)];
  return subjects.find((one) => names(one).some((other) => timetableNameKey(other) === key))?.code ?? null;
}

/** A course's key on the page: its class's name key and its subject's code, or the subject's name key without one. */
export const courseKey = (one: Pick<WeekToSign, 'class' | 'subject' | 'code'>) =>
  [
    timetableNameKey(one.class),
    ...(one.code === null ? ['name', timetableNameKey(one.subject)] : ['code', one.code]),
  ].join('\n');

/** A course's name on its chip: its class, with its subject when the class has several courses. */
export const courseLabel = (weeks: readonly WeekToSign[], one: WeekToSign) =>
  weeks.filter((other) => timetableNameKey(other.class) === timetableNameKey(one.class)).length > 1
    ? `${one.class} · ${one.subject}`
    : one.class;

/** Each class and subject's week, from its first working day to the world's date, as the parts in force give it. */
export function weeksToSign(
  parts: readonly SignedPart[],
  date: Day,
  workingDays: readonly Weekday[],
  subjects: readonly Subject[],
): WeekToSign[] {
  const start = weekStart(date, workingDays);
  const found = new Map<string, WeekToSign & { sessions: Omit<WeekSession, 'state'>[] }>();
  for (let day = start; day <= date; day = addDays(day, 1)) {
    if (!workingDays.includes(weekday(day))) continue;
    const part = partOn(parts, day)?.part;
    for (const one of part === undefined ? [] : sessionsOf(part).filter((each) => each.day === weekday(day))) {
      const week = { class: one.class, subject: one.subject, code: subjectCode(subjects, one.subject) };
      const course = found.get(courseKey(week)) ?? { ...week, sessions: [] };
      course.sessions.push({ day: one.day, start: one.start, end: one.end, group: one.group, week: one.week });
      found.set(courseKey(week), course);
    }
  }
  return [...found.values()];
}

/** A course's week as it is signed: each session in the state confirmed, or awaiting confirmation. */
export async function weekRecord(
  school: string,
  week: WeekToSign,
  first: Day,
  states: ReadonlyMap<string, SessionState>,
  mac: WorldKit['mac'],
): Promise<WeekRecord> {
  if (week.code === null) throw failed('The country does not know this subject', 'E_WEEK_SUBJECT');
  return {
    course: await courseId(school, week.class, week.code, mac),
    week: first,
    version: 0,
    totals: { subject: week.code, items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
    class: week.class,
    subject: week.subject,
    sessions: week.sessions.map((one) => ({ ...one, state: states.get(sessionKey(one)) ?? 'awaiting' })),
  };
}

/** A session's key among a week's confirmations: its slot in the week. */
export const sessionKey = sessionSlot;

/** A course's signed week at its highest version: of its first day, its class by name key and its subject's code. */
export const signedWeek = (records: readonly WeekRecord[], week: WeekToSign, first: Day) =>
  records
    .filter(
      (one) =>
        one.week === first &&
        timetableNameKey(one.class) === timetableNameKey(week.class) &&
        one.totals.subject === week.code,
    )
    .reduce<WeekRecord | undefined>(
      (best, one) => (best === undefined || one.version > best.version ? one : best),
      undefined,
    );

let keptWorld: string | null = null;
const kept = new Map<string, Map<string, SessionState>>();

/** A course's week's confirmations for a join, kept in memory for the last world one was made in until signed. */
export function confirmations(world: string, device: string, school: string, week: WeekToSign, first: Day) {
  const key = [device, school, courseKey(week), first].join('\n');
  const states: ReadonlyMap<string, SessionState> = (world === keptWorld ? kept.get(key) : undefined) ?? new Map();
  const set = (one: Omit<WeekSession, 'state'>, state: SessionState) => {
    if (world !== keptWorld) kept.clear();
    keptWorld = world;
    const found = kept.get(key) ?? new Map<string, SessionState>();
    if (state === 'awaiting') found.delete(sessionKey(one));
    else found.set(sessionKey(one), state);
    kept.set(key, found);
  };
  const forget = () => {
    if (world === keptWorld) kept.delete(key);
  };
  return { states, set, forget };
}

/** Signs a course's week or its correction with this device's key and puts it on its channel, refused when taken. */
export async function signTheWeek(
  world: SignWorld,
  join: SchoolJoined,
  record: WeekRecord,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const signer = {
    publicKey: join.certificate.publicKey,
    sign: (one: string) => kit.sign(join.pkcs8, one),
    verify: kit.verify,
  };
  const signed = await kitStep(() => signWeek(weekRecordText(record), join.certificate, signer));
  await putOnChannel(code, ca, kit, send, async ({ batches, joined }, first) => {
    if (joined?.device !== join.device) throw failed('Another device joined first', 'E_JOIN_TAKEN');
    const weeks = await kitStep(() =>
      channelWeeks(code, batches, { key: ca, checker: kit }, joined, kit.cipher, kit.mac),
    );
    const same = (one: ChannelWeek) => one.week.course === record.course && one.week.week === record.week;
    if (weeks.some((one) => same(one) && one.week.version >= record.version)) {
      throw failed('This week is signed already', 'E_WEEK_SIGNED');
    }
    return (await kitStep(() => sealWeek(code, signed, first, kit.cipher, kit.mac))).batches;
  });
}
