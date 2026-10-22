// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The events a teacher's history holds. Each event belongs to exactly one
// layer, so a session's private note is its own event, apart from the
// session record (PRD §5.4, §5.5).

import type { ExtraSession } from './extra-records.ts';
import { ERASURE, type Entry } from './history.ts';
import type { HomeworkCount } from './homework.ts';
import type { Layer } from './layers.ts';
import type { CatchUpSession } from './catch-up-sessions.ts';
import type { ExamDuty } from './exam-duties.ts';
import type { Repace } from './repace-records.ts';
import type { KeptClash, SessionMove } from './session-moves.ts';
import type { LessonNote } from './lesson-notes.ts';
import type { SupportQueue } from './support-queue.ts';
import type { PlanDecision } from './plan-decisions.ts';
import type { PrintRecord } from './prints.ts';
import type { AppliedUpdate } from './calendar-update.ts';
import type { AddedPack } from './pack-update.ts';
import type { AddedLayer, LayerSwitch } from './variant-layers.ts';
import type { FreeList } from './free-list.ts';
import type { CalendarEntry, CalendarLayer } from './reference.ts';
import type { CountingRules } from './roll-call-counts.ts';
import type { ScheduledTest } from './test-schedule.ts';
import type {
  Course,
  PrivateNote,
  Pupil,
  PupilMovement,
  RollCall,
  School,
  SchoolClass,
  SeatingPlan,
  SessionRecord,
  SessionRef,
  TeacherCard,
  TeacherPersonal,
  TimetableVersion,
} from './records.ts';

/**
 * Why a confirmed session was corrected: added after confirming, an entry
 * error, or another reason, whose words stay in the private note. The code
 * shows with the correction (PRD §5.5).
 */
export const CORRECTION_REASONS = ['added-later', 'entry-error', 'other'] as const;

export type CorrectionReason = (typeof CORRECTION_REASONS)[number];

export type RecordEvent =
  | { readonly kind: 'teacher.set'; readonly card: TeacherCard }
  | { readonly kind: 'teacher.personal.set'; readonly personal: TeacherPersonal }
  | { readonly kind: 'school.set'; readonly school: School }
  | { readonly kind: 'class.set'; readonly schoolClass: SchoolClass }
  | { readonly kind: 'pupil.set'; readonly pupil: Pupil }
  | { readonly kind: 'pupil.moved'; readonly pupilId: string; readonly movement: PupilMovement }
  | { readonly kind: 'course.set'; readonly course: Course }
  | { readonly kind: 'timetable.set'; readonly version: TimetableVersion }
  | { readonly kind: 'calendar.set'; readonly entry: CalendarEntry }
  /** An entry the teacher added, taken back; its layer keeps a teacher's own entry private. */
  | { readonly kind: 'calendar.removed'; readonly id: string; readonly layer: CalendarLayer }
  /** A signed calendar update, checked and applied, with its file to pass on as it came (#223). */
  | { readonly kind: 'calendar.updated'; readonly applied: AppliedUpdate }
  /** A signed plan pack, checked and added to the catalogue, with its file to pass on as it came (#223). */
  | { readonly kind: 'pack.added'; readonly added: AddedPack }
  /** A district or school layer of a plan, taken in; it changes no class until switched on (#226). */
  | { readonly kind: 'layer.added'; readonly added: AddedLayer }
  | { readonly kind: 'layer.switched'; readonly switched: LayerSwitch }
  /** A class's own list, without a pack (#227). */
  | { readonly kind: 'list.set'; readonly list: FreeList }
  // A session record never carries free text about why it changed: that is
  // private, and goes into the session's note (PRD §5.4). A correction may
  // carry a coded reason, which shows with it (PRD §5.5).
  | { readonly kind: 'session.recorded'; readonly record: SessionRecord; readonly correction?: CorrectionReason }
  // A confirmation undone: the session awaits confirmation again, and what
  // was recorded stays in the history (PRD §4.7).
  | { readonly kind: 'session.withdrawn'; readonly session: SessionRef }
  | { readonly kind: 'session.noted'; readonly note: PrivateNote }
  // Homework's two counts, entered or corrected when it comes back, and
  // taken back; the history keeps every version (PRD §3.8, §5.5).
  | { readonly kind: 'homework.counted'; readonly count: HomeworkCount }
  | { readonly kind: 'homework.uncounted'; readonly sessionKey: string }
  // A session outside the timetable, logged or corrected, and one removed
  // when logged by mistake; the history keeps both (PRD §3.3, §5.5).
  | { readonly kind: 'extra.logged'; readonly extra: ExtraSession }
  | { readonly kind: 'extra.removed'; readonly id: string }
  // A roll call's correction carries its short reason, which is part of the
  // roll-call record (PRD §3.4, §5.5).
  | { readonly kind: 'roll-call.taken'; readonly rollCall: RollCall; readonly reason?: string }
  | { readonly kind: 'seating.set'; readonly plan: SeatingPlan }
  // The roll-call book's counting rules, one set for every class (PRD §3.4).
  | { readonly kind: 'counting.set'; readonly rules: CountingRules }
  // Setup was finished once, so the app opens on Today from then on (#183).
  | { readonly kind: 'setup.finished' }
  /** The week's print set went to a printer or to the print shop's PDF. */
  | { readonly kind: 'print.recorded'; readonly print: PrintRecord }
  /** A test on the teacher's schedule, set or moved (#221). */
  | { readonly kind: 'test.set'; readonly test: ScheduledTest }
  | { readonly kind: 'test.removed'; readonly id: string }
  /** What the teacher decided when an item would pass an exam window, or that decision taken back (#221). */
  | { readonly kind: 'plan.decided'; readonly decision: PlanDecision }
  | { readonly kind: 'plan.undecided'; readonly id: string }
  /** An invigilation or a class exam on an exam week, set or corrected, or removed (#221). */
  | { readonly kind: 'duty.set'; readonly duty: ExamDuty }
  | { readonly kind: 'duty.removed'; readonly id: string }
  /** A catch-up session the teacher added, or cancelled before it was recorded (#228). */
  | { readonly kind: 'catchup.set'; readonly catchUp: CatchUpSession }
  | { readonly kind: 'catchup.removed'; readonly id: string }
  /** A class's support queue, saved whole (#228). */
  | { readonly kind: 'support.set'; readonly queue: SupportQueue }
  /** A re-pace of the rest of a term the teacher confirmed, or took back (#229). */
  | { readonly kind: 'repace.set'; readonly repace: Repace }
  | { readonly kind: 'repace.removed'; readonly id: string }
  /** A clash between two schools the teacher kept, or opened again (#232). */
  | { readonly kind: 'clash.kept'; readonly kept: KeptClash }
  | { readonly kind: 'clash.reopened'; readonly id: string }
  /** A session moved for one day, or moved back (#232). */
  | { readonly kind: 'move.set'; readonly move: SessionMove }
  | { readonly kind: 'move.removed'; readonly id: string }
  /** A lesson note made or changed (#237). */
  | { readonly kind: 'lesson-note.set'; readonly note: LessonNote };

export type RecordKind = RecordEvent['kind'];

// Every kind must be listed, or its events would be dropped when the state is
// built. The compiler checks that none is missing.
const KINDS: Readonly<Record<RecordKind, true>> = {
  'teacher.set': true,
  'teacher.personal.set': true,
  'school.set': true,
  'class.set': true,
  'pupil.set': true,
  'pupil.moved': true,
  'course.set': true,
  'timetable.set': true,
  'calendar.set': true,
  'calendar.removed': true,
  'calendar.updated': true,
  'pack.added': true,
  'layer.added': true,
  'layer.switched': true,
  'list.set': true,
  'session.recorded': true,
  'session.withdrawn': true,
  'session.noted': true,
  'homework.counted': true,
  'homework.uncounted': true,
  'extra.logged': true,
  'extra.removed': true,
  'roll-call.taken': true,
  'seating.set': true,
  'counting.set': true,
  'setup.finished': true,
  'print.recorded': true,
  'test.set': true,
  'test.removed': true,
  'plan.decided': true,
  'plan.undecided': true,
  'duty.set': true,
  'duty.removed': true,
  'catchup.set': true,
  'catchup.removed': true,
  'support.set': true,
  'repace.set': true,
  'repace.removed': true,
  'clash.kept': true,
  'clash.reopened': true,
  'move.set': true,
  'move.removed': true,
  'lesson-note.set': true,
};

/**
 * The layer of every event. Sync, exports and shares check it (PRD §5.4).
 *
 * The teacher's own calendar layer holds training days, seminars and duties,
 * which stay private (PRD §4.5). A lesson note is the teacher's own
 * preparation, kept private (answer 417).
 */
export function layerOf(event: RecordEvent): Layer {
  switch (event.kind) {
    case 'teacher.personal.set':
      return 'device';
    case 'pupil.set':
    case 'pupil.moved':
    case 'roll-call.taken':
    case 'counting.set':
      return 'pupil-records';
    case 'session.noted':
    case 'seating.set':
    case 'setup.finished':
    case 'print.recorded':
    case 'lesson-note.set':
      return 'private';
    case 'calendar.set':
      return event.entry.layer === 'teacher' ? 'private' : 'lesson-record';
    case 'calendar.removed':
      return event.layer === 'teacher' ? 'private' : 'lesson-record';
    case 'calendar.updated':
    case 'pack.added':
    case 'layer.added':
    case 'layer.switched':
    case 'list.set':
      return 'lesson-record';
    case 'teacher.set':
    case 'school.set':
    case 'class.set':
    case 'course.set':
    case 'timetable.set':
    case 'session.recorded':
    case 'session.withdrawn':
    case 'extra.logged':
    case 'extra.removed':
    case 'homework.counted':
    case 'homework.uncounted':
    case 'test.set':
    case 'test.removed':
    case 'plan.decided':
    case 'plan.undecided':
    case 'duty.set':
    case 'duty.removed':
    case 'catchup.set':
    case 'catchup.removed':
    case 'support.set':
    case 'repace.set':
    case 'repace.removed':
    case 'clash.kept':
    case 'clash.reopened':
    case 'move.set':
    case 'move.removed':
      return 'lesson-record';
  }
}

/**
 * The event an entry holds, or null once erased.
 *
 * RecordBook opens a history only once it verifies, and only RecordBook
 * writes events into one, so `buildState` trusts the entries it is given.
 */
export function eventOf(entry: Entry): RecordEvent | null {
  if (entry.kind === ERASURE || entry.content === null || !Object.hasOwn(KINDS, entry.kind)) return null;
  const body = entry.content.body;
  if (typeof body !== 'object' || body === null || !('kind' in body) || body.kind !== entry.kind) return null;
  return body as RecordEvent;
}
