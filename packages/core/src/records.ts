// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The records the teacher keeps (PRD §5.3). They hold only the minimum data
// (PRD §5.6): adding a pupil field changes a data flow, so it needs a
// decision record first.

import type { Day, Weekday } from './day.ts';
import type { RollCallUnitKind } from './reference.ts';

/** The details the documents print (PRD §3.2). */
export interface TeacherCard {
  readonly name: string;
  readonly subjects: readonly string[];
}

export interface School {
  readonly id: string;
  readonly name: string;
  /** The official code, when the teacher knows it. */
  readonly code?: string;
  /** The levels the teacher teaches there: more than one when a school has several (PRD §3.2). */
  readonly levels: readonly string[];
  /** The subjects the teacher teaches there: two for a bivalent teacher, such as Arabic with Islamic education. */
  readonly subjects: readonly string[];
  /** The zone or wilaya, which picks the zone layer of the calendar. Until it is set, no zone entry applies. */
  readonly zone?: string;
}

export interface ClassGroup {
  readonly id: string;
  /** The whole class, a half-group or an option group (PRD §5.3). */
  readonly kind: 'whole' | 'half' | 'option';
  readonly name: string;
}

export interface SchoolClass {
  readonly id: string;
  readonly schoolId: string;
  readonly level: string;
  readonly grade: string;
  readonly stream?: string;
  /** As the school writes it, such as 1AM2. */
  readonly name: string;
  /** Always holds exactly one whole-class group. */
  readonly groups: readonly ClassGroup[];
  /** Overrides the level's unit, for example for a primary specialist who counts only their own sessions. */
  readonly rollCallUnit?: RollCallUnitKind;
}

export interface PupilMovement {
  readonly day: Day;
  readonly kind: 'in' | 'out';
  readonly reason: string;
  /** For a pupil who left: the director's confirmation, once the teacher records it (PRD §3.2). */
  readonly confirmed?: boolean;
}

/** Only the fields in PRD §5.6. */
export interface Pupil {
  readonly id: string;
  readonly classId: string;
  /** The official registration number. Pupils are matched by it, never by name. */
  readonly registration: string;
  readonly name: string;
  /** The name in Latin letters, if the class list has it. */
  readonly latinName?: string;
  readonly sex: 'f' | 'm';
  /** Half-groups and option groups. Every pupil is in the whole-class group. */
  readonly groups: readonly string[];
  readonly movements: readonly PupilMovement[];
}

export interface PinnedPack {
  readonly id: string;
  readonly release: string;
}

/** Class × subject × school year: the anchor for progress (PRD §2.3, rule 3). */
export interface Course {
  readonly id: string;
  readonly classId: string;
  readonly subject: string;
  readonly year: string;
  /** The pack release the class stays on, or none for free entry (PRD §3.2). */
  readonly pack: PinnedPack | null;
  /** Overrides the level's usual session length. */
  readonly sessionMinutes?: number;
}

export type Half = 'morning' | 'afternoon';

/** A timetable slot names a place in the day, never a clock time (PRD §4.6). */
export interface Slot {
  readonly half: Half;
  /** From 1, within the half-day. */
  readonly index: number;
}

export interface TimetableEntry {
  readonly id: string;
  readonly weekday: Weekday;
  readonly slot: Slot;
  readonly courseId: string;
  readonly groupId: string;
  readonly weeks: 'every' | 'A' | 'B';
  /** A session type code from the country profile. */
  readonly sessionType: string;
  /** For primary activity slots, such as reading (PRD §4.6). */
  readonly activity?: string;
  readonly room?: string;
}

/** Time that belongs to the teacher rather than a class (PRD §3.2). */
export interface TeacherBlock {
  readonly weekday: Weekday;
  readonly half: Half;
  readonly label: string;
}

export interface TimetableVersion {
  readonly id: string;
  /** It applies from this day. Days before it keep the version they had (PRD §4.6). */
  readonly from: Day;
  readonly entries: readonly TimetableEntry[];
  readonly blocks: readonly TeacherBlock[];
  readonly source: 'hand' | 'package';
}

/** What a session record covered of the plan. */
export type Coverage =
  /** Stages `from` to `to` (not included) of an item. An empty range means the item went on. */
  | { readonly op: 'taught'; readonly item: string; readonly from: number; readonly to: number }
  | { readonly op: 'skipped'; readonly item: string }
  | { readonly op: 'retaught'; readonly item: string };

/** The six outcomes (PRD §3.3). */
export type Outcome = 'done' | 'partial' | 'merged' | 'skipped' | 'retaught' | 'not-held';

/** Enough to identify a session without the timetable, so a record survives any timetable change. */
export interface SessionRef {
  readonly key: string;
  readonly courseId: string;
  readonly groupId: string;
  readonly day: Day;
  readonly slot: Slot;
}

export interface Homework {
  readonly text: string;
  readonly due: Day;
}

export interface SessionRecord {
  readonly session: SessionRef;
  readonly outcome: Outcome;
  readonly sessionType: string;
  readonly coverage: readonly Coverage[];
  readonly homework?: Homework;
  readonly test?: string;
  /** Content that was not in the plan. */
  readonly unplanned?: string;
  /** The factual line, which can go into the texts book and into statements (PRD §3.3). */
  readonly factual?: string;
}

/** The reasons a session was not held or an item skipped. None names collective action (PRD §3.3). */
export const REASONS = [
  'closure',
  'exam',
  'holiday',
  'event',
  'teacher-absent',
  'class-absent',
  'few-pupils',
  'other',
] as const;

export type Reason = (typeof REASONS)[number];

/** The private side of a session: it never leaves the teacher's devices (PRD §5.4). */
export interface PrivateNote {
  readonly sessionKey: string;
  readonly reason?: Reason;
  readonly note?: string;
  /** A reason in the teacher's own words, given when confirming or correcting the session. */
  readonly reasonText?: string;
}

export interface Absence {
  readonly pupilId: string;
  /** Justified or unjustified. The cause is never typed (PRD §5.6). */
  readonly justified: boolean;
}

/** One roll call: everyone is present except those marked (PRD §3.4). */
export interface RollCall {
  readonly unit: string;
  readonly classId: string;
  readonly groupId: string;
  readonly day: Day;
  readonly half: Half;
  readonly absent: readonly Absence[];
  readonly late: readonly string[];
}

export interface Seat {
  readonly row: number;
  readonly column: number;
  readonly pupilId: string;
}

/** Private: it stays on the teacher's devices (PRD §3.4, §5.4). */
export interface SeatingPlan {
  readonly classId: string;
  readonly groupId: string;
  readonly rows: number;
  readonly columns: number;
  readonly seats: readonly Seat[];
}

export function slotKey(slot: Slot): string {
  return `${slot.half === 'morning' ? 'm' : 'a'}${slot.index}`;
}

export function compareHalves(a: Half, b: Half): number {
  if (a === b) return 0;
  return a === 'morning' ? -1 : 1;
}

export function compareSlots(a: Slot, b: Slot): number {
  return compareHalves(a.half, b.half) || a.index - b.index;
}

export function wholeGroup(schoolClass: SchoolClass): ClassGroup {
  const group = schoolClass.groups.find((candidate) => candidate.kind === 'whole');
  if (group === undefined) throw new Error(`Class ${schoolClass.id} has no whole-class group`);
  return group;
}
