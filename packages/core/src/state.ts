// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the screens show is worked out from the history (PRD §5.5).

import { compareDays, maxDay, type Day } from './day.ts';
import type { Entry } from './history.ts';
import { mayTravelAs, type OutboundRoute } from './layers.ts';
import type { CalendarEntry } from './reference.ts';
import {
  compareHalves,
  compareSlots,
  type Course,
  type PrivateNote,
  type Pupil,
  type PupilMovement,
  type RollCall,
  type School,
  type SchoolClass,
  type SeatingPlan,
  type SessionRecord,
  type TeacherCard,
  type TimetableVersion,
} from './records.ts';
import { eventOf, layerOf, type RecordEvent } from './events.ts';

/** One version of a record. Corrections add versions, and every version stays (PRD §3.1, rule 4). */
export interface Version<T> {
  readonly entry: string;
  readonly day: Day;
  readonly value: T;
  readonly reason?: string;
}

/** A timetable version, the day it was recorded, and the first day it applies (PRD §4.6). */
export interface RecordedTimetable {
  readonly version: TimetableVersion;
  /** The day of its history entry. */
  readonly recorded: Day;
  /** Its own `from` for the first version, and never earlier than `recorded` for a later one. */
  readonly from: Day;
}

export interface State {
  readonly teacher: TeacherCard | null;
  readonly schools: ReadonlyMap<string, School>;
  readonly classes: ReadonlyMap<string, SchoolClass>;
  readonly pupils: ReadonlyMap<string, Pupil>;
  readonly courses: ReadonlyMap<string, Course>;
  /** Every timetable version recorded, in the order they apply. */
  readonly timetables: readonly RecordedTimetable[];
  /** The entries the teacher added to the calendar. */
  readonly calendar: readonly CalendarEntry[];
  /** Every version of each session's record, by session key. The last is the current one. */
  readonly sessions: ReadonlyMap<string, readonly Version<SessionRecord>[]>;
  readonly notes: ReadonlyMap<string, PrivateNote>;
  /** Every version of each roll call, by unit key. The last is the current one. */
  readonly rollCalls: ReadonlyMap<string, readonly Version<RollCall>[]>;
  readonly seating: ReadonlyMap<string, SeatingPlan>;
}

function versionOf<T>(entry: Entry, value: T, reason?: string): Version<T> {
  return { entry: entry.id, day: entry.day, value, ...(reason !== undefined && { reason }) };
}

interface Movement {
  readonly movement: PupilMovement;
  /** The place of the event that recorded it, in the history. */
  readonly order: number;
}

/**
 * A pupil's movements are those of their latest record plus every movement
 * recorded on its own, so setting the pupil again, to fix a name for
 * example, never loses one. The same movement recorded again on the same
 * day, such as a departure once the director confirms it, replaces the
 * earlier one.
 */
function withMovements(pupil: Pupil, order: number, moved: readonly Movement[]): Pupil {
  const latest = new Map<string, Movement>();
  const all = [...pupil.movements.map((movement) => ({ movement, order })), ...moved].sort((a, b) => a.order - b.order);
  for (const candidate of all) latest.set(`${candidate.movement.day}/${candidate.movement.kind}`, candidate);
  const movements = [...latest.values()]
    .sort((a, b) => compareDays(a.movement.day, b.movement.day) || a.order - b.order)
    .map((candidate) => candidate.movement);
  return { ...pupil, movements };
}

export function buildState(entries: readonly Entry[]): State {
  let teacher: TeacherCard | null = null;
  const schools = new Map<string, School>();
  const classes = new Map<string, SchoolClass>();
  const pupilSets = new Map<string, { readonly pupil: Pupil; readonly order: number }>();
  const moved = new Map<string, Movement[]>();
  const courses = new Map<string, Course>();
  const timetables: RecordedTimetable[] = [];
  const calendar = new Map<string, CalendarEntry>();
  const sessions = new Map<string, Version<SessionRecord>[]>();
  const notes = new Map<string, PrivateNote>();
  const rollCalls = new Map<string, Version<RollCall>[]>();
  const seating = new Map<string, SeatingPlan>();

  for (const [order, entry] of entries.entries()) {
    const event = eventOf(entry);
    if (event === null) continue;
    switch (event.kind) {
      case 'teacher.set':
        teacher = event.card;
        break;
      case 'school.set':
        schools.set(event.school.id, event.school);
        break;
      case 'class.set':
        classes.set(event.schoolClass.id, event.schoolClass);
        break;
      case 'pupil.set':
        pupilSets.set(event.pupil.id, { pupil: event.pupil, order });
        break;
      case 'pupil.moved':
        moved.set(event.pupilId, [...(moved.get(event.pupilId) ?? []), { movement: event.movement, order }]);
        break;
      case 'course.set':
        courses.set(event.course.id, event.course);
        break;
      case 'timetable.set':
        // The first version applies from its own day, so setup can fill in
        // the weeks already gone. A later one never reaches back before the
        // day it was recorded: the past never moves (PRD §4.6).
        timetables.push({
          version: event.version,
          recorded: entry.day,
          from: timetables.length === 0 ? event.version.from : maxDay(event.version.from, entry.day),
        });
        break;
      case 'calendar.set':
        calendar.set(event.entry.id, event.entry);
        break;
      case 'session.recorded': {
        const key = event.record.session.key;
        sessions.set(key, [...(sessions.get(key) ?? []), versionOf(entry, event.record)]);
        break;
      }
      case 'session.noted':
        notes.set(event.note.sessionKey, event.note);
        break;
      case 'roll-call.taken': {
        const key = event.rollCall.unit;
        rollCalls.set(key, [...(rollCalls.get(key) ?? []), versionOf(entry, event.rollCall, event.reason)]);
        break;
      }
      case 'seating.set':
        seating.set(`${event.plan.classId}/${event.plan.groupId}`, event.plan);
        break;
    }
  }

  const pupils = new Map<string, Pupil>();
  for (const [id, { pupil, order }] of pupilSets) pupils.set(id, withMovements(pupil, order, moved.get(id) ?? []));

  return {
    teacher,
    schools,
    classes,
    pupils,
    courses,
    // Sorting is stable, so of two versions from the same day the one recorded later applies.
    timetables: timetables.sort((a, b) => compareDays(a.from, b.from)),
    calendar: [...calendar.values()],
    sessions,
    notes,
    rollCalls,
    seating,
  };
}

/** The current version of a record, or null. */
export function current<T>(versions: readonly Version<T>[] | undefined): T | null {
  return versions?.at(-1)?.value ?? null;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The current version of each record, as the event that sets it, with
 * nothing from its history entry: no ID, place in the history, day or hash.
 * Sessions and roll calls come in the order of their own days, so not even
 * the order shows when they were recorded (PRD §7.6).
 */
function currentRecords(state: State): RecordEvent[] {
  const records: RecordEvent[] = [];
  if (state.teacher !== null) records.push({ kind: 'teacher.set', card: state.teacher });
  for (const school of state.schools.values()) records.push({ kind: 'school.set', school });
  for (const schoolClass of state.classes.values()) records.push({ kind: 'class.set', schoolClass });
  for (const pupil of state.pupils.values()) records.push({ kind: 'pupil.set', pupil });
  for (const course of state.courses.values()) records.push({ kind: 'course.set', course });
  // A version names the first day it applies, which can be later than the day the teacher gave it.
  for (const { version, from } of state.timetables)
    records.push({ kind: 'timetable.set', version: { ...version, from } });
  for (const entry of state.calendar) records.push({ kind: 'calendar.set', entry });
  const sessions = [...state.sessions.values()]
    .flatMap((versions) => versions.slice(-1))
    .map(({ value }) => value)
    .sort(
      (a, b) =>
        compareDays(a.session.day, b.session.day) ||
        compareSlots(a.session.slot, b.session.slot) ||
        compareText(a.session.key, b.session.key),
    );
  for (const record of sessions) records.push({ kind: 'session.recorded', record });
  for (const note of state.notes.values()) records.push({ kind: 'session.noted', note });
  const rollCalls = [...state.rollCalls.values()]
    .flatMap((versions) => versions.slice(-1))
    .sort(
      (a, b) =>
        compareDays(a.value.day, b.value.day) ||
        compareHalves(a.value.half, b.value.half) ||
        compareText(a.value.unit, b.value.unit),
    );
  for (const { value, reason } of rollCalls) {
    records.push({ kind: 'roll-call.taken', rollCall: value, ...(reason !== undefined && { reason }) });
  }
  for (const plan of state.seating.values()) records.push({ kind: 'seating.set', plan });
  return records;
}

/**
 * What may leave the teacher on `route`: the current version of each record
 * whose layer the route takes. History entries stay with the teacher, so no
 * entry's day or place in the history travels, and nobody can work out when
 * a record was made, such as the day a session was confirmed (PRD §5.4,
 * §7.6).
 */
export function recordsForRoute(state: State, route: OutboundRoute): RecordEvent[] {
  return currentRecords(state).filter((record) => mayTravelAs(layerOf(record), record.kind, route));
}
