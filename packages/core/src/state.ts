// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the screens show is worked out from the history (PRD §5.5). A timetable
// version saved again under its ID while the week is drawn replaces itself, so
// drawing a week adds one version, not one for each change. A version recorded
// later replaces any earlier one that has not started by its first day, such as
// a week drawn during setup and corrected before the year begins.

import { compareDays, maxDay, type Day } from './day.ts';
import type { ExtraSession } from './extra-records.ts';
import type { Entry } from './history.ts';
import type { HomeworkCount } from './homework.ts';
import type { ExamDuty } from './exam-duties.ts';
import type { PlanDecision } from './plan-decisions.ts';
import type { PrintRecord } from './prints.ts';
import type { AppliedUpdate } from './calendar-update.ts';
import type { AddedPack } from './pack-update.ts';
import { packKey, type CalendarEntry } from './reference.ts';
import type { CountingRules } from './roll-call-counts.ts';
import type { ScheduledTest } from './test-schedule.ts';
import type {
  Course,
  PrivateNote,
  Pupil,
  RollCall,
  School,
  SchoolClass,
  SeatingPlan,
  SessionRecord,
  TeacherCard,
  TeacherPersonal,
  TimetableVersion,
} from './records.ts';
import { eventOf } from './events.ts';
import { withMovements, type Membership, type Movement } from './pupil-history.ts';

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
  /** The card's personal fields, which never leave the device. */
  readonly personal: TeacherPersonal | null;
  readonly schools: ReadonlyMap<string, School>;
  readonly classes: ReadonlyMap<string, SchoolClass>;
  readonly pupils: ReadonlyMap<string, Pupil>;
  readonly memberships?: ReadonlyMap<string, readonly Membership[]>;
  readonly rollCallOrders?: ReadonlyMap<string, number>;
  readonly courses: ReadonlyMap<string, Course>;
  /** The timetable versions that apply on some day, in recorded order, the order they apply (see `addTimetable`). */
  readonly timetables: readonly RecordedTimetable[];
  /** The entries the teacher added to the calendar. */
  readonly calendar: readonly CalendarEntry[];
  /** The signed calendar updates the teacher applied, one for each release, in the order applied (#223). */
  readonly calendarUpdates: readonly AppliedUpdate[];
  /** The day each release was first applied on this teacher's history; it never leaves with the records. */
  readonly calendarUpdatedOn: ReadonlyMap<string, Day>;
  /** The signed plan packs the teacher added, one for each release of a pack, in the order added (#223). */
  readonly addedPacks: readonly AddedPack[];
  /** Every version of each session's record, by key; the last is current, null when a confirmation was undone. */
  readonly sessions: ReadonlyMap<string, readonly Version<SessionRecord | null>[]>;
  readonly notes: ReadonlyMap<string, PrivateNote>;
  /** Every version of each homework's two counts, by the key of the session that set it; null once taken back. */
  readonly homeworkCounts: ReadonlyMap<string, readonly Version<HomeworkCount | null>[]>;
  /** Every version of each session outside the timetable, by ID; null once removed. */
  readonly extras: ReadonlyMap<string, readonly Version<ExtraSession | null>[]>;
  /** Every version of each roll call, by unit key. The last is the current one. */
  readonly rollCalls: ReadonlyMap<string, readonly Version<RollCall>[]>;
  readonly seating: ReadonlyMap<string, SeatingPlan>;
  /** The counting rules the teacher set, or null for the defaults. */
  readonly counting: CountingRules | null;
  /** Whether the teacher has finished setup once. */
  readonly setupFinished: boolean;
  /** Every print of the week's print set, the latest last. */
  readonly prints: readonly Version<PrintRecord>[];
  /** The teacher's test schedule, by ID (#221). */
  readonly tests: ReadonlyMap<string, ScheduledTest>;
  /** What the teacher decided about items past an exam window, by ID (#221). */
  readonly decisions: ReadonlyMap<string, PlanDecision>;
  /** The teacher's invigilations and class exams on exam weeks, by ID (#221). */
  readonly duties: ReadonlyMap<string, ExamDuty>;
}

function versionOf<T>(entry: Entry, value: T, reason?: string): Version<T> {
  return { entry: entry.id, day: entry.day, value, ...(reason !== undefined && { reason }) };
}

/**
 * Adds a timetable version recorded on `day`. Saved again under the ID of the last one, it replaces it and keeps the
 * day that one was recorded. The first version, `firstId`, applies from its own day, so setup can fill in the weeks
 * already gone. A later one never reaches back before the day it was recorded, and it takes the place of every earlier
 * one that would start on its first day or later, none of which has applied before that day: the past never moves
 * (PRD §4.6).
 */
function addTimetable(timetables: RecordedTimetable[], version: TimetableVersion, day: Day, firstId: string): void {
  const redrawn = timetables.at(-1)?.version.id === version.id ? timetables.pop() : undefined;
  const recorded = redrawn?.recorded ?? day;
  const first = version.id === firstId && (redrawn !== undefined || timetables.length === 0);
  const from = first ? version.from : maxDay(version.from, recorded);
  const kept = timetables.filter((timetable) => compareDays(timetable.from, from) < 0);
  timetables.splice(0, timetables.length, ...kept, { version, recorded, from });
}

/** Builds the state from the history entries. */
export function buildState(entries: readonly Entry[]): State {
  let teacher: TeacherCard | null = null;
  let personal: TeacherPersonal | null = null;
  const schools = new Map<string, School>();
  const classes = new Map<string, SchoolClass>();
  const pupilSets = new Map<string, { readonly pupil: Pupil; readonly order: number }>();
  const moved = new Map<string, Movement[]>();
  const memberships = new Map<string, Membership[]>();
  const rollCallOrders = new Map<string, number>();
  const courses = new Map<string, Course>();
  const timetables: RecordedTimetable[] = [];
  let firstTimetable: string | undefined;
  const calendar = new Map<string, CalendarEntry>();
  const calendarUpdates = new Map<string, AppliedUpdate>();
  const calendarUpdatedOn = new Map<string, Day>();
  const addedPacks = new Map<string, AddedPack>();
  const sessions = new Map<string, Version<SessionRecord | null>[]>();
  const notes = new Map<string, PrivateNote>();
  const extras = new Map<string, Version<ExtraSession | null>[]>();
  const homeworkCounts = new Map<string, Version<HomeworkCount | null>[]>();
  const rollCalls = new Map<string, Version<RollCall>[]>();
  const seating = new Map<string, SeatingPlan>();
  let counting: CountingRules | null = null;
  let setupFinished = false;
  const prints: Version<PrintRecord>[] = [];
  const tests = new Map<string, ScheduledTest>();
  const decisions = new Map<string, PlanDecision>();
  const duties = new Map<string, ExamDuty>();

  for (const [order, entry] of entries.entries()) {
    const event = eventOf(entry);
    if (event === null) continue;
    switch (event.kind) {
      case 'teacher.set':
        teacher = event.card;
        break;
      case 'teacher.personal.set':
        personal = event.personal;
        break;
      case 'school.set':
        schools.set(event.school.id, event.school);
        break;
      case 'class.set':
        classes.set(event.schoolClass.id, event.schoolClass);
        break;
      case 'pupil.set':
        pupilSets.set(event.pupil.id, { pupil: event.pupil, order });
        memberships.set(event.pupil.id, [
          ...(memberships.get(event.pupil.id) ?? []),
          { day: entry.day, order: entry.seq, groups: event.pupil.groups },
        ]);
        break;
      case 'pupil.moved':
        moved.set(event.pupilId, [...(moved.get(event.pupilId) ?? []), { movement: event.movement, order }]);
        break;
      case 'course.set':
        courses.set(event.course.id, event.course);
        break;
      case 'timetable.set':
        firstTimetable ??= event.version.id;
        addTimetable(timetables, event.version, entry.day, firstTimetable);
        break;
      case 'calendar.set':
        calendar.delete(event.entry.id);
        calendar.set(event.entry.id, event.entry);
        break;
      case 'calendar.removed':
        calendar.delete(event.id);
        break;
      case 'calendar.updated':
        calendarUpdates.set(event.applied.update.release, event.applied);
        if (!calendarUpdatedOn.has(event.applied.update.release))
          calendarUpdatedOn.set(event.applied.update.release, entry.day);
        break;
      case 'pack.added':
        addedPacks.set(packKey(event.added.update.pack.id, event.added.update.pack.release), event.added);
        break;
      case 'session.recorded': {
        const key = event.record.session.key;
        sessions.set(key, [...(sessions.get(key) ?? []), versionOf(entry, event.record, event.correction)]);
        break;
      }
      case 'session.withdrawn': {
        const key = event.session.key;
        sessions.set(key, [...(sessions.get(key) ?? []), versionOf<SessionRecord | null>(entry, null)]);
        break;
      }
      case 'session.noted':
        notes.set(event.note.sessionKey, event.note);
        break;
      case 'homework.counted': {
        const key = event.count.sessionKey;
        homeworkCounts.set(key, [...(homeworkCounts.get(key) ?? []), versionOf(entry, event.count)]);
        break;
      }
      case 'homework.uncounted':
        homeworkCounts.set(event.sessionKey, [
          ...(homeworkCounts.get(event.sessionKey) ?? []),
          versionOf<HomeworkCount | null>(entry, null),
        ]);
        break;
      case 'extra.logged':
        extras.set(event.extra.id, [...(extras.get(event.extra.id) ?? []), versionOf(entry, event.extra)]);
        break;
      case 'extra.removed':
        extras.set(event.id, [...(extras.get(event.id) ?? []), versionOf<ExtraSession | null>(entry, null)]);
        break;
      case 'roll-call.taken': {
        const key = event.rollCall.unit;
        if (!rollCallOrders.has(key)) rollCallOrders.set(key, entry.seq);
        rollCalls.set(key, [...(rollCalls.get(key) ?? []), versionOf(entry, event.rollCall, event.reason)]);
        break;
      }
      case 'seating.set':
        seating.set(`${event.plan.classId}/${event.plan.groupId}`, event.plan);
        break;
      case 'counting.set':
        counting = event.rules;
        break;
      case 'setup.finished':
        setupFinished = true;
        break;
      case 'print.recorded':
        prints.push(versionOf(entry, event.print));
        break;
      case 'test.set':
        tests.set(event.test.id, event.test);
        break;
      case 'test.removed':
        tests.delete(event.id);
        break;
      case 'plan.decided':
        decisions.set(event.decision.id, event.decision);
        break;
      case 'plan.undecided':
        decisions.delete(event.id);
        break;
      case 'duty.set':
        duties.set(event.duty.id, event.duty);
        break;
      case 'duty.removed':
        duties.delete(event.id);
        break;
    }
  }
  const pupils = new Map<string, Pupil>();
  for (const [id, { pupil, order }] of pupilSets) pupils.set(id, withMovements(pupil, order, moved.get(id) ?? []));

  return {
    teacher,
    personal,
    schools,
    classes,
    pupils,
    memberships,
    rollCallOrders,
    courses,
    timetables,
    calendar: [...calendar.values()],
    calendarUpdates: [...calendarUpdates.values()],
    calendarUpdatedOn,
    addedPacks: [...addedPacks.values()],
    sessions,
    notes,
    extras,
    homeworkCounts,
    rollCalls,
    seating,
    counting,
    setupFinished,
    prints,
    tests,
    decisions,
    duties,
  };
}

/** The current version of a record, or null. */
export function current<T>(versions: readonly Version<T>[] | undefined): T | null {
  return versions?.at(-1)?.value ?? null;
}
