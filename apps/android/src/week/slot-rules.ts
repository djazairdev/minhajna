// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot of the week (#28, Week-slot), as items to read: a session of a
// class, or time that belongs to the teacher. A slot holds one item every
// week, or one in A weeks and another in B weeks, such as two half-groups
// taking turns (R-3.2-19, R-3.2-20). A session names its class, its subject,
// which gives its course (R-4.7-01), its group, a room, its session type and,
// in primary, its activity type (#230, answer 374). The teacher's own time has
// a kind and may take the whole half-day (R-4.6-07).

import {
  blockCovers,
  type BlockKind,
  type Course,
  type TimetableEntry,
  type TimetableVersion,
  type Weeks,
} from '@minhajna/core';
import type { Cell } from './week-rules';

export type SessionItem = {
  readonly kind: 'class';
  readonly classId: string;
  readonly subject: string;
  readonly groupId: string;
  readonly weeks: Weeks;
  readonly sessionType: string;
  readonly room?: string;
  /** In primary, the activity type from the pack's weekly model, such as `reading`. */
  readonly activity?: string;
};

export type OwnItem = {
  readonly kind: 'own';
  readonly ownKind?: BlockKind;
  readonly halfDay: boolean;
  readonly weeks: Weeks;
  readonly label: string;
};

export type SlotItem = SessionItem | OwnItem;

export type Lookup = {
  readonly course: (id: string) => Course | undefined;
};

const inCell = (cell: Cell) => (entry: TimetableEntry) =>
  entry.weekday === cell.weekday && entry.slot.half === cell.slot.half && entry.slot.index === cell.slot.index;

/** What a slot holds, sessions first. */
export function itemsAt(version: TimetableVersion, lookup: Lookup, cell: Cell): SlotItem[] {
  const sessions = version.entries.filter(inCell(cell)).flatMap((entry): SlotItem[] => {
    const course = lookup.course(entry.courseId);
    if (course === undefined) return [];
    return [
      {
        kind: 'class',
        classId: course.classId,
        subject: course.subject,
        groupId: entry.groupId,
        weeks: entry.weeks,
        sessionType: entry.sessionType,
        ...(entry.room !== undefined && { room: entry.room }),
        ...(entry.activity !== undefined && { activity: entry.activity }),
      },
    ];
  });
  const own = version.blocks
    .filter((block) => blockCovers(block, cell.weekday, cell.slot))
    .map((block): SlotItem => ({
      kind: 'own',
      ...(block.kind !== undefined && { ownKind: block.kind }),
      halfDay: block.index === undefined,
      weeks: block.weeks ?? 'every',
      label: block.label,
    }));
  return [...sessions, ...own];
}
