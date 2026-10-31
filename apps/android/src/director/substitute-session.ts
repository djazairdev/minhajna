// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A substitute's appointment from the director's device in a demo world (#587,
// D-Substitute, §7.5, R-7.5-07, answer 615). Reading holds the school key and
// lists the staff list's teachers who hold classes in the standing version, the
// one the next version is drafted from (answer 606), each with their classes in
// the timetable's order; the teachers whose device joined on a code or key
// issued to them, who alone may substitute; the first days a version may start
// from; and the school's appointments, each with its teachers' names, whether
// every class's records of its handover arrived on the substitute's channel and
// the day the substitute signed its receipt (class-handover.ts), each
// substitute's channel read once, and, once ended (substitute-end.ts, #588),
// whether every class's records of its return arrived on the holder's channel,
// each holder's channel read once, and whether the holder joined; the staff's
// channels are read as substitute-channels.ts reads them. Appointing reads
// again and refuses, before anything is kept, a holder or substitute not among
// them, the same teacher as both, a decision not of its shape once cleaned, no
// class, a class not the holder's or a first day not offered; then it publishes
// the next version, the standing one with the holder's sessions of those
// classes taught by the substitute, from the first day, to the teachers it
// affects (version-session.ts), keeps the appointment in the world's store with
// that version, and puts the handover. The handover holds the school key, reads
// the holder's signed weeks of those classes on their channel at the version it
// keeps (records-session.ts), oldest first, and puts them on the substitute's
// channel, signed with this device's key, in records as substitute-channels.ts
// cuts them; it is refused when the substitute has not joined, and may be put
// again, whole, when part of it did not reach the channel or to bring it up to
// date, joining the first under the same device even after a reload made a new
// key. Errors carry world-session.ts's codes, those of holding the school key
// and of publishing, E_SUBSTITUTE_CHOICE for a choice refused and
// E_SUBSTITUTE_NOT_JOINED.

import {
  channelHandovers,
  channelReturns,
  cleanRecordText,
  isDecision,
  keptSubstitutions,
  keptVersions,
  newId,
  sealHandover,
  signHandover,
  standingVersion,
  timetableNameKey,
  timetableNames,
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
import { startDays } from '../timetable/version-text';
import { holdSchool } from './issue-session';
import { readRecords } from './records-session';
import { channels, handoverRecords, owns, type Staff } from './substitute-channels';

type SubstituteWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** A teacher of the staff list who holds classes in the standing version, by name key. */
export interface Holder {
  readonly id: string;
  readonly name: string;
  readonly classes: readonly string[];
}

/** An appointment with its teachers' names, whether its handover and return arrived whole, and the receipt's day. */
export interface Appointment extends SchoolSubstitution {
  readonly holderName: string;
  readonly substituteName: string;
  readonly handedOver: boolean;
  readonly received: Day | null;
  /** Whether every class's return arrived on the holder's channel, once the appointment ended. */
  readonly returned: boolean;
  /** Whether the holder's device joined on a code or key issued to them, so a return can reach them. */
  readonly holderJoined: boolean;
}

/** What the substitute page reads: who holds classes, who may substitute, the days offered and the appointments. */
export interface SubstituteDesk {
  readonly holders: readonly Holder[];
  /** The staff list's teachers whose device joined on a code or key issued to them. */
  readonly substitutes: readonly { readonly id: string; readonly name: string }[];
  readonly days: readonly Day[];
  readonly appointments: readonly Appointment[];
}

/** What the director chooses for an appointment. */
export interface Appointing {
  readonly holder: string;
  readonly substitute: string;
  readonly decision: string;
  readonly classes: readonly string[];
  readonly from: Day;
}

/** Reads the substitute page: the standing version's holders, the joined teachers and the appointments. */
export const readSubstitutes = async (
  world: SubstituteWorld,
  school: Staff,
  kit: WorldKit,
  send: Send = worldRequest,
) => (await substituteDesk(world, school, kit, send)).found;

/** The substitute page as read, with the standing version and the school key held. */
export async function substituteDesk(world: SubstituteWorld, school: Staff, kit: WorldKit, send: Send) {
  const desk = await holdSchool(world, kit, send, false);
  const space = desk.held.school;
  const standing = standingVersion(keptVersions(world.book.entries, space));
  const sessions = (standing?.sessions ?? []).map((one, at) => ({ ...one, row: at + 1 }));
  const holders = school.teachers.flatMap((person) => {
    const theirs = sessions.filter((one) => owns(person, one.teacher));
    return theirs.length === 0 ? [] : [{ id: person.id, name: person.name, classes: timetableNames(theirs, 'class') }];
  });
  const { checker, read } = await channels(world, desk, school, kit, send);
  const substitutes = school.teachers.filter((one) => read.get(one.id)?.joined != null);
  const nameOf = (id: string) => school.teachers.find((one) => one.id === id)?.name ?? '';
  const appointments: Appointment[] = [];
  const handed = new Map<string, Awaited<ReturnType<typeof channelHandovers>>>();
  const back = new Map<string, Awaited<ReturnType<typeof channelReturns>>>();
  for (const one of keptSubstitutions(world.book.entries, space)) {
    const holding = read.get(one.holder) ?? null;
    if (one.ended !== null && holding !== null && !back.has(one.holder)) {
      const { code, theirs, joined } = holding;
      back.set(one.holder, await kitStep(() => channelReturns(code, theirs, checker, joined, kit.cipher, kit.mac)));
    }
    const returning = back.get(one.holder)?.find((each) => each.signed.value.appointment === one.id);
    const channel = read.get(one.substitute) ?? null;
    if (channel !== null && !handed.has(one.substitute)) {
      const { code, theirs, joined } = channel;
      handed.set(
        one.substitute,
        await kitStep(() => channelHandovers(code, theirs, checker, joined, kit.cipher, kit.mac)),
      );
    }
    const theirs = handed.get(one.substitute)?.find((each) => each.signed.value.appointment === one.id);
    const names = { holderName: nameOf(one.holder), substituteName: nameOf(one.substitute) };
    const handedOver = theirs !== undefined && theirs.complete.length === one.classes.length;
    const returned = returning !== undefined && returning.complete.length === one.classes.length;
    const holderJoined = holding?.joined != null;
    appointments.push({ ...one, ...names, handedOver, received: theirs?.received ?? null, returned, holderJoined });
  }
  const days = standing === null ? [] : startDays(world.date, standing.from);
  const found: SubstituteDesk = {
    holders,
    substitutes: substitutes.map(({ id, name }) => ({ id, name })),
    days,
    appointments,
  };
  return { found, standing, desk };
}

/** Puts an appointment's handover on the substitute's channel, signed with this device's key, record by record. */
export async function sendHandover(
  world: SubstituteWorld,
  school: Staff,
  appointment: SchoolSubstitution,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const desk = await holdSchool(world, kit, send, false);
  const { ca, read } = await channels(world, desk, school, kit, send);
  const channel = read.get(appointment.substitute) ?? null;
  if (channel?.joined == null) throw failed('The substitute has not joined', 'E_SUBSTITUTE_NOT_JOINED');
  const chosen = new Set(appointment.classes.map(timetableNameKey));
  const weeks = new Map<string, SignedWeek[]>();
  for (const one of await readRecords(world, school, kit, send)) {
    if (!chosen.has(timetableNameKey(one.class))) continue;
    const theirs = one.courses.filter((course) => course.key.startsWith(`${appointment.holder}\n`));
    weeks.set(
      timetableNameKey(one.class),
      theirs.flatMap((course) => [...course.weeks].reverse().map((week) => week.signed)),
    );
  }
  const nameOf = (id: string) => school.teachers.find((one) => one.id === id)?.name ?? '';
  const { code } = channel;
  const on = { world: world.world, school: desk.held.school, assignment: code.assignment, issue: code.issue };
  const { id, decision, from, classes } = appointment;
  const base = { ...on, appointment: id, holder: nameOf(appointment.holder), decision, from, classes };
  const key = await signingKey(world.world, desk, ca, kit, send);
  const sending = newId(kit.random);
  for (const one of handoverRecords({ ...base, sending, substitute: nameOf(appointment.substitute) }, weeks)) {
    const signed = await kitStep(() => signHandover(one, key.certificate, key.signer));
    await putOnChannel(code, ca, kit, send, async (_read, first) => {
      return (await kitStep(() => sealHandover(code, signed, first, kit.cipher, kit.mac))).batches;
    });
  }
}

/**
 * Records a substitute's appointment: checks the choice, publishes the next
 * version with the holder's sessions of the classes taught by the substitute
 * from the first day, keeps the appointment, then puts the handover.
 */
export async function appoint(
  world: SubstituteWorld,
  school: Staff,
  choice: Appointing,
  bells: BellTimes,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<{ readonly appointment: SchoolSubstitution; readonly sent: SentParts }> {
  const { found, standing, desk } = await substituteDesk(world, school, kit, send);
  const holder = found.holders.find((one) => one.id === choice.holder);
  const substitute = found.substitutes.find((one) => one.id === choice.substitute);
  const decision = cleanRecordText(choice.decision);
  const theirs = new Set(holder?.classes.map(timetableNameKey));
  const classes =
    holder?.classes.filter((one) => choice.classes.some((each) => timetableNameKey(each) === timetableNameKey(one))) ??
    [];
  if (holder === undefined || substitute === undefined || holder.id === substitute.id) {
    throw failed('The holder or the substitute cannot be chosen', 'E_SUBSTITUTE_CHOICE');
  }
  if (!isDecision(decision) || classes.length === 0 || classes.length !== choice.classes.length) {
    throw failed('The decision or the classes are not of their shape', 'E_SUBSTITUTE_CHOICE');
  }
  if (!found.days.includes(choice.from) || choice.classes.some((one) => !theirs.has(timetableNameKey(one)))) {
    throw failed('The first day or a class cannot be chosen', 'E_SUBSTITUTE_CHOICE');
  }
  if (standing === null) throw failed('No version is published yet', 'E_SUBSTITUTE_CHOICE');
  const person = school.teachers.find((one) => one.id === holder.id)!;
  const passed = new Set(classes.map(timetableNameKey));
  const sessions = standing.sessions.map((one, at) => ({
    ...one,
    teacher: owns(person, one.teacher) && passed.has(timetableNameKey(one.class)) ? substitute.name : one.teacher,
    row: at + 1,
  }));
  const draft = await draftVersion(world, school, sessions, bells, kit, send);
  const sent = await publishVersion(world, draft, { from: choice.from, once: false }, kit, send);
  const appointment: SchoolSubstitution = {
    school: desk.held.school,
    id: newId(kit.random),
    holder: holder.id,
    substitute: substitute.id,
    decision,
    classes,
    from: choice.from,
    version: draft.version,
    ended: null,
  };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: appointment });
  await sendHandover(world, school, appointment, kit, send);
  return { appointment, sent };
}
