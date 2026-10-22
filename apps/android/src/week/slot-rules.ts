// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot of the week (#28, Week-slot), as items the teacher edits: a
// session of a class, or time that belongs to the teacher. A slot holds one
// item every week, or one in A weeks and another in B weeks, such as two
// half-groups taking turns (R-3.2-19, R-3.2-20). A session names its class,
// its subject, which gives its course, so a teacher of two subjects in one
// class keeps a plan and a book for each (R-4.7-01), its group, a room, its
// session type and, in primary, its activity type, which a slot keeps when
// it is edited (#230, answer 374).
// The teacher's own time has a kind and may take the whole half-day
// (R-4.6-07). Saving a slot replaces what it held and nothing else.

import {
  blockCovers,
  type BlockKind,
  type Course,
  type SchoolClass,
  type TeacherBlock,
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

/** The session with `activity` as its activity type, or with none. */
export function withActivity(item: SessionItem, activity: string | undefined): SessionItem {
  const rest: { -readonly [Key in keyof SessionItem]: SessionItem[Key] } = { ...item };
  delete rest.activity;
  return activity === undefined ? rest : { ...rest, activity };
}

/** The other week of an A/B pair. */
export function otherWeek(weeks: 'A' | 'B'): 'A' | 'B' {
  return weeks === 'A' ? 'B' : 'A';
}

/** The version with the slot holding `items` instead; `courseId` names the course of a class and subject. */
export function setItems(
  version: TimetableVersion,
  cell: Cell,
  items: readonly SlotItem[],
  make: { readonly courseId: (classId: string, subject: string) => string; readonly newId: () => string },
): TimetableVersion {
  const entries = version.entries.filter((entry) => !inCell(cell)(entry));
  const blocks = version.blocks.filter((block) => !blockCovers(block, cell.weekday, cell.slot));
  for (const item of items) {
    if (item.kind === 'class') {
      const room = item.room?.trim();
      entries.push({
        id: make.newId(),
        weekday: cell.weekday,
        slot: cell.slot,
        courseId: make.courseId(item.classId, item.subject),
        groupId: item.groupId,
        weeks: item.weeks,
        sessionType: item.sessionType,
        ...(room !== undefined && room !== '' && { room }),
        ...(item.activity !== undefined && { activity: item.activity }),
      });
      continue;
    }
    const block: TeacherBlock = {
      weekday: cell.weekday,
      half: cell.slot.half,
      ...(!item.halfDay && { index: cell.slot.index }),
      ...(item.weeks !== 'every' && { weeks: item.weeks }),
      ...(item.ownKind !== undefined && { kind: item.ownKind }),
      label: item.label,
    };
    blocks.push(block);
  }
  return { ...version, entries, blocks };
}

/** The class with two half-groups, named as given, if it had none; `added` says whether it changed. */
export function withHalves(
  schoolClass: SchoolClass,
  names: readonly [string, string],
  newId: () => string,
): { readonly schoolClass: SchoolClass; readonly added: boolean } {
  if (schoolClass.groups.filter((group) => group.kind === 'half').length >= 2) return { schoolClass, added: false };
  const halves = names.map((name) => ({ id: newId(), kind: 'half' as const, name }));
  return { schoolClass: { ...schoolClass, groups: [...schoolClass.groups, ...halves] }, added: true };
}
