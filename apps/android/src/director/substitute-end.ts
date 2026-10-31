// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The end of a substitution from the director's device in a demo world (#588,
// Handover-end, §7.5, R-7.5-07, answer 616). The days it may end on are those a
// version may start from after its first day. Ending reads the page again
// (substitute-session.ts) and refuses, before anything is kept, an appointment
// not kept or already ended, a day not offered, a holder or substitute no
// longer on the staff list, and a standing version before the one it published
// that is not kept; the courses it passed are the holder's, by class and
// subject, in those classes in that version, so a subject the substitute
// teaches in one of those classes stays theirs, and ending is refused while any
// of those courses' sessions is taught by another teacher than the substitute
// or the holder, as when a second substitute replaces the first; then it
// publishes the next version, the standing one with the substitute's sessions
// of those courses taught by the holder again, from the return day, unless none
// is left to give back, as when an ending whose version was published could not
// be kept, keeps the appointment ended on that day, and puts the end and the
// return. Putting them holds the school key, puts the end on the substitute's
// channel unless the handover there is ended already or never arrived, since an
// end counts only after its handover, then reads the substitute's signed weeks
// of those courses on their channel, each at its highest version, those with
// some day from the first day and before the return, and puts them on the
// holder's channel, signed with this device's key, in records as
// substitute-channels.ts cuts them; it is refused when the holder or the
// substitute has not joined, and may be put again, whole. Errors carry
// world-session.ts's codes, those of holding the school key and of publishing,
// E_SUBSTITUTE_TAUGHT while another teacher teaches a course passed,
// E_SUBSTITUTE_END for the other refusals, E_HOLDER_NOT_JOINED and
// E_SUBSTITUTE_NOT_JOINED.

import {
  channelHandovers,
  channelWeeks,
  inSubstitution,
  keptSubstitutions,
  keptVersions,
  newId,
  sealClassReturn,
  sealHandoverEnd,
  signClassReturn,
  signHandoverEnd,
  standingVersion,
  timetableNameKey,
  type BellTimes,
  type Day,
  type SchoolSubstitution,
  type SignedWeek,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { putOnChannel, signingKey } from '../timetable/send-session';
import { draftVersion, publishVersion, type SentParts } from '../timetable/version-session';
import { holdSchool } from './issue-session';
import { channels, owns, passedParts, type Person, type Staff } from './substitute-channels';
import { substituteDesk } from './substitute-session';

type EndWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** A course's key: its class's and its subject's name keys. */
const courseOf = (of: string, subject: string) => `${timetableNameKey(of)}\n${timetableNameKey(subject)}`;

/**
 * The courses an appointment passed: the holder's, in its classes, in the
 * standing version before the one it published, by class and subject.
 */
function passedCourses(world: EndWorld, space: string, appointment: SchoolSubstitution, holder: Person) {
  const versions = keptVersions(world.book.entries, space).filter((one) => one.version < appointment.version);
  const before = standingVersion(versions);
  if (before === null) throw failed('The version before the appointment is not kept', 'E_SUBSTITUTE_END');
  const chosen = new Set(appointment.classes.map(timetableNameKey));
  const theirs = before.sessions.filter((one) => owns(holder, one.teacher) && chosen.has(timetableNameKey(one.class)));
  return new Set(theirs.map((one) => courseOf(one.class, one.subject)));
}

/** The days an appointment may end on: those a version may start from, after its first day. */
export const returnDays = (days: readonly Day[], appointment: Pick<SchoolSubstitution, 'from'>) =>
  days.filter((day) => day > appointment.from);

/**
 * Puts an ended appointment's end on the substitute's channel, unless it is
 * there, and its return on the holder's channel, signed with this device's
 * key, record by record: the substitute's signed weeks of the courses it
 * passed, in each class, in the substitution, as their channel keeps them.
 */
export async function sendReturn(
  world: EndWorld,
  school: Staff,
  appointment: SchoolSubstitution,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const { ended: until, from, classes } = appointment;
  if (until === null) throw failed('The appointment has not ended', 'E_SUBSTITUTE_END');
  const desk = await holdSchool(world, kit, send, false);
  const person = school.teachers.find((one) => one.id === appointment.holder);
  if (person === undefined) throw failed('The holder is no longer on the staff list', 'E_SUBSTITUTE_END');
  const passed = passedCourses(world, desk.held.school, appointment, person);
  const { ca, checker, read } = await channels(world, desk, school, kit, send);
  const [holding, substituting] = [read.get(appointment.holder) ?? null, read.get(appointment.substitute) ?? null];
  if (holding?.joined == null) throw failed('The holder has not joined', 'E_HOLDER_NOT_JOINED');
  if (substituting?.joined == null) throw failed('The substitute has not joined', 'E_SUBSTITUTE_NOT_JOINED');
  const key = await signingKey(world.world, desk, ca, kit, send);
  const sub = substituting.code;
  const handovers = await kitStep(() =>
    channelHandovers(sub, substituting.theirs, checker, substituting.joined, kit.cipher, kit.mac),
  );
  if (handovers.some((one) => one.signed.value.appointment === appointment.id && one.ended === null)) {
    const on = { world: world.world, school: desk.held.school, assignment: sub.assignment, issue: sub.issue };
    const end = await kitStep(() =>
      signHandoverEnd({ ...on, appointment: appointment.id, day: until }, key.certificate, key.signer),
    );
    await putOnChannel(sub, ca, kit, send, async (_read, first) => {
      return (await kitStep(() => sealHandoverEnd(sub, end, first, kit.cipher, kit.mac))).batches;
    });
  }
  const weeks = new Map<string, SignedWeek[]>();
  const signed = await kitStep(() =>
    channelWeeks(sub, substituting.theirs, checker, substituting.joined, kit.cipher, kit.mac),
  );
  for (const { week, signed: one } of signed) {
    if (!passed.has(courseOf(week.class, week.subject)) || !inSubstitution(week.week, from, until)) continue;
    weeks.set(timetableNameKey(week.class), [...(weeks.get(timetableNameKey(week.class)) ?? []), one]);
  }
  const nameOf = (id: string) => school.teachers.find((one) => one.id === id)?.name ?? '';
  const code = holding.code;
  const on = { world: world.world, school: desk.held.school, assignment: code.assignment, issue: code.issue };
  const names = { holder: nameOf(appointment.holder), substitute: nameOf(appointment.substitute) };
  const base = { ...on, ...names, appointment: appointment.id, decision: appointment.decision, from, until, classes };
  const sending = newId(kit.random);
  for (const part of passedParts(classes, weeks)) {
    const one = await kitStep(() => signClassReturn({ ...base, sending, ...part }, key.certificate, key.signer));
    await putOnChannel(code, ca, kit, send, async (_read, first) => {
      return (await kitStep(() => sealClassReturn(code, one, first, kit.cipher, kit.mac))).batches;
    });
  }
}

/**
 * Ends an appointment at the holder's return: checks the day and that the
 * courses it passed are taught by the substitute or the holder alone, publishes
 * the next version with the substitute's sessions of those courses taught by
 * the holder again from that day, unless none is left to give back, keeps the
 * appointment ended, then puts the end and the return.
 */
export async function endSubstitution(
  world: EndWorld,
  school: Staff,
  id: string,
  until: Day,
  bells: BellTimes,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<{ readonly appointment: SchoolSubstitution; readonly sent: SentParts | null }> {
  const { found, standing, desk } = await substituteDesk(world, school, kit, send);
  const appointment = keptSubstitutions(world.book.entries, desk.held.school).find((one) => one.id === id);
  if (appointment === undefined || appointment.ended !== null || !returnDays(found.days, appointment).includes(until))
    throw failed('The appointment or the return day cannot be chosen', 'E_SUBSTITUTE_END');
  const holder = school.teachers.find((one) => one.id === appointment.holder);
  const substitute = school.teachers.find((one) => one.id === appointment.substitute);
  if (standing === null || holder === undefined || substitute === undefined)
    throw failed('The holder or the substitute is no longer on the staff list', 'E_SUBSTITUTE_END');
  const passed = passedCourses(world, desk.held.school, appointment, holder);
  const ofPassed = standing.sessions.filter((one) => passed.has(courseOf(one.class, one.subject)));
  if (ofPassed.some((one) => !owns(substitute, one.teacher) && !owns(holder, one.teacher)))
    throw failed('Another teacher now teaches a course the appointment passed', 'E_SUBSTITUTE_TAUGHT');
  const back = (one: (typeof standing.sessions)[number]) =>
    owns(substitute, one.teacher) && passed.has(courseOf(one.class, one.subject));
  const sessions = standing.sessions.map((one, at) => ({
    ...one,
    teacher: back(one) ? holder.name : one.teacher,
    row: at + 1,
  }));
  const draft = standing.sessions.some(back) ? await draftVersion(world, school, sessions, bells, kit, send) : null;
  const sent = draft === null ? null : await publishVersion(world, draft, { from: until, once: false }, kit, send);
  const ended: SchoolSubstitution = { ...appointment, ended: until };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: ended });
  await sendReturn(world, school, ended, kit, send);
  return { appointment: ended, sent };
}
