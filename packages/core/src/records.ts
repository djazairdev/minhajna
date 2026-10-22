// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The records the teacher keeps (PRD §5.3). They hold only the minimum data
// (PRD §5.6): adding a pupil field changes a data flow, so it needs a
// decision record first.

import type { Day, Weekday } from './day.ts';
import type { RollCallUnitKind } from './reference.ts';
export type { Absence, Pupil, PupilMovement, RollCall } from './attendance-records.ts';

/**
 * The details the documents print (PRD §3.2). The subjects, schools and
 * school year come from the schools and the calendar, so the card keeps only
 * the rank.
 */
export interface TeacherCard {
  /** As the teacher writes it, such as «أستاذ التعليم المتوسط». */
  readonly rank: string;
}

/** The card's personal fields: optional, and they never leave the device (PRD §3.2, §5.6). */
export interface TeacherPersonal {
  readonly name?: string;
  /** The drawn signature, its shape only (#236, R-3.8-48). */
  readonly signature?: Signature;
  /** Whether the documents carry it; off unless the teacher turns it on (R-3.8-41). */
  readonly signatureOn?: boolean;
}

/** A drawn signature: an SVG path of moves and lines, in whole units of a fixed box. */
export interface Signature {
  readonly width: number;
  readonly height: number;
  readonly path: string;
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
  /** The times the teacher set to match the school's bell, over the level's template (PRD §4.6). */
  readonly bells?: SchoolBells;
}

/** One slot's time at a school, written HH:MM, such as 08:00 to 09:00. */
export interface SlotTime {
  readonly half: Half;
  readonly index: number;
  readonly from: string;
  readonly to: string;
}

/** A school's own times, slot by slot: the usual ones, and Ramadan's. A slot left out keeps its template's time. */
export interface SchoolBells {
  readonly usual?: readonly SlotTime[];
  readonly ramadan?: readonly SlotTime[];
}

export interface ClassGroup {
  readonly id: string;
  /** The whole class, a half-group, an option group, or a joint class's level (PRD §3.2, §5.3). */
  readonly kind: 'whole' | 'half' | 'option' | 'level';
  readonly name: string;
  /** A level group's grade; a joint class's own grade is its first level's. */
  readonly grade?: string;
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
  /** The demo class, whose pupils are made up (PRD §1.5). */
  readonly demo?: true;
  /** Archived from this day, when the school reshaped its classes: no sessions from it on, read and print only. */
  readonly archivedFrom?: Day;
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
  /** In a joint class, the level this course follows, with its own plan (PRD §3.2). */
  readonly grade?: string;
  /** Overrides the level's usual session length. */
  readonly sessionMinutes?: number;
  /** The old class's course whose history it takes, from the day the school reshaped its classes (#231). */
  readonly continues?: { readonly courseId: string; readonly from: Day };
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
  readonly weeks: Weeks;
  /** A session type code from the country profile. */
  readonly sessionType: string;
  /** For primary activity slots, such as reading (PRD §4.6). */
  readonly activity?: string;
  readonly room?: string;
}

/** Every week, or only A weeks or B weeks (PRD §4.6). */
export type Weeks = 'every' | 'A' | 'B';

/** The kinds of time that belong to the teacher (PRD §3.2, §4.6). */
export const BLOCK_KINDS = ['pedagogical', 'other-school', 'duty', 'reduction'] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

/** Time that belongs to the teacher rather than a class (PRD §3.2). */
export interface TeacherBlock {
  readonly weekday: Weekday;
  readonly half: Half;
  /** One slot of the half-day; without it, the whole half-day. */
  readonly index?: number;
  readonly weeks?: Weeks;
  readonly kind?: BlockKind;
  readonly label: string;
}

/** How the teacher's week is drawn (PRD §3.2): extra rows and days, and a double shift. */
export interface WeekOptions {
  readonly saturday?: true;
  readonly fifthMorning?: true;
  /** Mornings one week and afternoons the next, drawn as A and B weeks: the half-day taught in A weeks. */
  readonly doubleShift?: Half;
  /** With a double shift in primary, the other class in the same room, by name only (#230, answer 385). */
  readonly sharedWith?: string;
}

export interface TimetableVersion {
  /** Saved again under the same ID, as the week is drawn, it replaces itself. */
  readonly id: string;
  /** It applies from this day. Days before it keep the version they had (PRD §4.6). */
  readonly from: Day;
  readonly entries: readonly TimetableEntry[];
  readonly blocks: readonly TeacherBlock[];
  readonly source: 'hand' | 'package';
  readonly options?: WeekOptions;
}

/** What a session record covered of the plan. */
export type Coverage =
  /** Stages `from` to `to` (not included) of an item. An empty range means the item went on. */
  | { readonly op: 'taught'; readonly item: string; readonly from: number; readonly to: number }
  | { readonly op: 'skipped'; readonly item: string }
  | { readonly op: 'retaught'; readonly item: string };

/** The six outcomes, and another lesson than the one proposed (PRD §3.3, §4.7). */
export type Outcome = 'done' | 'partial' | 'merged' | 'skipped' | 'retaught' | 'not-held' | 'changed';

/** Enough to identify a session without the timetable, so a record survives any timetable change. */
export interface SessionRef {
  readonly key: string;
  readonly courseId: string;
  readonly groupId: string;
  readonly day: Day;
  readonly slot: Slot;
  readonly rotation?: Rotation;
}

/** Group IDs only: the rule used when a session or roll call was recorded. */
export interface Rotation {
  readonly entryId: string;
  readonly groups: readonly [string, string];
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
  /** A session not held that the teacher marked to be made up (PRD §3.3, §7.7). */
  readonly makeUp?: true;
  readonly homework?: Homework;
  readonly test?: string;
  /** Content that was not in the plan. */
  readonly unplanned?: string;
  /** The factual line, which can go into the texts book and into statements (PRD §3.3). */
  readonly factual?: string;
  /** For a timetabled support or remediation session, the item of its list it took and whether it finished it. */
  readonly listItem?: ListItemTaken;
}

/** The item of a support or remediation list a timetabled session took (#230, answer 376). */
export interface ListItemTaken {
  readonly id: string;
  readonly finished: boolean;
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
  /** Seats between two aisles: 2, 3, or 0 for none. Plans without it have no aisles. */
  readonly aisleEvery?: number;
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
