// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Day } from './day.ts';
import type { Slot } from './records.ts';
import type { SchoolYear } from './reference.ts';

/** School-space roles, not roles a teacher can select on their own device (PRD §7.8). */
export type CoverRole = 'director' | 'deputy' | 'teacher' | 'supervisor' | 'timetable-preparer' | 'inspector';

/** A dated session supplied by the school's timetable, with no pupil data or reason for cover. */
export interface CoverSession {
  readonly id: string;
  readonly schoolId: string;
  readonly teacherId: string;
  readonly classId: string;
  readonly className: string;
  readonly level: string;
  readonly day: Day;
  readonly slot: Slot;
}

/** The assignment choices of PRD §7.7. A swap or move references another school timetable session. */
export type CoverChoice =
  | { readonly kind: 'supervision' | 'study-room'; readonly teacherId?: string }
  | { readonly kind: 'colleague'; readonly teacherId: string }
  | { readonly kind: 'merge'; readonly teacherId: string; readonly classId: string }
  | { readonly kind: 'swap' | 'move'; readonly sessionId: string }
  | { readonly kind: 'release' };

/** Supplied by an authenticated school-space adapter; this interface does not authenticate a caller. */
export interface CoverAuthority {
  readonly nationalSystem: boolean;
  readonly schoolId: string;
  readonly actorId: string;
  readonly members: ReadonlyMap<string, readonly CoverRole[]>;
  readonly sessions: readonly CoverSession[];
  readonly year: SchoolYear;
}

/** A school assignment and its optional teacher confirmation, never an absence record. */
export interface SchoolCover {
  readonly session: CoverSession;
  readonly choice: CoverChoice;
  readonly assigned: boolean;
  readonly completed: boolean;
}

/** School cover has its own history, separate from the teacher's lesson and pupil records. */
export type CoverEvent =
  | { readonly kind: 'cover.set'; readonly schoolId: string; readonly actorId: string; readonly cover: SchoolCover }
  | {
      readonly kind: 'cover.cancelled';
      readonly schoolId: string;
      readonly actorId: string;
      readonly sessionId: string;
    }
  | {
      readonly kind: 'cover.completed' | 'cover.reopened';
      readonly schoolId: string;
      readonly actorId: string;
      readonly sessionId: string;
    };

/** The teacher's read-only projection, without the holder's identity, reasons or another teacher's history. */
export interface TeacherCover {
  readonly session: Omit<CoverSession, 'teacherId'>;
  readonly direction: 'given' | 'received';
  readonly choice: CoverChoice['kind'];
  readonly assigned: boolean;
  readonly completed: boolean;
}

/** The supervisor's daily sheet names the assigned colleague, but not the holder or any reason. */
export interface CoverSheetRow {
  readonly session: TeacherCover['session'];
  readonly choice: CoverChoice;
  readonly assigned: boolean;
  readonly completed: boolean;
}
