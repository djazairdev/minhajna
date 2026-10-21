// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The state the screens read, as state.ts builds it from the history
// (PRD §5.5). Apart from state.ts, so the shape stays short to read.

import type { AppliedUpdate } from './calendar-update.ts';
import type { CatchUpSession } from './catch-up-sessions.ts';
import type { Day } from './day.ts';
import type { ExamDuty } from './exam-duties.ts';
import type { ExtraSession } from './extra-records.ts';
import type { FreeList } from './free-list.ts';
import type { HomeworkCount } from './homework.ts';
import type { AddedPack } from './pack-update.ts';
import type { PlanDecision } from './plan-decisions.ts';
import type { PrintRecord } from './prints.ts';
import type { Membership } from './pupil-history.ts';
import type { CalendarEntry } from './reference.ts';
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
} from './records.ts';
import type { CountingRules } from './roll-call-counts.ts';
import type { SupportQueue } from './support-queue.ts';
import type { ScheduledTest } from './test-schedule.ts';
import type { RecordedTimetable } from './timetable-history.ts';
import type { AddedLayer, LayerSwitch } from './variant-layers.ts';
import type { Version } from './versions.ts';

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
  /** The district and school layers taken in, in the order taken; the first under an ID stays (#226). */
  readonly layers: readonly AddedLayer[];
  /** Which layer each class has on at each level, by course and level. */
  readonly layerSwitches: ReadonlyMap<string, LayerSwitch>;
  /** Each class's own list without a pack, by course (#227). */
  readonly lists: ReadonlyMap<string, FreeList>;
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
  /** The catch-up sessions the teacher added and has not cancelled, by ID (#228). */
  readonly catchUps: ReadonlyMap<string, CatchUpSession>;
  /** Each class's support queue, by course (#228). */
  readonly supportQueues: ReadonlyMap<string, SupportQueue>;
}
