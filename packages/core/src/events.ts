// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The events a teacher's history holds. Each event belongs to exactly one
// layer, so a session's private note is its own event, apart from the
// session record (PRD §5.4, §5.5).

import { ERASURE, type Entry } from './history.ts';
import type { Layer } from './layers.ts';
import type { CalendarEntry } from './reference.ts';
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
  // A session record never carries free text about why it changed: that is
  // private, and goes into the session's note (PRD §5.4). A correction may
  // carry a coded reason, which shows with it (PRD §5.5).
  | { readonly kind: 'session.recorded'; readonly record: SessionRecord; readonly correction?: CorrectionReason }
  // A confirmation undone: the session awaits confirmation again, and what
  // was recorded stays in the history (PRD §4.7).
  | { readonly kind: 'session.withdrawn'; readonly session: SessionRef }
  | { readonly kind: 'session.noted'; readonly note: PrivateNote }
  // A roll call's correction carries its short reason, which is part of the
  // roll-call record (PRD §3.4, §5.5).
  | { readonly kind: 'roll-call.taken'; readonly rollCall: RollCall; readonly reason?: string }
  | { readonly kind: 'seating.set'; readonly plan: SeatingPlan };

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
  'session.recorded': true,
  'session.withdrawn': true,
  'session.noted': true,
  'roll-call.taken': true,
  'seating.set': true,
};

/**
 * The layer of every event. Sync, exports and shares check it (PRD §5.4).
 *
 * The teacher's own calendar layer holds training days, seminars and duties,
 * which stay private (PRD §4.5).
 */
export function layerOf(event: RecordEvent): Layer {
  switch (event.kind) {
    case 'teacher.personal.set':
      return 'device';
    case 'pupil.set':
    case 'pupil.moved':
    case 'roll-call.taken':
      return 'pupil-records';
    case 'session.noted':
    case 'seating.set':
      return 'private';
    case 'calendar.set':
      return event.entry.layer === 'teacher' ? 'private' : 'lesson-record';
    case 'teacher.set':
    case 'school.set':
    case 'class.set':
    case 'course.set':
    case 'timetable.set':
    case 'session.recorded':
    case 'session.withdrawn':
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
