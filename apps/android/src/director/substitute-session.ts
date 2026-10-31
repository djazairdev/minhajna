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
// substitute's channel read once. Appointing reads again and refuses, before
// anything is kept, a holder or substitute not among them, the same teacher as
// both, a decision not of its shape once cleaned, no class, a class not the
// holder's or a first day not offered; then it publishes the next version, the
// standing one with the holder's sessions of those classes taught by the
// substitute, from the first day, to the teachers it affects
// (version-session.ts), keeps the appointment in the world's store with that
// version, and puts the handover. The handover holds the school key, reads the
// holder's signed weeks of those classes on their channel at the version it
// keeps (records-session.ts), oldest first, and puts them on the substitute's
// channel, signed with this device's key, one record a class, or more of at
// most 64 weeks each, numbered within the class, a class with no week signed
// still named; it is refused when the substitute has not joined, and may be put
// again, whole, when part of it did not reach the channel or to bring it up to
// date, joining the first under the same device even after a reload made a new
// key. Errors carry world-session.ts's codes, those of holding the school key
// and of publishing, E_SUBSTITUTE_CHOICE for a choice refused and
// E_SUBSTITUTE_NOT_JOINED.

import {
  channelHandovers,
  channelStream,
  cleanRecordText,
  HANDOVER_WEEKS,
  isDecision,
  keptIssues,
  keptSubstitutions,
  keptVersions,
  newId,
  readJoined,
  sealHandover,
  signHandover,
  standingVersion,
  timetableNameKey,
  timetableNames,
  type BellTimes,
  type ClassHandover,
  type Day,
  type DemoSchool,
  type Joined,
  type SchoolSubstitution,
  type SealedBatch,
  type SignedWeek,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnChannel, signingKey } from '../timetable/send-session';
import { draftVersion, publishVersion, type SentParts } from '../timetable/version-session';
import { startDays } from '../timetable/version-text';
import { assignmentsOf, holdSchool, joinCode, type IssueDesk } from './issue-session';
import { readRecords } from './records-session';

type SubstituteWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;
type Staff = Pick<DemoSchool, 'name' | 'teachers'>;
type Person = Staff['teachers'][number];

/** A teacher of the staff list who holds classes in the standing version, by name key. */
export interface Holder {
  readonly id: string;
  readonly name: string;
  readonly classes: readonly string[];
}

/** An appointment with its teachers' names, whether every class's handover arrived, and the receipt's day. */
export interface Appointment extends SchoolSubstitution {
  readonly holderName: string;
  readonly substituteName: string;
  readonly handedOver: boolean;
  readonly received: Day | null;
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

type Channel = {
  readonly code: Awaited<ReturnType<typeof joinCode>>;
  readonly theirs: readonly SealedBatch[];
  readonly joined: Joined | null;
};

const owns = (person: Person, teacher: string) =>
  [person.name, person.latinName]
    .map(timetableNameKey)
    .filter((one) => one !== '')
    .includes(timetableNameKey(teacher));

/** Each staff teacher's channel as read with the school key: its code, its batches and who joined, or null. */
async function channels(world: SubstituteWorld, desk: IssueDesk, school: Staff, kit: WorldKit, send: Send) {
  const space = desk.held.school;
  const issues = keptIssues(world.book.entries, space);
  const assigned = await assignmentsOf(desk, school.teachers, kit);
  const [ca, batches] = [await caKey(world.world, send), await spaceBatches(world.world, space, send)];
  const checker = { key: ca, checker: kit };
  const read = new Map<string, Channel | null>();
  for (const person of school.teachers) {
    const issue = issues.get(assigned.get(person.id) ?? '');
    if (issue === undefined) {
      read.set(person.id, null);
      continue;
    }
    const code = await joinCode(world.world, desk, issue);
    const theirs = batches.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
    const joined = await kitStep(() => readJoined(code, theirs, checker, kit.cipher, kit.mac));
    read.set(person.id, { code, theirs, joined });
  }
  return { ca, checker, read };
}

/** Reads the substitute page: the standing version's holders, the joined teachers and the appointments. */
export const readSubstitutes = async (
  world: SubstituteWorld,
  school: Staff,
  kit: WorldKit,
  send: Send = worldRequest,
) => (await reading(world, school, kit, send)).found;

async function reading(world: SubstituteWorld, school: Staff, kit: WorldKit, send: Send) {
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
  for (const one of keptSubstitutions(world.book.entries, space)) {
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
    appointments.push({ ...one, ...names, handedOver, received: theirs?.received ?? null });
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

/** The handover's records for an appointment: each class's signed weeks, at most `HANDOVER_WEEKS` a record. */
export function handoverRecords(
  base: Omit<ClassHandover, 'class' | 'part' | 'parts' | 'weeks'>,
  weeks: ReadonlyMap<string, readonly SignedWeek[]>,
): ClassHandover[] {
  return base.classes.flatMap((of) => {
    const theirs = weeks.get(timetableNameKey(of)) ?? [];
    const parts = Math.max(1, Math.ceil(theirs.length / HANDOVER_WEEKS));
    return Array.from({ length: parts }, (_, at) => ({
      ...base,
      class: of,
      part: at,
      parts,
      weeks: theirs.slice(at * HANDOVER_WEEKS, (at + 1) * HANDOVER_WEEKS),
    }));
  });
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
  const { found, standing, desk } = await reading(world, school, kit, send);
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
